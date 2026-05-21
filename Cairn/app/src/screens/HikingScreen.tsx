/**
 * HikingScreen — Sprint 18 AR drag interaction + topo map
 *
 * States:
 * 1. Map view: full-screen topo placeholder, GPS chip, back chip, FAB
 * 2. Tracking: stats bar appears above map
 * 3. AR flag picker: drag from corner to drop zone to plant (tap fallback preserved)
 * 4. Plant note sheet: optional note before saving
 * 5. Marker detail sheet: view / delete a marker
 *
 * expo-keep-awake: activates when status === 'tracking'
 * Real stores: useTrackingStore (GPS), useMarkerStore (flags)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  TextInput, Alert, Animated, Easing, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { useTrackingStore } from '../store/useTrackingStore';
import { useMarkerStore } from '../store/useMarkerStore';
import { useRouteStore } from '../store/useRouteStore';
import { getCurrentRegion } from '../config/regions';
import { formatDistance, formatDuration, haversineM, createTrackSmoother, smoothGPSPoint, getSamplingInterval, classifyMovement, type SmoothedTrackState, type GPSPoint } from '../utils/geo';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon, type IconName } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { PressBtn } from '../components/PressBtn';
import { MARKER_META, type MarkerType } from '../data/mockData';
import type { Marker } from '../store/useMarkerStore';


type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: W } = Dimensions.get('window');

// ── Flag type config with SVG icons ─────────────────────────────────────────
const FLAG_TYPES: {
  id: MarkerType;
  icon: IconName;
  label: string;
  color: string;
  bg: string;
}[] = [
  { id: 'danger',   icon: 'TriangleAlert', label: 'Danger',   color: Colors.danger,   bg: Colors.dangerBg  },
  { id: 'scenic',   icon: 'Star',          label: 'Scenic',   color: Colors.info,     bg: Colors.infoBg    },
  { id: 'supply',   icon: 'Droplets',      label: 'Water',    color: Colors.success,  bg: Colors.successBg },
  { id: 'junction', icon: 'Navigation2',   label: 'Junction', color: Colors.docOrange,  bg: Colors.severityWarningBg },
];

// ── Marker pin on map ─────────────────────────────────────────────────────
function MarkerPin({ type, x, y, onPress, approximate }: {
  type: MarkerType; x: number; y: number; onPress: () => void; approximate?: boolean;
}) {
  const meta = MARKER_META[type] || MARKER_META.free;
  const iconName = FLAG_TYPES.find(f => f.id === type)?.icon || 'Flag';
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.markerPin, { left: x, top: y, borderColor: meta.color, backgroundColor: meta.bg, transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start()}
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={iconName as IconName} size={14} color={meta.color} strokeWidth={2.5} />
        {approximate && (
          <View style={styles.approxBadge}>
            <Text style={styles.approxBadgeText}>~</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Mapbox conditional import ────────────────────────────────────────────
// @rnmapbox/maps components are native-only — on web they may be undefined.
// Force fallback on web to avoid "Element type is invalid" crash.
let MapView: any = null;
let CameraComponent: any = null;
let PointAnnotation: any = null;
let UserLocationComponent: any = null;
let LineLayer: any = null;
let ShapeSource: any = null;
if (Platform.OS !== 'web') {
  try {
    const Mapbox = require('@rnmapbox/maps');
    MapView = Mapbox.MapView;
    CameraComponent = Mapbox.Camera;
    PointAnnotation = Mapbox.PointAnnotation;
    UserLocationComponent = Mapbox.UserLocation;
    LineLayer = Mapbox.LineLayer;
    ShapeSource = Mapbox.ShapeSource;
  } catch {
    // Mapbox native not available
  }
}

// ── Map component (real Mapbox or fallback) ─────────────────────────────
function HikingMap({ markers, trackPoints, onMarkerPress, showCompass, routeStart, userPos, instantCamera }: {
  markers: Marker[];
  trackPoints: Array<{ lat: number; lng: number }>;
  onMarkerPress: (id: string) => void;
  showCompass?: boolean;
  // When a saved route is selected and the user isn't already at its
  // start, we draw a dashed "approach" line from the user's current
  // position to the route's first waypoint, plus a "Start" pin so the
  // user can see how far away the trailhead is.
  routeStart?: { lat: number; lng: number } | null;
  userPos?: { lat: number; lng: number } | null;
  // When true, skip the camera fly-in animation. Used when resuming
  // an in-progress hike — the user already knows where they are, the
  // 1-second zoom-in feels slow.
  instantCamera?: boolean;
}) {
  const region = getCurrentRegion();

  // Build GeoJSON for track polyline
  const trackGeoJSON = {
    type: 'FeatureCollection' as const,
    features: trackPoints.length >= 2 ? [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: trackPoints.map(p => [p.lng, p.lat]),
      },
      properties: {},
    }] : [],
  };

  // Fallback when Mapbox not available
  if (!MapView) {
    return (
      <View style={styles.mapBg}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }}>
          <Icon name="Map" size={48} color={Colors.primaryMuted} />
          <Text style={{ fontSize: FontSize.h3, fontWeight: '600', color: Colors.textPrimary }}>
            Real Map (EAS Build)
          </Text>
          <Text style={{ fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center' }}>
            Build with EAS to enable live tracking map
          </Text>
        </View>
        {markers.map((m, i) => (
          <MarkerPin
            key={m.id}
            type={m.type}
            x={80 + (i % 5) * 55}
            y={200 + (i % 3) * 100}
            onPress={() => onMarkerPress(m.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.mapBg}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/outdoors-v12"
        logoEnabled={false}
        attributionEnabled={false}
        // Mapbox's built-in compass is hidden — we draw our own as a
        // bottom-left chip so it sits in a predictable spot relative to
        // SOS (centre) and Place Flag (right). showCompass is also
        // gated on tracking state so a fresh map screen isn't cluttered.
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <CameraComponent
          followUserLocation={true}
          followZoomLevel={15}
          followPitch={0}
          // 600ms fly-in is welcoming on first launch but short
          // enough that users don't feel locked. Resume / re-entry
          // skips the animation entirely (instantCamera path).
          animationDuration={instantCamera ? 0 : 600}
          animationMode={instantCamera ? 'none' : 'flyTo'}
          // defaultSettings positions the camera on mount BEFORE
          // followUserLocation kicks in, so a resume sees the right
          // viewport on the first frame instead of an opening fly-in.
          defaultSettings={instantCamera && userPos
            ? { centerCoordinate: [userPos.lng, userPos.lat], zoomLevel: 15 }
            : undefined}
        />
        <UserLocationComponent visible={true} renderMode="native" />

        {/* Track polyline */}
        {trackPoints.length >= 2 && (
          <ShapeSource id="track-line" shape={trackGeoJSON}>
            <LineLayer
              id="track-line-layer"
              style={{
                lineColor: Colors.primary,
                lineWidth: 3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Approach line — dashed link from the user's current position
            to the start of a selected route. Only drawn when both
            endpoints exist and the user isn't already standing on the
            start (within ~50m). Helps the user see how to get to the
            trailhead from where they are. */}
        {routeStart && userPos && (() => {
          const distM = haversineM(userPos, routeStart);
          if (distM < 50) return null;
          return (
            <ShapeSource
              id="approach-line"
              shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [userPos.lng, userPos.lat],
                    [routeStart.lng, routeStart.lat],
                  ],
                },
                properties: {},
              }}
            >
              <LineLayer
                id="approach-line-layer"
                style={{
                  lineColor: Colors.severityCaution,
                  lineWidth: 3,
                  lineOpacity: 0.85,
                  lineDasharray: [2, 2],
                  lineCap: 'round',
                }}
              />
            </ShapeSource>
          );
        })()}
        {/* Route start pin */}
        {routeStart && (
          <PointAnnotation
            id="route-start"
            coordinate={[routeStart.lng, routeStart.lat]}
          >
            <View style={styles.routeStartPin}>
              <Icon name="Flag" size={12} color="#fff" strokeWidth={2.5} />
            </View>
          </PointAnnotation>
        )}

        {/* Markers */}
        {markers.map((m) => (
          <PointAnnotation
            key={m.id}
            id={m.id}
            coordinate={[m.lng, m.lat]}
            onSelected={() => onMarkerPress(m.id)}
          >
            <View style={[styles.markerPin, {
              borderColor: MARKER_META[m.type]?.color ?? Colors.textSecondary,
              backgroundColor: MARKER_META[m.type]?.bg ?? Colors.surface,
            }]}>
              <Icon
                name={(FLAG_TYPES.find(f => f.id === m.type)?.icon || 'Flag') as IconName}
                size={14}
                color={MARKER_META[m.type]?.color ?? Colors.textSecondary}
                strokeWidth={2.5}
              />
            </View>
          </PointAnnotation>
        ))}
      </MapView>
    </View>
  );
}

