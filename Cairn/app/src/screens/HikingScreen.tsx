/**
 * HikingScreen — Sprint 14 real GPS tracking
 *
 * States:
 * 1. Map view: full-screen map placeholder, GPS chip, back chip, FAB
 * 2. Tracking: stats bar appears above map
 * 3. AR flag picker: tap a corner flag type to plant
 * 4. Plant note sheet: optional note before saving
 * 5. Marker detail sheet: view / delete a marker
 *
 * expo-keep-awake: activates when status === 'tracking'
 * Real stores: useTrackingStore (GPS), useMarkerStore (flags)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  TextInput, Alert,
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
  { id: 'danger',   icon: 'TriangleAlert', label: '危险', color: Colors.danger,   bg: Colors.dangerBg,  corner: 'topLeft' },
  { id: 'scenic',   icon: 'Star',          label: '风景', color: Colors.info,     bg: Colors.infoBg,    corner: 'topRight' },
  { id: 'supply',   icon: 'Droplets',      label: '补给', color: Colors.success,  bg: Colors.successBg, corner: 'bottomLeft' },
  { id: 'junction', icon: 'Navigation2',   label: '路口', color: Colors.warning,  bg: Colors.warningBg, corner: 'bottomRight' },
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
      {/* Topo-style grid */}
      {Array.from({ length: 12 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, col) => (
          <View key={`${row}-${col}`} style={[styles.gridCell, { top: row * 80, left: col * 50 }]} />
        ))
      )}
      {/* Trail path */}
      <View style={styles.trailLine} />
      <View style={styles.trailLine2} />
      <View style={styles.trailLine3} />
      {/* Location dot */}
      <View style={styles.locationDot}>
        <View style={styles.locationDotInner} />
        <View style={styles.locationPulse} />
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

// ── AR Flag Picker ─────────────────────────────────────────────────────────
function ARFlagPicker({ onClose, onPlant }: {
  onClose: () => void;
  onPlant: (type: MarkerType) => void;
}) {
  const [planted, setPlanted] = useState<MarkerType | null>(null);

  return (
    <View style={arStyles.overlay}>
      <View style={arStyles.cameraBg}>
        <Text style={arStyles.hint}>选择旗帜类型并点击</Text>
        <View style={arStyles.dropZone}>
          {planted ? (
            <Icon name="CircleCheck" size={40} color={Colors.success} strokeWidth={1.5} />
          ) : (
            <Icon name="Flag" size={32} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          )}
          <Text style={arStyles.dropZoneText}>{planted ? '插旗成功' : '目标区域'}</Text>
        </View>
      </View>

      {FLAG_TYPES.map(flag => (
        <TouchableOpacity
          key={flag.id}
          style={[arStyles.cornerFlag, CORNER_POSITIONS[flag.corner], { backgroundColor: flag.bg, borderColor: flag.color }]}
          onPress={() => {
            setPlanted(flag.id);
            setTimeout(() => onPlant(flag.id), 350);
          }}
          activeOpacity={0.75}
        >
          <Icon name={flag.icon} size={IconSize.md} color={flag.color} strokeWidth={2} />
          <Text style={[arStyles.cornerLabel, { color: flag.color }]}>{flag.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={arStyles.closeBtn} onPress={onClose}>
        <Icon name="X" size={IconSize.sm} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
        <Text style={arStyles.closeBtnText}>取消</Text>
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
        <Text style={noteStyles.title}>添加备注（可选）</Text>
        <TextInput
          style={noteStyles.input}
          placeholder="描述这个地点... （如：小心滑石，水源清澈）"
          placeholderTextColor={Colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <View style={noteStyles.btnRow}>
          <TouchableOpacity style={noteStyles.skipBtn} onPress={onSkip}>
            <Text style={noteStyles.skipBtnText}>跳过</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noteStyles.saveBtn} onPress={() => onSave(note)}>
            <Icon name="Flag" size={IconSize.sm} color="#fff" strokeWidth={2} />
            <Text style={noteStyles.saveBtnText}>保存旗帜</Text>
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
    if (mins < 1) return '刚才';
    if (mins < 60) return `${mins}分钟前`;
    return `${Math.floor(mins / 60)}小时前`;
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
          <Text style={[detailStyles.note, { color: Colors.textMuted, fontStyle: 'italic' }]}>（无备注）</Text>
        )}
        <View style={detailStyles.metaRow}>
          <Icon name="Timer" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
          <Text style={detailStyles.meta}>{timeAgo}</Text>
        </View>
        <TouchableOpacity
          style={detailStyles.deleteBtn}
          onPress={() => Alert.alert('删除旗帜', '确认删除？', [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: onDelete },
          ])}
        >
          <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
          <Text style={detailStyles.deleteBtnText}>删除旗帜</Text>
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

  // Keep screen awake while tracking
  useKeepAwake(isTracking ? undefined : 'HIKING_INACTIVE');

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
              {locationAvailable ? (isGuided ? 'GPS已连接 ±5m' : 'GPS') : 'GPS离线'}
            </Text>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.backChip} onPress={() => nav.goBack()}>
              <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backChipText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tracking stats bar */}
        {isTracking && (
          <View style={styles.trackingBar}>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>{distDisplay}</Text>
              <Text style={styles.trackingUnit}>公里</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>{durationDisplay}</Text>
              <Text style={styles.trackingUnit}>时长</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>+{elevationGainM}</Text>
              <Text style={styles.trackingUnit}>爬升m</Text>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={stopTracking}>
              <Icon name="Square" size={12} color="#fff" strokeWidth={3} />
              {isGuided && <Text style={styles.stopBtnText}>停止</Text>}
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
              {isGuided && <Text style={styles.trackBtnText}>开始徒步记录</Text>}
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity style={styles.fab} onPress={() => setUi('ar')}>
            <Icon name="Flag" size={IconSize.md} color="#fff" strokeWidth={2} />
            {isGuided && <Text style={styles.fabLabel}>插旗</Text>}
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
  mapBg: { flex: 1, backgroundColor: '#e8f0e0', overflow: 'hidden' },
  gridCell: {
    position: 'absolute', width: 50, height: 80,
    borderWidth: 0.5, borderColor: 'rgba(93,124,70,0.12)',
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
    width: 140, height: 140, borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  dropZoneText: { color: 'rgba(255,255,255,0.45)', fontSize: FontSize.small },
  cornerFlag: {
    position: 'absolute', width: 84, height: 84,
    borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    ...Shadow.card,
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
