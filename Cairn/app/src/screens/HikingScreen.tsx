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
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  TextInput, Alert, PanResponder, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { useTrackingStore } from '../store/useTrackingStore';
import { useMarkerStore } from '../store/useMarkerStore';
import { getCurrentRegion } from '../config/regions';
import { formatDistance, formatDuration } from '../utils/geo';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon, type IconName } from '../components/Icon';
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
  corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}[] = [
  { id: 'danger',   icon: 'TriangleAlert', label: 'Danger',   color: Colors.danger,   bg: Colors.dangerBg,  corner: 'topLeft' },
  { id: 'scenic',   icon: 'Star',          label: 'Scenic',   color: Colors.info,     bg: Colors.infoBg,    corner: 'topRight' },
  { id: 'supply',   icon: 'Droplets',      label: 'Water',    color: Colors.success,  bg: Colors.successBg, corner: 'bottomLeft' },
  { id: 'junction', icon: 'Navigation2',   label: 'Junction', color: Colors.warning,  bg: Colors.warningBg, corner: 'bottomRight' },
];

const CORNER_POSITIONS: Record<string, { top?: number; bottom?: number; left?: number; right?: number }> = {
  topLeft:     { top: 48, left: 20 },
  topRight:    { top: 48, right: 20 },
  bottomLeft:  { bottom: 120, left: 20 },
  bottomRight: { bottom: 120, right: 20 },
};

