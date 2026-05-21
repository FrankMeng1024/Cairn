/**
 * ARScene — Augmented Reality marker viewing/placing scene.
 *
 * Uses device camera + GPS to render 3D markers at real-world positions.
 * GPS coordinates → relative position (bearing + distance from user).
 *
 * Architecture:
 * - AR framework: @viro-community/react-viro (if available) or expo-camera fallback
 * - GPS anchoring: converts lat/lng to XYZ offset relative to user position
 * - Mode exclusion: when AR active, map rendering is paused (battery saving)
 *
 * Sprint 51 — STORY-00173 (E-003: AR插旗)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, Radius } from '../components/tokens';
import { Icon } from '../components/Icon';
import { PressBtn } from '../components/PressBtn';
import { GlassPanel, Elevation } from '../components/GlassPanel';
import { useMarkerStore, type Marker } from '../store/useMarkerStore';
import { useTrackingStore } from '../store/useTrackingStore';
import { haversineM, type Coordinate } from '../utils/geo';
import { filterContent, type ContentLevel } from '../services/contentFilter';
import { checkMarkerSpacing } from '../utils/geo';

// ── Conditional camera import ────────────────────────────────────────────
// expo-camera is in package.json (added in v15 dep bump). Lazy-loaded
// so a build that lacks it (e.g. Expo Go) still renders the AR screen
// — it just falls back to the dark backdrop without a live camera
// feed. The placement / projection logic works identically in both
// modes; only the background changes.
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Mod = require('expo-camera');
  CameraView = Mod.CameraView;
  useCameraPermissions = Mod.useCameraPermissions;
} catch {
  // Camera module unavailable — fall through to backdrop-only AR.
}

// Screen dimensions (snapshotted at module load — fine for portrait
// AR; would need re-measure on rotation but Cairn is portrait-only).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Camera horizontal field-of-view in degrees. iPhone main rear camera
// is ~63° in 1x; Android cameras vary 60-70°. 65° is a reasonable
// middle that makes flag positions feel correct without per-device
// calibration. Future: query CameraView for actual FOV.
const CAMERA_FOV_DEG = 65;

// ── GPS → AR Coordinate Conversion ─────────────────────────────────────────

/**
 * Convert a GPS coordinate to a relative 3D position from the user.
 * Uses flat-earth approximation (valid for distances < 1km).
 *
 * Returns [x, y, z] in meters where:
 * - x = east (positive) / west (negative)
 * - y = altitude offset (positive = higher)
 * - z = north (negative — AR camera looks toward -Z)
 */
export function gpsToRelativeXYZ(
  userPos: Coordinate,
  markerPos: Coordinate,
  userHeading: number,  // device compass heading in degrees
): [number, number, number] {
  // Calculate north/east offsets in meters
  const dLat = markerPos.lat - userPos.lat;
  const dLng = markerPos.lng - userPos.lng;

  // Approximate meters (1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat))
  const northM = dLat * 111000;
  const eastM = dLng * 111000 * Math.cos(userPos.lat * Math.PI / 180);

  // Rotate by user heading (so markers appear in correct direction)
  const headingRad = (userHeading * Math.PI) / 180;
  const x = eastM * Math.cos(headingRad) - northM * Math.sin(headingRad);
  const z = -(eastM * Math.sin(headingRad) + northM * Math.cos(headingRad));

  // Altitude offset (default 0 if not available)
  const y = ((markerPos.alt ?? 0) - (userPos.alt ?? 0)) || 0;

  return [x, y, z];
}

/**
 * Calculate bearing from user to marker (0-360, 0=North).
 */
export function bearingTo(from: Coordinate, to: Coordinate): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;

  return (bearing + 360) % 360;
}

// ── AR Marker Type → 3D Config ──────────────────────────────────────────────

export interface AR3DConfig {
  color: string;
  glowColor: string;
  shape: 'cone' | 'box' | 'sphere' | 'cylinder';
  scale: number;
  label: string;
}

export function getAR3DConfig(type: string): AR3DConfig {
  switch (type) {
    case 'danger':
      return { color: '#c53d2e', glowColor: '#ff6b5a', shape: 'cone', scale: 1.2, label: 'Danger' };
    case 'scenic':
      return { color: '#2e6cc5', glowColor: '#6ba3ff', shape: 'sphere', scale: 1.0, label: 'Scenic' };
    case 'supply':
      return { color: '#2e8c3a', glowColor: '#5cd46a', shape: 'box', scale: 1.0, label: 'Supply' };
    case 'junction':
      return { color: '#b36b00', glowColor: '#ffa940', shape: 'cylinder', scale: 0.8, label: 'Junction' };
    default:
      return { color: '#8c7e72', glowColor: '#b5a99d', shape: 'sphere', scale: 0.8, label: 'Marker' };
  }
}

