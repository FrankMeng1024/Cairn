/**
 * HikingScreen — design.jpg "徒步模式"
 *
 * Full-screen map (placeholder grid) with:
 * - Top: GPS status bar (left) + activity info (right)
 * - Map area: marker pins from MOCK_MARKERS
 * - Bottom overlay: "添加旗帜" FAB → opens AR flag picker
 * - AR flag picker: 4 corners, each with a flag type — user drags to center to plant
 * - After planting: bottom sheet to add note/voice
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, PanResponder, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';
import { MOCK_MARKERS, MARKER_META } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: W, height: H } = Dimensions.get('window');

// ── Flag types for AR corners ─────────────────────────────────────────────────
const AR_FLAGS = [
  { id: 'danger', emoji: '⚠️', label: '危险', color: Colors.danger, bg: Colors.dangerBg, corner: 'topLeft' },
  { id: 'scenic', emoji: '★', label: '风景', color: Colors.info, bg: Colors.infoBg, corner: 'topRight' },
  { id: 'supply', emoji: '💧', label: '补给', color: Colors.success, bg: Colors.successBg, corner: 'bottomLeft' },
  { id: 'junction', emoji: '↗', label: '路口', color: Colors.warning, bg: Colors.warningBg, corner: 'bottomRight' },
] as const;

const CORNER_POSITIONS: Record<string, { top?: number; bottom?: number; left?: number; right?: number }> = {
  topLeft: { top: 40, left: 20 },
  topRight: { top: 40, right: 20 },
  bottomLeft: { bottom: 100, left: 20 },
  bottomRight: { bottom: 100, right: 20 },
};

// ── Marker pin ────────────────────────────────────────────────────────────────
function MarkerPin({ type, x, y, onPress }: {
  type: string; x: number; y: number; onPress: () => void;
}) {
  const meta = MARKER_META[type as keyof typeof MARKER_META] || MARKER_META.free;
  return (
    <TouchableOpacity
      style={[styles.markerPin, { left: x, top: y, borderColor: meta.color, backgroundColor: meta.bg }]}
      onPress={onPress}
    >
      <Text style={[styles.markerIcon, { color: meta.color }]}>{meta.icon}</Text>
    </TouchableOpacity>
  );
}

// ── Map Placeholder ───────────────────────────────────────────────────────────
function MapPlaceholder({ onMarkerPress }: { onMarkerPress: (id: string) => void }) {
  return (
    <View style={styles.mapBg}>
      {/* Grid pattern */}
      {Array.from({ length: 12 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, col) => (
          <View
            key={`${row}-${col}`}
            style={[styles.gridCell, { top: row * 80, left: col * 50 }]}
          />
        ))
      )}
      {/* Trail line (fake) */}
      <View style={styles.trailLine} />
      <View style={styles.trailLine2} />
      {/* Location dot */}
      <View style={styles.locationDot}>
        <View style={styles.locationDotInner} />
        <View style={styles.locationPulse} />
      </View>
      {/* Markers */}
      {MOCK_MARKERS.map((m, i) => (
        <MarkerPin
          key={m.id}
          type={m.type}
          x={80 + i * 95}
          y={200 + (i % 2) * 120}
          onPress={() => onMarkerPress(m.id)}
        />
      ))}
    </View>
  );
}