// ── Marker pin on map ─────────────────────────────────────────────────────
function MarkerPin({ type, x, y, onPress }: {
  type: MarkerType; x: number; y: number; onPress: () => void;
}) {
  const meta = MARKER_META[type] || MARKER_META.free;
  const iconName = FLAG_TYPES.find(f => f.id === type)?.icon || 'Flag';
  return (
    <TouchableOpacity
      style={[styles.markerPin, { left: x, top: y, borderColor: meta.color, backgroundColor: meta.bg }]}
      onPress={onPress}
    >
      <Icon name={iconName as IconName} size={14} color={meta.color} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

// ── Map placeholder ──────────────────────────────────────────────────────
function MapPlaceholder({ markers, onMarkerPress }: {
  markers: Marker[];
  onMarkerPress: (id: string) => void;
}) {
  return (
    <View style={styles.mapBg}>
      {/* Topo elevation rings */}
      <View style={[styles.topoRing, { width: 340, height: 340, borderRadius: 170, top: 120, left: W / 2 - 170 }]} />
      <View style={[styles.topoRing, { width: 240, height: 240, borderRadius: 120, top: 170, left: W / 2 - 120 }]} />
      <View style={[styles.topoRing, { width: 150, height: 150, borderRadius: 75, top: 215, left: W / 2 - 75 }]} />
      <View style={[styles.topoRing, { width: 72, height: 72, borderRadius: 36, top: 254, left: W / 2 - 36, backgroundColor: 'rgba(93,124,70,0.07)' }]} />
      {/* Trail path */}
      <View style={styles.trailLine} />
      <View style={styles.trailLine2} />
      <View style={styles.trailLine3} />
      {/* Mountain silhouette hint */}
      <View style={styles.mountainLeft} />
      <View style={styles.mountainRight} />
      {/* Location dot */}
      <View style={styles.locationDot}>
        <View style={styles.locationDotInner} />
        <View style={styles.locationPulse} />
      </View>
      {/* Trail Map label */}
      <View style={styles.mapLabelWrap}>
        <Text style={styles.mapLabel}>Trail Map</Text>
        <Text style={styles.mapSubLabel}>Real map loads with offline pack</Text>
      </View>
      {/* Real marker pins */}
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

// ── AR Flag Picker — drag-from-corners ────────────────────────────────────────
// Drop zone: centred rect. Each corner flag has a PanResponder.
// Drag into drop zone bounds → highlight → on release → onPlant.
// Tap also works as fallback.
const DROP_ZONE = { x: W / 2 - 72, y: 200, w: 144, h: 144 };

function DraggableFlag({ flag, onPlant, onDropZoneEnter, onDropZoneLeave }: {
  flag: typeof FLAG_TYPES[0];
  onPlant: (type: MarkerType) => void;
  onDropZoneEnter: () => void;
  onDropZoneLeave: () => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const dragging = useRef(false);
  const overZone = useRef(false);

  const isInDropZone = (x: number, y: number) => {
    return (
      x > DROP_ZONE.x && x < DROP_ZONE.x + DROP_ZONE.w &&
      y > DROP_ZONE.y && y < DROP_ZONE.y + DROP_ZONE.h
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        const cornerPos = CORNER_POSITIONS[flag.corner];
        const absX = (cornerPos.left ?? (W - 84 - (cornerPos.right ?? 0))) + gestureState.moveX - gestureState.x0;
        const absY = (cornerPos.top ?? (500 - (cornerPos.bottom ?? 0))) + gestureState.moveY - gestureState.y0;
        const inZone = isInDropZone(gestureState.moveX, gestureState.moveY);
        if (inZone && !overZone.current) { overZone.current = true; onDropZoneEnter(); }
        if (!inZone && overZone.current) { overZone.current = false; onDropZoneLeave(); }
      },
      onPanResponderRelease: (_, gestureState) => {
        dragging.current = false;
        pan.flattenOffset();
        const inZone = isInDropZone(gestureState.moveX, gestureState.moveY);
        if (inZone) {
          overZone.current = false;
          onDropZoneLeave();
          onPlant(flag.id);
        } else {
          overZone.current = false;
          onDropZoneLeave();
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, tension: 200, friction: 8 }).start();
        }
      },
    })
  ).current;

  const pos = CORNER_POSITIONS[flag.corner];

  return (
    <Animated.View
      style={[
        arStyles.cornerFlag,
        pos,
        { backgroundColor: flag.bg, borderColor: flag.color },
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={arStyles.cornerFlagInner}
        onPress={() => onPlant(flag.id)}
        activeOpacity={0.75}
      >
        <Icon name={flag.icon} size={IconSize.md} color={flag.color} strokeWidth={2} />
        <Text style={[arStyles.cornerLabel, { color: flag.color }]}>{flag.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ARFlagPicker({ onClose, onPlant }: {
  onClose: () => void;
  onPlant: (type: MarkerType) => void;
}) {
  const [planted, setPlanted] = useState<MarkerType | null>(null);
  const [dropHighlight, setDropHighlight] = useState(false);

  const handlePlant = useCallback((type: MarkerType) => {
    setPlanted(type);
    setTimeout(() => onPlant(type), 350);
  }, [onPlant]);

  return (
    <View style={arStyles.overlay}>
      <View style={arStyles.cameraBg}>
        <Text style={arStyles.hint}>Drag a flag to the zone · or tap</Text>
        {/* Drop zone */}
        <View style={[
          arStyles.dropZone,
          dropHighlight && arStyles.dropZoneActive,
          { position: 'absolute', left: DROP_ZONE.x, top: DROP_ZONE.y, width: DROP_ZONE.w, height: DROP_ZONE.h },
        ]}>
          {planted ? (
            <Icon name="CircleCheck" size={40} color={Colors.success} strokeWidth={1.5} />
          ) : (
            <Icon name="Flag" size={32} color={dropHighlight ? Colors.primary : 'rgba(255,255,255,0.3)'} strokeWidth={1.5} />
          )}
          <Text style={[arStyles.dropZoneText, dropHighlight && { color: Colors.primary }]}>
            {planted ? 'Flag planted!' : 'Target zone'}
          </Text>
        </View>
      </View>

      {FLAG_TYPES.map(flag => (
        <DraggableFlag
          key={flag.id}
          flag={flag}
          onPlant={handlePlant}
          onDropZoneEnter={() => setDropHighlight(true)}
          onDropZoneLeave={() => setDropHighlight(false)}
        />
      ))}

      <TouchableOpacity style={arStyles.closeBtn} onPress={onClose}>
        <Icon name="X" size={IconSize.sm} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
        <Text style={arStyles.closeBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Plant Note Sheet ───────────────────────────────────────────────────────
function PlantNoteSheet({ flagType, onSave, onSkip }: {
  flagType: MarkerType;
  onSave: (note: string) => void;
  onSkip: () => void;
}) {
  const [note, setNote] = useState('');
  const flag = FLAG_TYPES.find(f => f.id === flagType) || FLAG_TYPES[0];

  return (
    <View style={noteStyles.container}>
      <View style={noteStyles.sheet}>
        <View style={[noteStyles.flagBadge, { backgroundColor: flag.bg, borderColor: flag.color }]}>
          <Icon name={flag.icon} size={IconSize.sm} color={flag.color} strokeWidth={2} />
          <Text style={[noteStyles.flagLabel, { color: flag.color }]}>{flag.label}</Text>
        </View>
        <Text style={noteStyles.title}>Add a note (optional)</Text>
        <TextInput
          style={noteStyles.input}
          placeholder="Describe this spot... (e.g. Slippery rocks, clean water source)"
          placeholderTextColor={Colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <View style={noteStyles.btnRow}>
          <TouchableOpacity style={noteStyles.skipBtn} onPress={onSkip}>
            <Text style={noteStyles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noteStyles.saveBtn} onPress={() => onSave(note)}>
            <Icon name="Flag" size={IconSize.sm} color="#fff" strokeWidth={2} />
            <Text style={noteStyles.saveBtnText}>Save Flag</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Marker Detail Sheet ────────────────────────────────────────────────────
function MarkerDetailSheet({ marker, onClose, onDelete }: {
  marker: Marker;
  onClose: () => void;
  onDelete: () => void;
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

  return (
    <View style={detailStyles.container}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <View style={detailStyles.sheet}>
        <View style={detailStyles.handle} />
        <View style={detailStyles.headerRow}>
          <View style={[detailStyles.typeBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
            {flagType && <Icon name={flagType.icon} size={14} color={meta.color} strokeWidth={2.5} />}
            <Text style={[detailStyles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <TouchableOpacity style={detailStyles.closeChip} onPress={onClose}>
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
        <TouchableOpacity
          style={detailStyles.deleteBtn}
          onPress={() => Alert.alert('Delete Flag', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ])}
        >
          <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
          <Text style={detailStyles.deleteBtnText}>Delete Flag</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main HikingScreen ──────────────────────────────────────────────────────
type UIState = 'map' | 'ar' | 'note' | 'detail';

export function HikingScreen() {
  const nav = useNavigation<Nav>();
  const { uiMode } = useAppStore();
  const isGuided = uiMode === 'guided';

  // Real tracking store
  const status = useTrackingStore(s => s.status);
  const durationS = useTrackingStore(s => s.durationS);
  const distanceM = useTrackingStore(s => s.distanceM);
  const elevationGainM = useTrackingStore(s => s.elevationGainM);
  const locationAvailable = useTrackingStore(s => s.locationAvailable);
  const lastCoordinate = useTrackingStore(s => s.lastCoordinate);
  const sessionId = useTrackingStore(s => s.sessionId);
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
  const [plantedFlag, setPlantedFlag] = useState<MarkerType | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const isTracking = status === 'tracking';

  // Keep screen awake while on this screen (activity in progress)
  useKeepAwake();

  const selectedMarker = markers.find(m => m.id === selectedMarkerId) ?? null;

  function handlePlantSave(note: string) {
    if (!plantedFlag) return;
    // Use last GPS coordinate if available, else region center
    const lat = lastCoordinate?.lat ?? region.centerLat;
    const lng = lastCoordinate?.lng ?? region.centerLng;
    const marker = addMarker({
      type: plantedFlag,
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

  return (
    <View style={styles.container}>
      <MapPlaceholder
        markers={markers}
        onMarkerPress={(id) => { setSelectedMarkerId(id); setUi('detail'); }}
      />

      {/* Top overlay: GPS chip + back button */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.gpsChip}>
            <View style={[styles.gpsDot, { backgroundColor: locationAvailable ? Colors.success : Colors.textMuted }]} />
            <Text style={styles.gpsText}>
              {locationAvailable ? 'GPS Connected ±5m' : 'GPS Offline'}
            </Text>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.backChip} onPress={() => nav.goBack()}>
              <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backChipText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tracking stats bar */}
        {isTracking && (
          <View style={styles.trackingBar}>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>{distDisplay}</Text>
              <Text style={styles.trackingUnit}>km</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>{durationDisplay}</Text>
              <Text style={styles.trackingUnit}>elapsed</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>+{elevationGainM}m</Text>
              <Text style={styles.trackingUnit}>elev</Text>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={stopTracking}>
              <Icon name="Square" size={12} color="#fff" strokeWidth={3} />
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Bottom FABs */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          {!isTracking ? (
            <TouchableOpacity style={styles.trackBtn} onPress={startTracking}>
              <Icon name="Play" size={IconSize.sm} color={Colors.textPrimary} strokeWidth={2.5} />
              <Text style={styles.trackBtnText}>Start Hiking</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity style={styles.fab} onPress={() => setUi('ar')}>
            <Icon name="Flag" size={IconSize.md} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* AR Flag Picker */}
      {ui === 'ar' && (
        <ARFlagPicker
          onClose={() => setUi('map')}
          onPlant={(type) => { setPlantedFlag(type); setUi('note'); }}
        />
      )}

      {/* Plant Note Sheet */}
      {ui === 'note' && plantedFlag && (
        <PlantNoteSheet
          flagType={plantedFlag}
          onSave={handlePlantSave}
          onSkip={() => { handlePlantSave(''); }}
        />
      )}

      {/* Marker Detail Sheet */}
      {ui === 'detail' && selectedMarker && (
        <MarkerDetailSheet
          marker={selectedMarker}
          onClose={() => { setSelectedMarkerId(null); setUi('map'); }}
          onDelete={handleDeleteMarker}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Map
  mapBg: { flex: 1, backgroundColor: '#e8f4e8', overflow: 'hidden' },
  topoRing: {
    position: 'absolute',
    borderWidth: 1, borderColor: 'rgba(93,124,70,0.18)',
    backgroundColor: 'transparent',
  },
  mountainLeft: {
    position: 'absolute', bottom: 260, left: 30,
    width: 0, height: 0,
    borderLeftWidth: 55, borderRightWidth: 55, borderBottomWidth: 80,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(93,124,70,0.09)',
  },
  mountainRight: {
    position: 'absolute', bottom: 255, left: 80,
    width: 0, height: 0,
    borderLeftWidth: 70, borderRightWidth: 70, borderBottomWidth: 100,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(93,124,70,0.07)',
  },
  trailLine: {
    position: 'absolute', top: 240, left: 60, right: 60,
    height: 3, backgroundColor: Colors.primary + '70', borderRadius: 2,
  },
  trailLine2: {
    position: 'absolute', top: 240, left: 60, width: 160, height: 130,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderColor: Colors.primary + '70', borderBottomRightRadius: 16,
  },
  trailLine3: {
    position: 'absolute', top: 370, left: 220, width: 120, height: 100,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderColor: Colors.primary + '50', borderBottomLeftRadius: 16,
  },
  locationDot: {
    position: 'absolute', top: 350, left: W / 2 - 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  locationDotInner: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary, borderWidth: 3, borderColor: '#fff',
  },
  locationPulse: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: Colors.primary + '60',
  },
  mapLabelWrap: {
    position: 'absolute', bottom: 160, left: 0, right: 0,
    alignItems: 'center',
  },
  mapLabel: {
    fontSize: FontSize.caption, fontWeight: '700',
    color: 'rgba(93,124,70,0.55)', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  mapSubLabel: {
    fontSize: FontSize.tiny, color: 'rgba(93,124,70,0.4)', marginTop: 2,
  },
  markerPin: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, ...Shadow.card,
  },

  // Top overlay
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: Spacing.sm,
  },
  gpsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textPrimary },
  topRight: { flexDirection: 'row', gap: Spacing.sm },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  backChipText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.primary },

  trackingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    marginHorizontal: Spacing.base, marginTop: Spacing.sm,
    borderRadius: Radius.card, padding: Spacing.md,
    gap: Spacing.base, ...Shadow.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  trackingStat: { alignItems: 'center', flex: 1 },
  trackingValue: { fontSize: FontSize.h3, fontWeight: '800', color: Colors.textPrimary },
  trackingUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary, marginTop: 1 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.small },

  // Bottom overlay
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  bottomRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg, gap: Spacing.sm,
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...Shadow.card,
  },
  trackBtnText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  fab: {
    backgroundColor: Colors.primary, borderRadius: Radius.circle,
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
  fabLabel: { fontSize: 8, color: '#fff', fontWeight: '700', marginTop: 1 },
});

const arStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,40,20,0.9)' },
  cameraBg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: FontSize.caption, letterSpacing: 0.5 },
  dropZone: {
    borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  dropZoneActive: {
    borderColor: Colors.primary, borderStyle: 'solid',
    backgroundColor: 'rgba(93,124,70,0.15)',
  },
  dropZoneText: { color: 'rgba(255,255,255,0.45)', fontSize: FontSize.small },
  cornerFlag: {
    position: 'absolute', width: 84, height: 84,
    borderRadius: 20, borderWidth: 2,
    zIndex: 10, ...Shadow.card,
  },
  cornerFlagInner: {
    flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 20,
  },
  cornerLabel: { fontSize: FontSize.small, fontWeight: '800' },
  closeBtn: {
    position: 'absolute', bottom: 52, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.pill, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
  },
  closeBtnText: { color: 'rgba(255,255,255,0.75)', fontWeight: '600', fontSize: FontSize.caption },
});

const noteStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.md,
  },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1.5,
  },
  flagLabel: { fontSize: FontSize.caption, fontWeight: '700' },
  title: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, minHeight: 80,
    textAlignVertical: 'top',
  },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  skipBtn: {
    flex: 1, borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border,
  },
  skipBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.body },
  saveBtn: {
    flex: 2, borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.primary,
    flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
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