// ── AR Visibility Ranges ────────────────────────────────────────────────────

/** Maximum distance to render AR markers (meters) */
export const AR_MAX_RANGE_M = 500;

/** Minimum distance for "snap to marker" interaction */
export const AR_SNAP_RANGE_M = 5;

/** Scale factor based on distance (closer = bigger) */
export function getDistanceScale(distanceM: number): number {
  if (distanceM <= 10) return 1.5;
  if (distanceM <= 50) return 1.2;
  if (distanceM <= 100) return 1.0;
  if (distanceM <= 200) return 0.7;
  return 0.5;
}

// ── AR Permission Visibility ────────────────────────────────────────────────

export interface ARMarkerVisual {
  opacity: number;
  hasAvatarRing: boolean;
  hasDashedRing: boolean;
}

/** Visual distinction for personal/friend/community markers in AR */
export function getPermissionVisual(permission: string): ARMarkerVisual {
  switch (permission) {
    case 'personal':
      return { opacity: 1.0, hasAvatarRing: false, hasDashedRing: false };
    case 'group':
      return { opacity: 0.75, hasAvatarRing: true, hasDashedRing: false };
    case 'public':
      return { opacity: 0.6, hasAvatarRing: false, hasDashedRing: true };
    default:
      return { opacity: 1.0, hasAvatarRing: false, hasDashedRing: false };
  }
}

// ── AR Screen Component (Fallback — no ViroReact available) ─────────────────

interface ARScreenProps {
  onClose?: () => void;
  onPlaceMarker?: (lat: number, lng: number) => void;
}

// Flag type config
const FLAG_TYPES: { id: 'danger' | 'scenic' | 'supply' | 'junction'; icon: string; label: string; color: string; bg: string }[] = [
  { id: 'danger',   icon: 'TriangleAlert', label: 'Danger',   color: '#c53d2e',  bg: '#fde8ea' },
  { id: 'scenic',   icon: 'Star',          label: 'Scenic',   color: '#3b82f6',  bg: '#e8f1fb' },
  { id: 'supply',   icon: 'Droplets',      label: 'Water',    color: '#22c55e',  bg: '#e8f8ef' },
  { id: 'junction', icon: 'Navigation2',   label: 'Junction', color: '#f59e0b',  bg: '#fef3e2' },
];

/**
 * AR Screen — compass-based directional view + Place Flag flow.
 *
 * GPS degradation logic:
 * - Has fresh GPS (< 30s) → normal placement
 * - Has stale GPS (> 30s) or lost signal → degraded placement with toast
 * - Never had GPS → blocked
 */