// ── AR Drag Flag Sheet ─────────────────────────────────────────────────────────
function ARFlagSheet({ onClose, onPlant }: {
  onClose: () => void;
  onPlant: (type: string) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [planted, setPlanted] = useState<string | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;

  const CENTER_ZONE = { x: W / 2 - 60, y: H / 2 - 60, w: 120, h: 120 };

  return (
    <View style={arStyles.overlay}>
      {/* Simulated camera bg */}
      <View style={arStyles.cameraBg}>
        <Text style={arStyles.cameraHint}>拖拽旗帜到画面中央 = 插旗</Text>
        <View style={arStyles.dropZone}>
          <Text style={arStyles.dropZoneText}>{planted ? '✅ 插旗成功' : '放这里'}</Text>
        </View>
      </View>

      {/* 4 corner flag types */}
      {AR_FLAGS.map((flag) => {
        const pos = CORNER_POSITIONS[flag.corner];
        return (
          <TouchableOpacity
            key={flag.id}
            style={[arStyles.cornerFlag, pos, { backgroundColor: flag.bg, borderColor: flag.color }]}
            onPress={() => {
              setPlanted(flag.id);
              setTimeout(() => onPlant(flag.id), 400);
            }}
            activeOpacity={0.75}
          >
            <Text style={arStyles.cornerEmoji}>{flag.emoji}</Text>
            <Text style={[arStyles.cornerLabel, { color: flag.color }]}>{flag.label}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Close */}
      <TouchableOpacity style={arStyles.closeBtn} onPress={onClose}>
        <Text style={arStyles.closeBtnText}>✕  取消</Text>
      </TouchableOpacity>
    </View>
  );
}

const arStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,40,20,0.88)' },
  cameraBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraHint: { color: 'rgba(255,255,255,0.6)', fontSize: FontSize.caption, marginBottom: Spacing.xl },
  dropZone: {
    width: 130, height: 130, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  dropZoneText: { color: 'rgba(255,255,255,0.5)', fontSize: FontSize.small },
  cornerFlag: {
    position: 'absolute', width: 80, height: 80,
    borderRadius: 20, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    ...Shadow.card,
  },
  cornerEmoji: { fontSize: 28 },
  cornerLabel: { fontSize: FontSize.small, fontWeight: '800' },
  closeBtn: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 10,
  },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: FontSize.caption },
});

// ── Plant Note Sheet ───────────────────────────────────────────────────────────
function PlantNoteSheet({ flagType, onSave, onSkip }: {
  flagType: string; onSave: (note: string) => void; onSkip: () => void;
}) {
  const [note, setNote] = useState('');
  const flag = AR_FLAGS.find(f => f.id === flagType) || AR_FLAGS[0];

  return (
    <View style={noteStyles.container}>
      <View style={noteStyles.sheet}>
        <View style={[noteStyles.flagBadge, { backgroundColor: flag.bg, borderColor: flag.color }]}>
          <Text style={noteStyles.flagEmoji}>{flag.emoji}</Text>
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
            <Text style={noteStyles.saveBtnText}>保存旗帜</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const noteStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl, paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1.5,
  },
  flagEmoji: { fontSize: 18 },
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
    backgroundColor: Colors.surface,
  },
  skipBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.body },
  saveBtn: {
    flex: 2, borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.primary,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
});