// ── Flag Plant Bottom Sheet — replaces ARFlagPicker + PlantNoteSheet ─────────
// Premium bottom sheet: type selection + optional note. No dark AR overlay.
function FlagPlantSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (type: MarkerType, note: string) => void;
}) {
  const [selectedType, setSelectedType] = useState<MarkerType | null>(null);
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const charCount = note.length;
  const canSave = selectedType !== null;

  // Slide-in animation
  const slideY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleSave = () => {
    if (!selectedType) return;
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onSave(selectedType, note));
  };

  return (
    <Animated.View style={[sheetStyles.backdrop, { opacity }]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={sheetStyles.handle} />
        {/* Header */}
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.title}>Plant a Flag</Text>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={handleClose}>
            <Icon name="X" size={IconSize.sm} color={Colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {/* Flag type row */}
        <View style={sheetStyles.typeRow}>
          {FLAG_TYPES.map(flag => (
            <TouchableOpacity
              key={flag.id}
              style={[sheetStyles.typeCard, selectedType === flag.id && { borderColor: Colors.primary, backgroundColor: Colors.primaryBg }]}
              onPress={() => { setSelectedType(flag.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[flag.bg, flag.bg.replace(')', ', 0.9)').replace('rgb', 'rgba')]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[sheetStyles.typeIconBadge, { borderColor: flag.color + '40' }]}
              >
                <Icon name={flag.icon} size={IconSize.md} color={flag.color} strokeWidth={2} />
              </LinearGradient>
              <Text style={[sheetStyles.typeLabel, { color: selectedType === flag.id ? Colors.primary : Colors.textSecondary }]}>
                {flag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Note input */}
        <View style={sheetStyles.noteWrap}>
          <TextInput
            style={[sheetStyles.noteInput, noteFocused && sheetStyles.noteInputFocused, charCount >= 50 && sheetStyles.noteInputError]}
            placeholder="Describe this spot… (optional)"
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={t => setNote(t.slice(0, 50))}
            multiline
            numberOfLines={2}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
          />
          <View style={sheetStyles.noteFooterRow}>
            <Text style={sheetStyles.noteMaxLabel}>Max 50 characters</Text>
            {(noteFocused || charCount > 0) && (
              <Text style={[sheetStyles.charCount, charCount >= 50 ? { color: Colors.danger } : charCount >= 40 ? { color: Colors.severityCaution } : null]}>{charCount}/50</Text>
            )}
          </View>
        </View>
        {/* Save button */}
        <TouchableOpacity
          style={[sheetStyles.saveBtn, !canSave && sheetStyles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={canSave ? 0.8 : 1}
        >
          <Icon name="Flag" size={IconSize.sm} color={canSave ? '#fff' : Colors.textMuted} strokeWidth={2} />
          <Text style={[sheetStyles.saveBtnText, !canSave && { color: Colors.textMuted }]}>Save Flag</Text>
        </TouchableOpacity>
      </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ── Flag Saved Toast ──────────────────────────────────────────────────────────
function FlagSavedToast({ onHide }: { onHide: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 14 }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(onHide);
      }, 1200);
    });
  }, []);
  return (
    <Animated.View style={[toastStyles.toast, { opacity, transform: [{ translateY: slideY }] }]}>
      <Icon name="CircleCheck" size={16} color={Colors.success} strokeWidth={2} />
      <Text style={toastStyles.text}>Flag saved</Text>
    </Animated.View>
  );
}

// ── Marker Detail Sheet ────────────────────────────────────────────────────
function MarkerDetailSheet({ marker, onClose, onDelete, lastCoordinate }: {
  marker: Marker;
  onClose: () => void;
  onDelete: () => void;
  lastCoordinate: { lat: number; lng: number } | null;
}) {
  const meta = MARKER_META[marker.type] || MARKER_META.free;
  const flagType = FLAG_TYPES.find(f => f.id === marker.type);
  const timeAgo = (() => {
    const diffMs = Date.now() - marker.createdAt;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  const coordStr = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
  const distToMarker = lastCoordinate
    ? haversineM(lastCoordinate, { lat: marker.lat, lng: marker.lng })
    : null;
  const distStr = distToMarker != null
    ? formatDistance(distToMarker, 'km', 1) + ' km away'
    : '--';

  // Slide-in animation — same easing/duration as FlagPlantSheet for consistency
  const slideY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleClose = () => {
    setDeleteConfirm(false);
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleDelete = () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDelete());
  };

  return (
    <Animated.View style={[detailStyles.container, { opacity }]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
      <Animated.View style={[detailStyles.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={detailStyles.handle} />
        <View style={detailStyles.headerRow}>
          <View style={[detailStyles.typeBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
            {flagType && <Icon name={flagType.icon} size={14} color={meta.color} strokeWidth={2.5} />}
            <Text style={[detailStyles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <TouchableOpacity style={detailStyles.closeChip} onPress={handleClose}>
            <Icon name="X" size={IconSize.sm} color={Colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {marker.note ? (
          <Text style={detailStyles.note}>{marker.note}</Text>
        ) : (
          <Text style={[detailStyles.note, { color: Colors.textMuted, fontStyle: 'italic' }]}>(No note)</Text>
        )}
        <View style={detailStyles.metaRow}>
          <Icon name="Timer" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
          <Text style={detailStyles.meta}>{timeAgo}</Text>
        </View>
        <View style={detailStyles.metaRow}>
          <Icon name="MapPin" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
          <Text style={detailStyles.meta}>{coordStr}</Text>
        </View>
        <View style={detailStyles.metaRow}>
          <Icon name="Route" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
          <Text style={detailStyles.meta}>{distStr}</Text>
        </View>
        {marker.approximate && (
          <View style={[detailStyles.metaRow, { backgroundColor: Colors.severityCautionBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }]}>
            <Icon name="Info" size={IconSize.sm} color={Colors.severityCaution} strokeWidth={1.8} />
            <Text style={[detailStyles.meta, { color: Colors.severityCaution }]}>
              Approximate position{marker.gpsAgeS != null && marker.gpsAgeS > 0
                ? ` (GPS was ${marker.gpsAgeS < 60 ? `${marker.gpsAgeS}s` : `${Math.round(marker.gpsAgeS / 60)}min`} old)`
                : ''}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[detailStyles.deleteBtn, deleteConfirm && { backgroundColor: Colors.danger }]}
          onPress={handleDelete}
        >
          <Icon name="Trash2" size={IconSize.sm} color={deleteConfirm ? '#fff' : Colors.danger} strokeWidth={2} />
          <Text style={[detailStyles.deleteBtnText, deleteConfirm && { color: '#fff' }]}>{deleteConfirm ? 'Confirm Delete' : 'Delete Flag'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Main HikingScreen ──────────────────────────────────────────────────────
type UIState = 'map' | 'plant' | 'detail';

export function HikingScreen() {
  const nav = useNavigation<Nav>();
  const { uiMode } = useAppStore();
  const isExpert = uiMode === 'expert';
  const insets = useSafeAreaInsets();

  // Real tracking store
  const status = useTrackingStore(s => s.status);
  const durationS = useTrackingStore(s => s.durationS);
  const distanceM = useTrackingStore(s => s.distanceM);
  const elevationGainM = useTrackingStore(s => s.elevationGainM);
  const locationAvailable = useTrackingStore(s => s.locationAvailable);
  const lastCoordinate = useTrackingStore(s => s.lastCoordinate);
  const sessionId = useTrackingStore(s => s.sessionId);
  const trackPoints = useTrackingStore(s => s.trackPoints);
  const startTracking = useTrackingStore(s => s.startTracking);
  const stopTracking = useTrackingStore(s => s.stopTracking);
  const linkMarker = useTrackingStore(s => s.linkMarker);

  // Real marker store
  const addMarker = useMarkerStore(s => s.addMarker);
  const deleteMarker = useMarkerStore(s => s.deleteMarker);
  const getMarkersForRegion = useMarkerStore(s => s.getMarkersForRegion);
  const region = getCurrentRegion();
  const markers = getMarkersForRegion(region.code);

  const [ui, setUi] = useState<UIState>('map');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  // Initialize phase from current tracking status — if user has an active hike
  // and re-enters this screen (Home → Hiking again), jump straight to the
  // tracking UI instead of forcing the route picker.
  const [phase, setPhase] = useState<'select' | 'tracking'>(() =>
    useTrackingStore.getState().status === 'tracking' ? 'tracking' : 'select',
  );
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Live compass: heading in degrees from north, updated by
  // watchHeadingAsync. compassEnabled toggles the sensor on/off so
  // the user can "close the lid" to save battery if they don't want
  // a live needle. Permission is shared with location, already
  // granted by the time the user is in tracking mode.
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(true);
  useEffect(() => {
    if (!compassEnabled) {
      setHeading(null);
      return;
    }
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        sub = await Location.watchHeadingAsync(({ trueHeading, magHeading }) => {
          if (cancelled) return;
          // Prefer trueHeading (geographic north) when available;
          // fall back to magHeading (magnetic north) — close enough
          // for a hiker's mental model. -1 means unavailable.
          const h = trueHeading >= 0 ? trueHeading : magHeading;
          if (h >= 0) setHeading(h);
        });
      } catch {
        // Compass unavailable — leave heading null, UI shows static
        // compass icon as a fallback.
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [compassEnabled]);

  const routes = useRouteStore(s => s.routes);
  const loadRoutes = useRouteStore(s => s.loadRoutes);
  const isTracking = status === 'tracking';

  useEffect(() => { loadRoutes(); }, []);

  // Pre-fetch a one-shot GPS fix on enter so the route picker can show
  // accurate distance-from-start labels and apply the "too far" filter
  // even before tracking starts. Without this, lastCoordinate is null
  // until startTracking, which is why the > 25km dim/disable logic was
  // visibly inactive on V8.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          if (!req.granted) return;
        }
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        // Only seed lastCoordinate when no tracking session is active —
        // an active session has its own watchPositionAsync stream and
        // we don't want to clobber a fresher value.
        const cur = useTrackingStore.getState();
        if (cur.status !== 'tracking') {
          useTrackingStore.setState({
            lastCoordinate: {
              lat: fix.coords.latitude,
              lng: fix.coords.longitude,
              alt: fix.coords.altitude ?? null,
            },
            lastCoordinateTime: Date.now(),
          });
        }
      } catch {
        // Permission denied or position unavailable — distance labels
        // will fall back to "no GPS" rendering. Non-fatal.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync phase with tracking status: if a hike is in progress (e.g. user
  // navigated away with the hike still running), show tracking UI; otherwise
  // show the route picker.
  useEffect(() => {
    if (status === 'tracking' && phase !== 'tracking') {
      setPhase('tracking');
    } else if (status === 'idle' && phase === 'tracking') {
      // Session ended (stopTracking); revert to selection screen for next hike.
      setPhase('select');
    }
  }, [status, phase]);

  // Spring press scales
  const trackBtnScale = useRef(new Animated.Value(1)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const springIn = (val: Animated.Value) =>
    Animated.spring(val, { toValue: 0.95, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const springOut = (val: Animated.Value) =>
    Animated.spring(val, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();

  // Keep screen awake while on this screen (activity in progress)
  useKeepAwake();

  const selectedMarker = markers.find(m => m.id === selectedMarkerId) ?? null;

  async function handlePlantSave(type: MarkerType, note: string) {
    // Use last GPS coordinate if available, else region center
    const lat = lastCoordinate?.lat ?? region.centerLat;
    const lng = lastCoordinate?.lng ?? region.centerLng;
    const marker = await addMarker({
      type,
      regionCode: region.code,
      lat,
      lng,
      note,
      authorId: 'local',
      permission: 'personal',
      sessionId: sessionId ?? undefined,
    });
    if (sessionId) linkMarker(marker.id);
    setUi('map');
    setShowSavedToast(true);
  }

  function handleDeleteMarker() {
    if (selectedMarkerId) {
      deleteMarker(selectedMarkerId);
    }
    setSelectedMarkerId(null);
    setUi('map');
  }

  const distDisplay = formatDistance(distanceM, 'km', 1);
  const durationDisplay = formatDuration(durationS);

  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const routePickerSlide = useRef(new Animated.Value(300)).current;
  const routePickerOpacity = useRef(new Animated.Value(0)).current;

  const openRoutePicker = () => {
    setShowRoutePicker(true);
    Animated.parallel([
      Animated.timing(routePickerSlide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(routePickerOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  };
  const closeRoutePicker = () => {
    Animated.parallel([
      Animated.timing(routePickerSlide, { toValue: 300, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(routePickerOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => setShowRoutePicker(false));
  };
  const pickRoute = (id: string | null) => {
    setSelectedRoute(id);
    closeRoutePicker();
  };

  const selectedRouteName = routes.find(r => r.id === selectedRoute)?.name ?? 'Free Hiking';

  // ── Phase 1: Route Selection ─────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <View style={styles.container}>
        <HikingMap markers={[]} trackPoints={[]} onMarkerPress={() => {}} />

        {/* Top overlay — uses safe-area inset directly so the chips
            never sit under the Dynamic Island / status bar regardless
            of the device. SafeAreaView inside an absolute parent
            doesn't reliably report insets, so we add them ourselves. */}
        <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.topRow}>
            <BackButton variant="pill" onPress={() => nav.goBack()} />
            <View style={[styles.gpsChip, styles.gpsChipAmber]}>
              <View style={[styles.gpsDot, { backgroundColor: Colors.severityWarning }]} />
              <Text style={[styles.gpsText, styles.gpsTextAmber]}>Enable GPS</Text>
            </View>
          </View>
        </View>

        {/* Bottom: route selector pill + start button */}
        <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
          <View style={styles.bottomPanel}>
            {/* Route selector pill — single row, card style */}
            <TouchableOpacity style={styles.routePill} onPress={openRoutePicker} activeOpacity={0.85}>
              <View style={styles.routePillIcon}>
                <Icon name={selectedRoute ? 'Route' : 'Target'} size={20} color={Colors.primary} strokeWidth={1.8} />
              </View>
              <View style={styles.routePillTextGroup}>
                <Text style={styles.routePillText} numberOfLines={1}>{selectedRouteName}</Text>
                <Text style={styles.routePillHint}>Tap to change route</Text>
              </View>
              <Icon name="ChevronUp" size={16} color={Colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Start button — full-width before tracking begins. The
                Place Flag FAB only makes sense once a session is live
                (you can't drop a flag at "your current GPS" if the
                session hasn't started recording yet). */}
            <Animated.View style={[{ height: 56 }, { transform: [{ scale: trackBtnScale }] }]}>
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); startTracking(); setPhase('tracking'); }}
                activeOpacity={1}
                onPressIn={() => springIn(trackBtnScale)}
                onPressOut={() => springOut(trackBtnScale)}
              >
                <Icon name="Play" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
                <Text style={styles.trackBtnText}>Start Hiking</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Route picker sheet — non-fullscreen, slides up from bottom */}
        {showRoutePicker && (
          <Animated.View style={[styles.routePickerBackdrop, { opacity: routePickerOpacity }]}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeRoutePicker} activeOpacity={1} />
            <Animated.View style={[styles.routePickerSheet, { transform: [{ translateY: routePickerSlide }] }]}>
              <View style={styles.routePickerHandle} />
              <Text style={styles.routePickerTitle}>Choose a route</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }} contentContainerStyle={{ gap: Spacing.sm }}>
                {/* Free Hiking */}
                <TouchableOpacity
                  style={[styles.routePickerRow, selectedRoute === null && styles.routePickerRowSelected]}
                  onPress={() => pickRoute(null)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.routePickerBadge, { backgroundColor: Colors.primaryLight }]}>
                    <Icon name="Target" size={16} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routePickerName}>Free Hiking</Text>
                    <Text style={styles.routePickerMeta}>No route · explore freely</Text>
                  </View>
                  {selectedRoute === null && <Icon name="Check" size={16} color={Colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>

                {/* Saved routes — show start-point distance from the
                    user. Routes whose start is more than 25km from the
                    current GPS fix are dimmed and made non-tappable;
                    starting a hike that requires driving 50km first
                    is rarely the user's intent and clutters the list. */}
                {routes.map(r => {
                  const startPt = r.points?.[0] ?? r.waypoints?.[0];
                  const distFromUser = (lastCoordinate && startPt)
                    ? haversineM(lastCoordinate, { lat: startPt.lat, lng: startPt.lng })
                    : null;
                  const TOO_FAR_M = 25_000;
                  const tooFar = distFromUser !== null && distFromUser > TOO_FAR_M;
                  const distLabel = distFromUser === null
                    ? null
                    : distFromUser < 100
                      ? '· at start'
                      : distFromUser < 1000
                        ? `· ${Math.round(distFromUser)}m away`
                        : `· ${(distFromUser / 1000).toFixed(1)}km away`;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.routePickerRow,
                        selectedRoute === r.id && styles.routePickerRowSelected,
                        tooFar && { opacity: 0.45 },
                      ]}
                      onPress={tooFar ? undefined : () => pickRoute(r.id)}
                      disabled={tooFar}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.routePickerBadge, { backgroundColor: Colors.primaryLight }]}>
                        <Icon name="Route" size={16} color={Colors.primary} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routePickerName}>{r.name}</Text>
                        <Text style={styles.routePickerMeta}>
                          {(r.distanceM / 1000).toFixed(1)} km
                          {r.elevationGainM > 0 ? ` · ↑${Math.round(r.elevationGainM)}m` : ''}
                          {r.runCount > 0 ? ` · ${r.runCount}× done` : ''}
                          {distLabel ? ` ${distLabel}` : ''}
                          {tooFar ? ' · too far' : ''}
                        </Text>
                      </View>
                      {selectedRoute === r.id && <Icon name="Check" size={16} color={Colors.primary} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    );
  }

  // ── Phase 2: Tracking ────────────────────────────────────────────────────

  // Get selected route points for polyline display
  const activeRoute = selectedRoute ? routes.find(r => r.id === selectedRoute) : null;
  const routePolyline = activeRoute?.points ?? [];

  return (
    <View style={styles.container}>
      <HikingMap
        markers={markers}
        trackPoints={trackPoints.map(tp => ({ lat: tp.lat, lng: tp.lng }))}
        onMarkerPress={(id) => { setSelectedMarkerId(id); setUi('detail'); }}
        routeStart={routePolyline.length > 0
          ? { lat: routePolyline[0].lat, lng: routePolyline[0].lng }
          : null}
        userPos={lastCoordinate ? { lat: lastCoordinate.lat, lng: lastCoordinate.lng } : null}
        // Skip the globe → location fly-in whenever we already know
        // where the user is. This covers all the cases where the user
        // expects the map to "just be there":
        //   - Resume tracking (isTracking + trackPoints already exist)
        //   - Re-entering Hiking from Home Last-row after a recent
        //     hike (lastCoordinate seeded by GPS prime effect)
        //   - Returning from another screen mid-hike
        // Only first-launch with no GPS fix yet gets the fly-in.
        instantCamera={lastCoordinate != null}
      />

      {/* Top overlay: back button (left) + GPS chip (right). Uses
          inset-aware paddingTop so chips never touch the Dynamic
          Island. */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <BackButton variant="pill" onPress={() => nav.goBack()} />
          <View style={[
            styles.gpsChip,
            status === 'idle' ? styles.gpsChipAmber : (!locationAvailable && styles.gpsChipOffline),
          ]}>
            <View style={[styles.gpsDot, {
              backgroundColor: locationAvailable
                ? Colors.success
                : status === 'idle' ? Colors.severityCaution : Colors.danger,
            }]} />
            <Text style={[
              styles.gpsText,
              status === 'idle' ? styles.gpsTextAmber : (!locationAvailable && styles.gpsTextOffline),
            ]}>
              {locationAvailable
                ? 'GPS'
                : status === 'idle' ? 'Enable GPS' : 'GPS Offline'}
            </Text>
          </View>
        </View>

        {/* Tracking stats bar */}
        {isTracking && (
          <View style={styles.trackingBar}>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValueLg}>{distDisplay}</Text>
              <Text style={styles.trackingUnit}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>{durationDisplay}</Text>
              <Text style={styles.trackingUnit}>elapsed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>+{elevationGainM}m</Text>
              <Text style={styles.trackingUnit}>elev</Text>
            </View>
            {isExpert && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.trackingStat}>
                  <Text style={styles.trackingValue}>--</Text>
                  <Text style={styles.trackingUnit}>brg</Text>
                </View>
              </>
            )}
            {selectedRoute && (
              <PressBtn
                style={styles.routeSwitchBtn}
                onPress={() => Alert.alert('Route', activeRoute?.name ?? 'Free Hiking', [
                  { text: 'Switch to Free', onPress: () => setSelectedRoute(null) },
                  { text: 'Cancel', style: 'cancel' },
                ])}
                scaleTo={0.9}
              >
                <Icon name="Route" size={12} color={Colors.primary} strokeWidth={2.5} />
              </PressBtn>
            )}
            <PressBtn
              style={styles.stopBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); stopTracking(); }}
              scaleTo={0.95}
            >
              <Icon name="Square" size={12} color="#fff" strokeWidth={3} />
              <Text style={styles.stopBtnText}>Stop</Text>
            </PressBtn>
          </View>
        )}
      </View>

      {/* Bottom controls. Three-column layout when tracking:
          [Compass]  [SOS]  [Place Flag]
          When pre-tracking, only the route picker + Start button are
          visible (no compass, no SOS, no flag). */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
        {!isTracking ? (
          // Pre-tracking: full-width Start button.
          <View style={styles.bottomRow}>
            <Animated.View style={[{ flex: 1, height: 60 }, { transform: [{ scale: trackBtnScale }] }]}>
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); startTracking(); }}
                activeOpacity={1}
                onPressIn={() => springIn(trackBtnScale)}
                onPressOut={() => springOut(trackBtnScale)}
              >
                <Icon name="Play" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
                <Text style={styles.trackBtnText}>Start Hiking</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          // Tracking: two evenly-spaced controls — Compass (left) +
          // Place Flag (right). Both 56x56 frosted-glass circles. The
          // compass tap recentres the camera bearing to north; flag
          // opens the AR placement screen.
          <View style={styles.controlRow}>
            <View style={styles.controlSlot}>
              <TouchableOpacity
                style={styles.circleBtn}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCompassEnabled(v => !v);
                }}
              >
                {compassEnabled ? (
                  // Live needle — rotates so it always points to north
                  // regardless of phone orientation. heading is the
                  // direction the phone is pointing; we rotate the
                  // icon by -heading so the icon's "up" stays north.
                  <View style={{
                    transform: [{ rotate: heading != null ? `${-heading}deg` : '0deg' }],
                  }}>
                    <Icon name="Navigation" size={22} color={Colors.primary} strokeWidth={2.5} />
                  </View>
                ) : (
                  // "Closed lid" state — sensor off, dimmed icon.
                  // Tap again to re-enable.
                  <Icon name="Compass" size={22} color={Colors.textMuted} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.controlSlot}>
              <Animated.View style={{ transform: [{ scale: fabScale }] }}>
                <TouchableOpacity
                  style={styles.circleBtnPrimary}
                  onPress={() => nav.navigate('AR')}
                  activeOpacity={1}
                  onPressIn={() => springIn(fabScale)}
                  onPressOut={() => springOut(fabScale)}
                >
                  <Icon name="Flag" size={22} color="#fff" strokeWidth={2} />
                  {markers.length > 0 && (
                    <View style={styles.fabBadge}>
                      <Text style={styles.fabBadgeText}>{markers.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}
      </View>

      {/* Marker Detail Sheet */}
      {ui === 'detail' && selectedMarker && (
        <MarkerDetailSheet
          marker={selectedMarker}
          onClose={() => { setSelectedMarkerId(null); setUi('map'); }}
          onDelete={handleDeleteMarker}
          lastCoordinate={lastCoordinate}
        />
      )}

      {/* Flag Saved Toast */}
      {showSavedToast && (
        <FlagSavedToast onHide={() => setShowSavedToast(false)} />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Map
  mapBg: { flex: 1, backgroundColor: Colors.primaryBg, overflow: 'hidden' },
  topoRing: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  trailLine: {
    position: 'absolute', top: 240, left: 60, right: 80,
    height: 2.5, backgroundColor: Colors.primaryMuted, borderRadius: 2,
  },
  trailLine2: {
    position: 'absolute', top: 240, left: 60, width: 140, height: 120,
    borderBottomWidth: 2.5, borderRightWidth: 2.5,
    borderColor: Colors.primaryMuted, borderBottomRightRadius: 20,
  },
  trailLine3: {
    position: 'absolute', top: 360, left: 200, width: 100, height: 80,
    borderBottomWidth: 2.5, borderLeftWidth: 2.5,
    borderColor: Colors.primaryDeep, borderBottomLeftRadius: 20,
  },
  locationDot: {
    position: 'absolute', top: 290, left: W / 2 - 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  locationDotInner: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.primary, borderWidth: 2.5, borderColor: '#fff',
  },
  locationPulse: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.primaryDeep,
  },
  mapLabelWrap: {
    position: 'absolute', bottom: 180, left: 0, right: 0,
    alignItems: 'center', gap: 6,
  },
  mapLabel: {
    fontSize: FontSize.h3, fontWeight: '600',
    color: Colors.primary, opacity: 0.7,
  },
  mapSubLabel: {
    fontSize: FontSize.small, color: Colors.primary, opacity: 0.5, marginTop: 2,
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.primaryMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 7, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  downloadBtnText: { fontSize: FontSize.small, fontWeight: '700', color: Colors.primary },
  markerPin: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, ...Shadow.card,
  },
  // Route start pin — distinct from regular markers so users can spot
  // the trailhead at a glance.
  routeStartPin: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.severityCaution,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },
  approxBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.severityCaution, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  approxBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Route selection (phase 1)
  bottomPanel: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm },
  routePill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary + '40',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 5,
  },
  routePillIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  routePillTextGroup: { flex: 1, gap: 1 },
  routePillText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routePillHint: { fontSize: FontSize.small, color: Colors.primary, fontWeight: '500' },
  routePillChevron: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  // Route picker sheet
  routePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    // Dim backdrop so the route picker reads as a modal layer instead
    // of a floating panel. Matches the rest of the app's bottom-sheet
    // language (FlagPlantSheet, MarkerDetailSheet, etc).
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  routePickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  routePickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.xs,
  },
  routePickerTitle: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  routePickerRow: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderLeftWidth: 3, borderLeftColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  routePickerRowSelected: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryBg, borderColor: Colors.primaryMuted },
  routePickerBadge: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  routePickerName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routePickerMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },

  // (kept for unused ref cleanup)
  selectSection: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg, gap: Spacing.sm },
  selectLabel: { fontSize: FontSize.small, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  routeCard: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  routeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  routeIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  routeCheck: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  // Top overlay
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // paddingTop is supplied by the topOverlay container inline
    // (insets.top + 8). Don't double-pad here, otherwise Back/GPS
    // chips drift further from the status bar than the rest of the
    // app (Home uses inset + Spacing.sm only).
    paddingHorizontal: Spacing.base, gap: Spacing.sm,
  },
  gpsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  gpsChipOffline: {
    backgroundColor: Colors.dangerBg,
  },
  gpsChipAmber: {
    backgroundColor: Colors.severityWarningBg,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textPrimary },
  gpsTextOffline: { color: Colors.danger },
  gpsTextAmber: { color: Colors.severityWarning },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  backChipText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.primary },

  trackingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginHorizontal: Spacing.base, marginTop: Spacing.sm,
    borderRadius: Radius.card, padding: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  trackingStat: { alignItems: 'center', flex: 1 },
  // Tracking stats panel — values intentionally compact (14pt) so the
  // panel doesn't dominate the map view. The numbers are reference
  // information; users glance at them, they don't read them like a
  // dashboard. Unit row stays small for the same reason.
  trackingValueLg: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'], lineHeight: 18 },
  trackingValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'], lineHeight: 18 },
  trackingUnit: { fontSize: 9, color: Colors.textSecondary, marginTop: 1, fontWeight: '500', letterSpacing: 0.2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  routeSwitchBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primary,
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.small },

  // Bottom overlay
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: Spacing.lg, paddingHorizontal: Spacing.base, gap: Spacing.sm,
  },
  // Three-column control bar shown while tracking. space-between so
  // the compass left + flag right align horizontally with the
  // Back/GPS chips in the top overlay (also space-between with the
  // same paddingHorizontal). User asked for left/right edges to
  // line up across top + bottom.
  controlRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg,
  },
  controlSlot: {
    alignItems: 'center', justifyContent: 'center',
  },
  // Two control buttons share one consistent shape — 56x56 circles
  // with a frosted-glass effect (translucent white + soft border +
  // diffuse shadow) so they read as floating UI on top of the map
  // rather than solid buttons. Same dimensions for both so the layout
  // is perfectly balanced left/right.
  circleBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
  },
  circleBtnPrimary: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  // Compass chip — bottom-left slot, mirrors the GPS chip in the top
  // overlay (same shadow, border, surface colour) so the page reads as
  // a coherent system rather than a pile of buttons.
  compassChip: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  trackBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.pill,
    height: 60,
    paddingHorizontal: Spacing.xl,
    borderWidth: 2, borderColor: Colors.primaryMuted,
    ...Shadow.card,
  },
  trackBtnText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.primary },
  fab: {
    width: 60, height: 60,
    backgroundColor: Colors.primary, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
  fabLabel: { fontSize: 8, color: '#fff', fontWeight: '700', marginTop: 1 },
  fabBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff',
  },
  fabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl, paddingBottom: Spacing.xxl + 8, gap: Spacing.md,
    ...Shadow.overlay,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeCard: {
    flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm,
    borderRadius: Radius.card, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, ...Shadow.card,
  },
  typeIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  typeLabel: { fontSize: FontSize.small, fontWeight: '700' },
  noteWrap: { position: 'relative' },
  noteInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, minHeight: 70,
    textAlignVertical: 'top',
  },
  noteInputFocused: {
    borderColor: Colors.primary,
  },
  noteInputError: {
    borderColor: Colors.danger,
  },
  noteFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, paddingHorizontal: 2,
  },
  noteMaxLabel: {
    fontSize: FontSize.tiny, color: Colors.textMuted,
  },
  charCount: {
    fontSize: FontSize.tiny, color: Colors.textMuted,
  },
  saveBtn: {
    borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.primary,
    flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
});

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 140, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    ...Shadow.elevated,
  },
  text: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary },
});



const detailStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.sm,
    ...Shadow.overlay,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1.5,
  },
  typeLabel: { fontSize: FontSize.caption, fontWeight: '700' },
  closeChip: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  note: { fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  meta: { fontSize: FontSize.small, color: Colors.textMuted },
  deleteBtn: {
    marginTop: Spacing.xs, borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.danger + '50',
    backgroundColor: Colors.dangerBg,
    flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center',
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.body },
});