// ── AR flag overlay ───────────────────────────────────────────────────────
// Projects each nearby marker onto screen-space using:
//   bearing = bearingTo(user, marker)        // 0-360°, geographic
//   relative = bearing - userHeading          // -180 to +180
//   if |relative| > FOV/2 → marker is outside camera view
//   screenX = SCREEN_W/2 + (relative / (FOV/2)) * (SCREEN_W/2)
// Vertical position scales with distance (closer = lower on screen,
// further = higher), giving a soft "depth" cue without true 3D math.
// Size shrinks logarithmically with distance so a flag 50m away looks
// distinctly bigger than one 500m away.
//
// Markers behind the user (|relative| > 90°) render as edge arrows so
// users know which way to turn to see them.
function ARFlagOverlay({
  markers,
  userPos,
  userHeading,
}: {
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
  userHeading: number | null;
}) {
  if (!userPos || userHeading == null || markers.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {markers.map(m => {
        const distM = haversineM(userPos, { lat: m.lat, lng: m.lng });
        if (distM > AR_MAX_RANGE_M) return null; // out of sensible range

        const bearing = bearingTo(userPos, { lat: m.lat, lng: m.lng });
        // Normalize relative to -180..180
        let relative = bearing - userHeading;
        while (relative > 180) relative -= 360;
        while (relative < -180) relative += 360;

        const config = getAR3DConfig(m.type);
        const halfFov = CAMERA_FOV_DEG / 2;
        const inView = Math.abs(relative) <= halfFov;

        if (inView) {
          // Inside the camera FOV — project to screen X.
          const screenX = SCREEN_W / 2 + (relative / halfFov) * (SCREEN_W / 2);
          // Vertical: closer markers sit lower (toward foreground / ground),
          // far markers drift up toward the horizon. Range 35-70% of
          // screen height. Matches the real-world mental model where
          // distant things are higher in the visual field.
          const t = Math.min(distM / AR_MAX_RANGE_M, 1);
          const screenY = SCREEN_H * (0.70 - 0.35 * t);
          // Size: 56px at 0m → 24px at AR_MAX_RANGE_M (logarithmic feel).
          const size = Math.max(24, 56 - (distM / AR_MAX_RANGE_M) * 32);

          return (
            <View
              key={m.id}
              style={[
                arOverlayStyles.flag,
                {
                  left: screenX - size / 2,
                  top: screenY - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: config.color,
                  opacity: 0.9 - 0.3 * t, // far ones slightly dimmed
                },
              ]}
            >
              <Icon name="Flag" size={Math.max(14, size * 0.5)} color="#fff" strokeWidth={2.5} />
              <View style={arOverlayStyles.distChip}>
                <Text style={arOverlayStyles.distText}>
                  {distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`}
                </Text>
              </View>
            </View>
          );
        }

        // Out of view — render edge arrow (left or right) at the
        // marker's vertical band so users can turn toward it. Same
        // depth-coding as in-view markers: closer = lower screen.
        const onLeft = relative < 0;
        const t = Math.min(distM / AR_MAX_RANGE_M, 1);
        const arrowY = SCREEN_H * (0.70 - 0.35 * t);
        return (
          <View
            key={m.id}
            style={[
              arOverlayStyles.edgeArrow,
              {
                top: arrowY - 14,
                [onLeft ? 'left' : 'right']: 8,
              },
            ]}
          >
            <Icon
              name={onLeft ? 'ChevronLeft' : 'ChevronRight'}
              size={20}
              color={config.color}
              strokeWidth={3}
            />
          </View>
        );
      })}
    </View>
  );
}

const arOverlayStyles = StyleSheet.create({
  flag: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  distChip: {
    position: 'absolute', bottom: -16,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  distText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  edgeArrow: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
});

// ── 2D Compass Dial — replacement for the camera placeholder ──────────────
function CompassDial({
  userHeading,
  markers,
  userPos,
}: {
  userHeading: number | null;
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
}) {
  // Heading drives the dial rotation: dial rotates opposite to heading so
  // the cardinal mark (N) always points to true north.
  const rotateDeg = userHeading != null ? -userHeading : 0;

  // Compute each marker's bearing-relative-to-heading for arrow placement.
  const arrows = useMemo(() => {
    if (!userPos) return [];
    return markers.map((m) => {
      const bearing = bearingTo(userPos, { lat: m.lat, lng: m.lng });
      const relative = userHeading != null
        ? (bearing - userHeading + 360) % 360
        : bearing;
      const dist = Math.round(haversineM(userPos, { lat: m.lat, lng: m.lng }));
      return { marker: m, relative, dist };
    });
  }, [markers, userPos, userHeading]);

  return (
    <View style={dialStyles.wrap}>
      {/* Dial face — rotates so N stays pointing to true north */}
      <View style={[dialStyles.dial, { transform: [{ rotate: `${rotateDeg}deg` }] }]}>
        {/* Cardinal direction marks */}
        <Text style={[dialStyles.cardinal, { top: 8 }]}>N</Text>
        <Text style={[dialStyles.cardinal, { right: 8 }]}>E</Text>
        <Text style={[dialStyles.cardinal, { bottom: 8 }]}>S</Text>
        <Text style={[dialStyles.cardinal, { left: 8 }]}>W</Text>

        {/* Outer ring */}
        <View style={dialStyles.ring} />

        {/* Marker arrows — positioned around the dial at their bearing */}
        {arrows.map(({ marker, relative, dist }) => {
          const config = getAR3DConfig(marker.type);
          const angleRad = (relative * Math.PI) / 180;
          // Place the arrow at radius=92 from dial center
          const x = Math.sin(angleRad) * 92;
          const y = -Math.cos(angleRad) * 92;
          return (
            <View
              key={marker.id}
              style={[
                dialStyles.arrowAnchor,
                { transform: [{ translateX: x }, { translateY: y }, { rotate: `${relative}deg` }] },
              ]}
            >
              <View style={[dialStyles.arrowChevron, { borderBottomColor: config.color }]} />
              <Text style={[dialStyles.arrowDist, { color: config.color }]}>{dist}m</Text>
            </View>
          );
        })}

        {/* Center pip */}
        <View style={dialStyles.centerPip} />
      </View>

      {userHeading == null && (
        <Text style={dialStyles.headingHint}>
          Heading unavailable — calibrate phone or grant location.
        </Text>
      )}
    </View>
  );
}

const dialStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Transparent when camera background is rendering; falls through
    // to container's #000 if the camera is unavailable. Dial elements
    // have their own contrast (white text on dark ring) so readable
    // either way.
    backgroundColor: 'transparent',
  },
  dial: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  cardinal: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.5,
  },
  arrowAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  arrowChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDist: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  centerPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  headingHint: {
    position: 'absolute',
    bottom: 24,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

export function ARScreen({ onClose, onPlaceMarker }: ARScreenProps) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const markers = useMarkerStore(s => s.markers);
  const addMarker = useMarkerStore(s => s.addMarker);
  const lastCoord = useTrackingStore(s => s.lastCoordinate);
  const lastCoordTime = useTrackingStore(s => s.lastCoordinateTime);
  const trackPoints = useTrackingStore(s => s.trackPoints);
  const sessionId = useTrackingStore(s => s.sessionId);
  const linkMarker = useTrackingStore(s => s.linkMarker);

  const [showFlagSheet, setShowFlagSheet] = useState(false);
  const [placementCoord, setPlacementCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [isApproximate, setIsApproximate] = useState(false);
  const [gpsAgeS, setGpsAgeS] = useState(0);
  const [degradedToast, setDegradedToast] = useState<string | null>(null);
  // Live compass heading from expo-location (0=N, 90=E, etc).
  // null until first heading update or if heading unavailable.
  const [userHeading, setUserHeading] = useState<number | null>(null);

  // Subscribe to magnetic heading on mount; expo-location is already a dep.
  // Requests permission first — without it, watchHeadingAsync silently
  // returns no events on iOS. Falls back gracefully if denied or unavailable.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const Location = await import('expo-location');
        // Ensure foreground location is granted; heading API depends on it.
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          // Heading stays null → CompassDial shows "Heading unavailable" hint.
          return;
        }
        sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          // trueHeading is most accurate but may be -1 on simulator;
          // fall back to magHeading.
          const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (heading >= 0) setUserHeading(heading);
        });
      } catch {
        // Heading unavailable — UI shows static dial
      }
    })();
    return () => {
      cancelled = true;
      try { sub?.remove(); } catch { /* no-op */ }
    };
  }, []);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Refs for any pending timers — must be cleared on unmount to prevent
  // calling setState/nav.goBack on an already-unmounted component.
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const degradedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      if (degradedToastTimerRef.current) clearTimeout(degradedToastTimerRef.current);
    };
  }, []);

  // Filter markers within AR range
  const nearbyMarkers = markers.filter(m => {
    if (!lastCoord) return false;
    const dist = haversineM({ lat: lastCoord.lat, lng: lastCoord.lng }, { lat: m.lat, lng: m.lng });
    return dist <= AR_MAX_RANGE_M;
  });

  const handlePlaceMarker = () => {
    // Branch 1: Never had GPS
    if (!lastCoord && trackPoints.length === 0) {
      Alert.alert(
        'No GPS Available',
        'GPS has not yet acquired a position. Move to an open area and wait for a GPS fix.',
      );
      return;
    }

    // Determine coordinate and staleness
    let coord = lastCoord;
    let approximate = false;
    let age = 0;

    if (!lastCoord && trackPoints.length > 0) {
      // Branch 2: Lost GPS — use last trackpoint
      const lastTP = trackPoints[trackPoints.length - 1];
      coord = { lat: lastTP.lat, lng: lastTP.lng, alt: lastTP.alt };
      age = Math.round((Date.now() - lastTP.t) / 1000);
      approximate = true;
    } else if (lastCoord && lastCoordTime) {
      // Branch 3: Have coord — check staleness
      age = Math.round((Date.now() - lastCoordTime) / 1000);
      if (age > 30) approximate = true;
    }

    // Check spacing
    const spacing = checkMarkerSpacing(
      { lat: coord!.lat, lng: coord!.lng },
      markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng })),
    );
    if (!spacing.allowed) {
      Alert.alert(
        'Too Close',
        `You have a marker ${Math.round(spacing.nearestDistM)}m away. Markers must be at least 20m apart.`,
      );
      return;
    }

    // Show degraded toast
    if (approximate) {
      const ageText = age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age / 60)}min` : `${Math.round(age / 3600)}h`;
      setDegradedToast(`Using last known location (${ageText} ago)`);
      if (degradedToastTimerRef.current) clearTimeout(degradedToastTimerRef.current);
      degradedToastTimerRef.current = setTimeout(() => setDegradedToast(null), 4000);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlacementCoord({ lat: coord!.lat, lng: coord!.lng });
    setIsApproximate(approximate);
    setGpsAgeS(age);
    setSelectedType(null);
    setNote('');
    setShowFlagSheet(true);
  };

  const handleSaveFlag = async () => {
    if (!selectedType || !placementCoord) return;
    const marker = await addMarker({
      type: selectedType as any,
      regionCode: 'nz',
      lat: placementCoord.lat,
      lng: placementCoord.lng,
      note,
      authorId: 'local',
      permission: 'personal',
      sessionId: sessionId ?? undefined,
      approximate: isApproximate || undefined,
      gpsAgeS: isApproximate ? gpsAgeS : undefined,
    });
    if (sessionId) linkMarker(marker.id);
    setShowFlagSheet(false);
    setSavedToast(true);
    // Shorter delay (was 1200ms) — user already sees the toast for ~700ms before
    // navigation animates back. The pending timer is canceled on unmount.
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(() => { setSavedToast(false); nav.goBack(); }, 800);
  };

  // Camera permission — request on mount when expo-camera is present.
  // Hook is called only if useCameraPermissions exists (conditional
  // import). When the module is missing, perm is undefined and we
  // fall through to the dark backdrop.
  const [cameraPerm, requestCameraPerm] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => null];
  useEffect(() => {
    if (!useCameraPermissions) return;
    if (cameraPerm && !cameraPerm.granted && cameraPerm.canAskAgain) {
      requestCameraPerm();
    }
  }, [cameraPerm?.granted]);

  return (
    <View style={styles.container}>
      {/* Camera background — live rear camera feed at the very bottom
          of the z-stack. All AR overlays + compass dial + sheets layer
          on top. If expo-camera is unavailable or permission denied,
          the existing dark backdrop shows instead (CompassDial + UI
          read fine against either). */}
      {CameraView && cameraPerm?.granted && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
        />
      )}

      {/* AR flag overlay — projects nearby markers onto screen-space
          so the user sees them anchored to real-world directions.
          Renders above camera, below UI controls. Only meaningful
          when both userPos and heading are known. */}
      <ARFlagOverlay
        markers={nearbyMarkers}
        userPos={lastCoord ? { lat: lastCoord.lat, lng: lastCoord.lng } : null}
        userHeading={userHeading}
      />

      {/* Compass dial — directional indicators replace static AR placeholder.
          Each visible nearby marker shows a chevron arrow at its bearing
          relative to current device heading. */}
      <CompassDial
        userHeading={userHeading}
        markers={nearbyMarkers.slice(0, 5)}
        userPos={lastCoord ? { lat: lastCoord.lat, lng: lastCoord.lng } : null}
      />

      {/* Nearby markers directional list */}
      <GlassPanel intensity={16} tint="dark" style={styles.markerPanel} borderRadius={16}>
        <Text style={styles.panelTitle}>
          {nearbyMarkers.length} marker{nearbyMarkers.length !== 1 ? 's' : ''} nearby
        </Text>
        {nearbyMarkers.slice(0, 5).map(m => {
          const dist = lastCoord
            ? Math.round(haversineM({ lat: lastCoord.lat, lng: lastCoord.lng }, { lat: m.lat, lng: m.lng }))
            : 0;
          const config = getAR3DConfig(m.type);
          return (
            <View key={m.id} style={styles.markerRow}>
              <View style={[styles.markerDot, { backgroundColor: config.color }]} />
              <Text style={styles.markerLabel}>{config.label}</Text>
              <Text style={styles.markerDist}>{dist}m</Text>
            </View>
          );
        })}
      </GlassPanel>

      {/* Top controls — uses safe-area inset so X button clears the
          status bar / Dynamic Island on every device. */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <PressBtn style={styles.closeBtn} onPress={() => onClose ? onClose() : nav.goBack()} scaleTo={0.92}>
          <Icon name="X" size={20} color="#fff" />
        </PressBtn>
      </View>

      {/* Place marker FAB */}
      {!showFlagSheet && (
        <TouchableOpacity style={styles.placeFab} onPress={handlePlaceMarker}>
          <Icon name="MapPin" size={24} color="#fff" />
          <Text style={styles.fabText}>Place Flag</Text>
        </TouchableOpacity>
      )}

      {/* Degraded GPS toast */}
      {degradedToast && (
        <View style={styles.degradedBanner}>
          <Icon name="Info" size={14} color="#f59e0b" />
          <Text style={styles.degradedText}>{degradedToast}</Text>
        </View>
      )}

      {/* Flag type selection sheet */}
      {showFlagSheet && (
        <View style={styles.flagSheet}>
          <Text style={styles.flagSheetTitle}>Select Flag Type</Text>
          <View style={styles.flagTypeRow}>
            {FLAG_TYPES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.flagTypeCard, selectedType === f.id && { borderColor: Colors.primary, borderWidth: 2 }]}
                onPress={() => setSelectedType(f.id)}
              >
                <Icon name={f.icon as any} size={22} color={f.color} />
                <Text style={[styles.flagTypeLabel, { color: selectedType === f.id ? Colors.primary : '#ccc' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {isApproximate && (
            <View style={styles.approxWarning}>
              <Icon name="Info" size={12} color="#f59e0b" />
              <Text style={styles.approxWarningText}>Approximate position — GPS was {gpsAgeS < 60 ? `${gpsAgeS}s` : `${Math.round(gpsAgeS / 60)}min`} old</Text>
            </View>
          )}
          <View style={styles.flagSheetActions}>
            <TouchableOpacity style={styles.flagCancelBtn} onPress={() => setShowFlagSheet(false)}>
              <Text style={styles.flagCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.flagSaveBtn, !selectedType && { opacity: 0.4 }]}
              onPress={handleSaveFlag}
              disabled={!selectedType}
            >
              <Icon name="Flag" size={16} color="#fff" />
              <Text style={styles.flagSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Saved toast */}
      {savedToast && (
        <View style={styles.savedToast}>
          <Icon name="CircleCheck" size={16} color="#22c55e" />
          <Text style={styles.savedToastText}>Flag saved</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' /* fallback when no camera */ },
  cameraPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  placeholderText: {
    fontSize: FontSize.h2, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.md,
  },
  placeholderSubtext: {
    fontSize: FontSize.caption, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', marginTop: Spacing.xs,
  },
  markerPanel: {
    position: 'absolute', bottom: 100, left: Spacing.md, right: Spacing.md,
    padding: Spacing.md,
  },
  panelTitle: {
    fontSize: FontSize.caption, fontWeight: '600', color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.sm,
  },
  markerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 4,
  },
  markerDot: { width: 10, height: 10, borderRadius: 5 },
  markerLabel: { flex: 1, fontSize: FontSize.body, color: '#fff' },
  markerDist: { fontSize: FontSize.caption, color: 'rgba(255,255,255,0.6)' },
  topBar: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  placeFab: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: 30,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...Elevation[4],
  },
  fabText: { fontSize: FontSize.body, fontWeight: '700', color: '#fff' },
  degradedBanner: {
    position: 'absolute', top: 110, left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: Radius.card,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  degradedText: { fontSize: FontSize.caption, color: '#f59e0b', flex: 1 },
  flagSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, paddingBottom: 40,
  },
  flagSheetTitle: { fontSize: FontSize.h3, fontWeight: '700', color: '#fff', marginBottom: Spacing.md },
  flagTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  flagTypeCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md,
    borderRadius: Radius.card, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  flagTypeLabel: { fontSize: FontSize.small, fontWeight: '600' },
  approxWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
  },
  approxWarningText: { fontSize: FontSize.small, color: '#f59e0b' },
  flagSheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  flagCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.button, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  flagCancelText: { fontSize: FontSize.body, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  flagSaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.md, borderRadius: Radius.button,
    backgroundColor: Colors.primary,
  },
  flagSaveText: { fontSize: FontSize.body, fontWeight: '700', color: '#fff' },
  savedToast: {
    position: 'absolute', top: '45%' as any, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  savedToastText: { fontSize: FontSize.body, fontWeight: '600', color: '#fff' },
});