// ── Marker Detail Sheet ────────────────────────────────────────────────────────
function MarkerDetailSheet({ markerId, onClose }: { markerId: string; onClose: () => void }) {
  const marker = MOCK_MARKERS.find(m => m.id === markerId);
  if (!marker) return null;
  const meta = MARKER_META[marker.type as keyof typeof MARKER_META] || MARKER_META.free;

  return (
    <View style={detailStyles.container}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <View style={detailStyles.sheet}>
        <View style={detailStyles.handle} />
        <View style={[detailStyles.typeBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
          <Text style={[detailStyles.typeIcon, { color: meta.color }]}>{meta.icon}</Text>
          <Text style={[detailStyles.typeLabel, { color: meta.color }]}>{marker.type}</Text>
        </View>
        <Text style={detailStyles.title}>{marker.title}</Text>
        <Text style={detailStyles.note}>{marker.note}</Text>
        <Text style={detailStyles.meta}>📍 {marker.distanceM}m 远 · {marker.timeAgo}</Text>
        <TouchableOpacity
          style={detailStyles.deleteBtn}
          onPress={() => { Alert.alert('删除旗帜', '确认删除？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: onClose }]); }}
        >
          <Text style={detailStyles.deleteBtnText}>🗑  删除旗帜</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.sm,
    ...Shadow.overlay,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1.5,
  },
  typeIcon: { fontSize: 14, fontWeight: '700' },
  typeLabel: { fontSize: FontSize.caption, fontWeight: '700', textTransform: 'capitalize' },
  title: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  note: { fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22 },
  meta: { fontSize: FontSize.small, color: Colors.textMuted },
  deleteBtn: {
    marginTop: Spacing.sm, borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.danger + '60',
    backgroundColor: Colors.dangerBg,
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.body },
});

// ── Main HikingScreen ─────────────────────────────────────────────────────────
type UIState = 'map' | 'ar' | 'note' | 'detail';

export function HikingScreen() {
  const nav = useNavigation<Nav>();
  const { uiMode, trackingState, setTrackingState } = useAppStore();
  const isGuided = uiMode === 'guided';
  const [ui, setUi] = useState<UIState>('map');
  const [plantedFlag, setPlantedFlag] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const isTracking = trackingState === 'tracking';

  return (
    <View style={styles.container}>
      {/* Map fills entire screen */}
      <MapPlaceholder onMarkerPress={(id) => { setSelectedMarker(id); setUi('detail'); }} />

      {/* GPS status bar (top left) */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.gpsChip}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>
              {isGuided ? 'GPS已连接 ±5m' : 'GPS'}
            </Text>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.backChip} onPress={() => nav.goBack()}>
              <Text style={styles.backChipText}>← 返回</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tracking bar */}
        {isTracking && (
          <View style={styles.trackingBar}>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>2.4</Text>
              <Text style={styles.trackingUnit}>公里</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>42</Text>
              <Text style={styles.trackingUnit}>分钟</Text>
            </View>
            <View style={styles.trackingStat}>
              <Text style={styles.trackingValue}>+120</Text>
              <Text style={styles.trackingUnit}>爬升m</Text>
            </View>
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => setTrackingState('idle')}
            >
              <Text style={styles.stopBtnText}>{isGuided ? '■ 停止' : '■'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Bottom FABs */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          {/* Track toggle */}
          {!isTracking ? (
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => setTrackingState('tracking')}
            >
              <Text style={styles.trackBtnText}>
                {isGuided ? '▶  开始徒步记录' : '▶'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Add flag FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setUi('ar')}>
            <Text style={styles.fabIcon}>📍</Text>
            {isGuided && <Text style={styles.fabLabel}>插旗</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* AR Flag Sheet */}
      {ui === 'ar' && (
        <ARFlagSheet
          onClose={() => setUi('map')}
          onPlant={(type) => { setPlantedFlag(type); setUi('note'); }}
        />
      )}

      {/* Plant Note Sheet */}
      {ui === 'note' && plantedFlag && (
        <PlantNoteSheet
          flagType={plantedFlag}
          onSave={(note) => { setUi('map'); Alert.alert('✅ 旗帜已保存', note || '（无备注）'); }}
          onSkip={() => setUi('map')}
        />
      )}

      {/* Marker Detail Sheet */}
      {ui === 'detail' && selectedMarker && (
        <MarkerDetailSheet
          markerId={selectedMarker}
          onClose={() => { setSelectedMarker(null); setUi('map'); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Map
  mapBg: { flex: 1, backgroundColor: '#e8f0e0', position: 'relative', overflow: 'hidden' },
  gridCell: { position: 'absolute', width: 50, height: 80, borderWidth: 0.5, borderColor: 'rgba(93,124,70,0.12)' },
  trailLine: {
    position: 'absolute', top: 240, left: 60, right: 60, height: 3,
    backgroundColor: Colors.primary + '60', borderRadius: 2,
  },
  trailLine2: {
    position: 'absolute', top: 240, left: 60, width: 160, height: 120,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderColor: Colors.primary + '60', borderRadius: 0,
    borderBottomRightRadius: 12,
  },
  locationDot: {
    position: 'absolute', top: 350, left: W / 2 - 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  locationDotInner: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, borderWidth: 3, borderColor: '#fff' },
  locationPulse: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.primary + '60' },
  markerPin: {
    position: 'absolute', width: 32, height: 32,
    borderRadius: 16, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  markerIcon: { fontSize: 14, fontWeight: '800' },

  // Overlays
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: Spacing.sm },
  gpsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, ...Shadow.card },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  gpsText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textPrimary },
  topRight: { flexDirection: 'row', gap: Spacing.sm },
  backChip: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, ...Shadow.card },
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
  stopBtn: { backgroundColor: Colors.danger, borderRadius: Radius.button, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.small },

  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg, gap: Spacing.sm },
  trackBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...Shadow.card,
  },
  trackBtnText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  fab: {
    backgroundColor: Colors.primary, borderRadius: Radius.circle,
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
  fabIcon: { fontSize: 24 },
  fabLabel: { fontSize: 8, color: '#fff', fontWeight: '700', marginTop: 1 },
});
