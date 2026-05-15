/**
 * MapScreen — Sprint 13 SVG polish
 *
 * - Emoji replaced with lucide SVG icons throughout
 * - Map markers, type selector, detail badge all use Icon component
 * - Permission icons: Lock, Users, Globe
 * - Activity mode chip: Mountain / PersonStanding
 * - FAB: MapPin SVG
 * - Helpful button: ThumbsUp SVG
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal,
  TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MOCK_MARKERS, MARKER_META, MarkerType } from '../data/mockData';

const { width: W, height: H } = Dimensions.get('window');

// ── Map Placeholder ───────────────────────────────────────────────────────────
function MapPlaceholder({
  markers, onMarkerPress,
}: {
  markers: typeof MOCK_MARKERS;
  onMarkerPress: (m: typeof MOCK_MARKERS[0]) => void;
}) {
  return (
    <View style={styles.mapContainer}>
      {/* Grid background */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.gridLine, styles.gridH, { top: `${(i + 1) * 11}%` as any }]} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.gridLine, styles.gridV, { left: `${(i + 1) * 14}%` as any }]} />
      ))}
      {/* Trail line (mock) */}
      <View style={styles.trailLine} />
      {/* Placeholder label */}
      <View style={styles.mapLabel}>
        <Text style={styles.mapLabelText}>Trail Map</Text>
        <Text style={styles.mapLabelSub}>Real map loads with offline pack</Text>
      </View>
      {/* Mock markers */}
      {markers.map((m) => {
        const meta = MARKER_META[m.type];
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.mapMarker, {
              left: m.x * W - 14,
              top: m.y * (H * 0.75) - 14,
              backgroundColor: meta.bg,
              borderColor: meta.color,
            }]}
            onPress={() => onMarkerPress(m)}
          >
            <Icon name={meta.iconName as IconName} size={13} color={meta.color} strokeWidth={2} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Mark Creation Sheet ───────────────────────────────────────────────────────
function CreateMarkerSheet({
  visible, onClose, onConfirm, isGuided,
}: {
  visible: boolean; onClose: () => void;
  onConfirm: (type: MarkerType, text: string) => void;
  isGuided: boolean;
}) {
  const [selectedType, setSelectedType] = useState<MarkerType>('free');
  const [text, setText] = useState('');
  const [permission, setPermission] = useState<'personal' | 'group' | 'public'>('personal');
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 300,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const permIconNames: Record<'personal' | 'group' | 'public', IconName> = {
    personal: 'Lock', group: 'Users', public: 'Globe',
  };
  const permColors: Record<'personal' | 'group' | 'public', string> = {
    personal: Colors.textSecondary, group: Colors.info, public: Colors.primary,
  };
  const permLabels = { personal: 'Only me', group: 'Friends', public: 'Public' };
  const permHints = {
    personal: 'Only you can see this flag',
    group: 'Your friends can also see it',
    public: 'Visible to all users',
  };

  if (!visible) return null;

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Plant a flag</Text>
        {isGuided && (
          <Text style={styles.sheetSubtitle}>Leave useful info for those who follow</Text>
        )}

        {/* Type selector */}
        <View style={styles.typeRow}>
          {(Object.keys(MARKER_META) as MarkerType[]).map((t) => {
            const meta = MARKER_META[t];
            const active = selectedType === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, active && { backgroundColor: meta.bg, borderColor: meta.color }]}
                onPress={() => setSelectedType(t)}
              >
                <Icon name={meta.iconName as IconName} size={18} color={meta.color} strokeWidth={1.8} />
                {isGuided && <Text style={[styles.typeBtnLabel, { color: meta.color }]}>{meta.label}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Text input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder={isGuided ? 'Short description (max 30 chars)' : 'Note...'}
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={(t) => setText(t.slice(0, 30))}
            multiline
          />
          {isGuided && (
            <Text style={styles.charCount}>{text.length}/30</Text>
          )}
        </View>

        {/* Permission */}
        <View style={styles.permRow}>
          {(['personal', 'group', 'public'] as const).map((p) => {
            const active = permission === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.permBtn, active && styles.permBtnActive]}
                onPress={() => setPermission(p)}
              >
                <Icon name={permIconNames[p]} size={16} color={active ? Colors.primary : permColors[p]} strokeWidth={1.8} />
                {isGuided && (
                  <View>
                    <Text style={[styles.permBtnLabel, active && styles.permBtnLabelActive]}>{permLabels[p]}</Text>
                    <Text style={styles.permBtnHint}>{permHints[p]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Confirm */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => { onConfirm(selectedType, text); onClose(); setText(''); }}
        >
          <Text style={styles.confirmBtnText}>Plant Flag</Text>
          {isGuided && (
            <Text style={styles.confirmBtnHint}>This flag will help those who come after you</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Marker Detail Sheet ───────────────────────────────────────────────────────
function MarkerDetailSheet({
  marker, onClose, isGuided,
}: {
  marker: typeof MOCK_MARKERS[0] | null;
  onClose: () => void;
  isGuided: boolean;
}) {
  if (!marker) return null;
  const meta = MARKER_META[marker.type];
  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={[styles.sheet, { paddingBottom: 40 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.detailHeader}>
          <View style={[styles.detailTypeBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
            <Icon name={meta.iconName as IconName} size={14} color={meta.color} strokeWidth={2} />
            <Text style={[styles.detailTypeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.detailTime}>{marker.minutesAgo}m ago · {marker.author}</Text>
        </View>
        <Text style={styles.detailText}>{marker.text}</Text>
        <TouchableOpacity style={styles.helpfulBtn}>
          <Icon name="ThumbsUp" size={18} color={Colors.textSecondary} strokeWidth={1.8} />
          {isGuided
            ? <Text style={styles.helpfulBtnText}>Helpful — let the author know this helped you</Text>
            : <Text style={styles.helpfulBtnText}>Helpful</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Map Screen ───────────────────────────────────────────────────────────
export function MapScreen() {
  const { uiMode, activityMode, setActivityMode, trackingState, setTrackingState,
    trackingDistance, trackingDuration, incrementTracking } = useAppStore();
  const isGuided = uiMode === 'beginner';

  const [markers, setMarkers] = useState(MOCK_MARKERS);
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<typeof MOCK_MARKERS[0] | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);

  // Mock tracking timer
  useEffect(() => {
    if (trackingState !== 'tracking') return;
    const t = setInterval(incrementTracking, 3000);
    return () => clearInterval(t);
  }, [trackingState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleAddMarker = (type: MarkerType, text: string) => {
    setMarkers((prev) => [...prev, {
      id: String(Date.now()), type, text, author: 'Me', minutesAgo: 0,
      x: 0.5 + (Math.random() - 0.5) * 0.3,
      y: 0.5 + (Math.random() - 0.5) * 0.3,
      title: text, note: '', distanceM: 0, timeAgo: 'just now',
    }]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Map */}
      <MapPlaceholder markers={markers} onMarkerPress={(m) => setSelectedMarker(m)} />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        {/* GPS status */}
        <View style={styles.gpsChip}>
          <View style={styles.gpsDot} />
          {isGuided
            ? <Text style={styles.chipText}>GPS Connected ±5m</Text>
            : <Text style={styles.chipText}>GPS</Text>
          }
        </View>

        {/* Activity mode chip */}
        <TouchableOpacity style={styles.modeChip} onPress={() => setShowModeModal(true)}>
          <Icon
            name={activityMode === 'hiking' ? 'Mountain' : 'PersonStanding'}
            size={16} color={Colors.primary} strokeWidth={1.8}
          />
          {isGuided && (
            <Text style={styles.chipText}>{activityMode === 'hiking' ? 'Hiking' : 'Running'}</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Tracking overlay (bottom stats bar) */}
      {trackingState === 'tracking' && (
        <View style={styles.trackingBar}>
          {activityMode === 'running' ? (
            // Running mode — big pace, minimal
            <>
              <Text style={styles.trackingPaceBig}>5:30</Text>
              {isGuided && <Text style={styles.trackingPaceLabel}>Current pace /km</Text>}
              <View style={styles.trackingRow}>
                <Text style={styles.trackingStat}>{trackingDistance.toFixed(2)}{isGuided ? ' km' : 'k'}</Text>
                <Text style={styles.trackingStat}>{formatDuration(trackingDuration)}</Text>
              </View>
              <TouchableOpacity style={styles.markLaterBtn}>
                <Text style={styles.markLaterText}>Flag later</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Hiking mode — stats row
            <>
              <View style={styles.trackingStatsRow}>
                <View style={styles.trackingStatItem}>
                  <Text style={styles.trackingStatValue}>{trackingDistance.toFixed(2)}</Text>
                  <Text style={styles.trackingStatUnit}>{isGuided ? 'km' : 'km'}</Text>
                </View>
                <View style={styles.trackingStatItem}>
                  <Text style={styles.trackingStatValue}>{formatDuration(trackingDuration)}</Text>
                  <Text style={styles.trackingStatUnit}>{isGuided ? 'elapsed' : ''}</Text>
                </View>
                <View style={styles.trackingStatItem}>
                  <Text style={styles.trackingStatValue}>850</Text>
                  <Text style={styles.trackingStatUnit}>{isGuided ? 'elev m' : 'm'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={() => setTrackingState('idle')}>
                <Text style={styles.stopBtnText}>
                  {isGuided ? 'Stop' : '■'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* FAB */}
      {trackingState !== 'tracking' || activityMode === 'hiking' ? (
        <TouchableOpacity
          style={[styles.fab, trackingState === 'tracking' && styles.fabSmall]}
          onPress={() => setCreateVisible(true)}
        >
          <Icon name="MapPin" size={22} color="#fff" strokeWidth={2} />
          {isGuided && trackingState === 'idle' && <Text style={styles.fabLabel}>Flag</Text>}
        </TouchableOpacity>
      ) : null}

      {/* Start tracking button (when idle) */}
      {trackingState === 'idle' && (
        <TouchableOpacity
          style={styles.startTrackingBtn}
          onPress={() => setTrackingState('tracking')}
        >
          <Text style={styles.startTrackingText}>
            {isGuided ? `Start ${activityMode === 'hiking' ? 'Hiking' : 'Running'}` : '▶'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Sheets */}
      <CreateMarkerSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onConfirm={handleAddMarker}
        isGuided={isGuided}
      />
      <MarkerDetailSheet
        marker={selectedMarker}
        onClose={() => setSelectedMarker(null)}
        isGuided={isGuided}
      />

      {/* Activity mode modal */}
      <Modal visible={showModeModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowModeModal(false)} activeOpacity={1}>
          <View style={styles.modeModal}>
            <Text style={styles.modeModalTitle}>Activity Mode</Text>
            {(['hiking', 'running'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeModalRow, activityMode === m && styles.modeModalRowActive]}
                onPress={() => { setActivityMode(m); setShowModeModal(false); }}
              >
                <View style={styles.modeModalIconWrap}>
                  <Icon
                    name={m === 'hiking' ? 'Mountain' : 'PersonStanding'}
                    size={22} color={activityMode === m ? Colors.primary : Colors.textSecondary}
                    strokeWidth={1.8}
                  />
                </View>
                <View>
                  <Text style={styles.modeModalLabel}>{m === 'hiking' ? 'Hiking Mode' : 'Running Mode'}</Text>
                  {isGuided && (
                    <Text style={styles.modeModalHint}>
                      {m === 'hiking' ? 'Map-first, full flag features' : 'Voice-first, minimal UI, lock-screen safe'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#e8f0e0',
  },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(93,124,70,0.1)' },
  gridH: { left: 0, right: 0, height: 1 },
  gridV: { top: 0, bottom: 0, width: 1 },
  trailLine: {
    position: 'absolute', left: '20%', right: '20%', top: '30%', bottom: '40%',
    borderWidth: 3, borderColor: Colors.primary, borderRadius: 40,
    borderStyle: 'dashed',
  },
  mapLabel: { position: 'absolute', top: '50%', alignSelf: 'center', alignItems: 'center', marginTop: -20 },
  mapLabelText: { fontSize: FontSize.h3, fontWeight: '600', color: 'rgba(93,124,70,0.5)' },
  mapLabelSub: { fontSize: FontSize.small, color: 'rgba(93,124,70,0.4)', marginTop: 2 },
  mapMarker: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
  },
  gpsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, ...Shadow.card,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, ...Shadow.card,
  },
  chipText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textPrimary },

  trackingBar: {
    position: 'absolute', bottom: 90, left: Spacing.base, right: Spacing.base,
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, alignItems: 'center', ...Shadow.overlay,
  },
  trackingPaceBig: { fontSize: 48, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -2 },
  trackingPaceLabel: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: -4, marginBottom: 8 },
  trackingRow: { flexDirection: 'row', gap: Spacing.xl },
  trackingStat: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  trackingStatsRow: { flexDirection: 'row', gap: Spacing.xl, marginBottom: Spacing.sm },
  trackingStatItem: { alignItems: 'center' },
  trackingStatValue: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary },
  trackingStatUnit: { fontSize: FontSize.small, color: Colors.textSecondary },
  stopBtn: {
    backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  markLaterBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.button,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  markLaterText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.body },

  fab: {
    position: 'absolute', right: Spacing.base, bottom: 100,
    backgroundColor: Colors.primary, borderRadius: Radius.circle,
    width: 64, height: 64, alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
  fabSmall: { width: 52, height: 52 },
  fabLabel: {
    fontSize: FontSize.tiny, color: '#fff', fontWeight: '700',
    position: 'absolute', bottom: -18,
  },

  startTrackingBtn: {
    position: 'absolute', bottom: 100, left: Spacing.base,
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    ...Shadow.fab,
  },
  startTrackingText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },

  // Sheets
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlayDark },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet, padding: Spacing.base,
    paddingBottom: 48, ...Shadow.overlay,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.md,
  },
  sheetTitle: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sheetSubtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.base },

  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    flex: 1, alignItems: 'center', padding: Spacing.sm,
    borderRadius: Radius.card, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bg, gap: 2,
  },
  typeBtnLabel: { fontSize: FontSize.tiny, fontWeight: '600' },

  inputWrap: {
    backgroundColor: Colors.bg, borderRadius: Radius.button,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  textInput: { fontSize: FontSize.body, color: Colors.textPrimary, minHeight: 60 },
  charCount: { textAlign: 'right', fontSize: FontSize.small, color: Colors.textMuted, marginTop: 4 },

  permRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  permBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg, borderRadius: Radius.card, padding: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  permBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  permBtnLabel: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },
  permBtnLabelActive: { color: Colors.primary },
  permBtnHint: { fontSize: 9, color: Colors.textMuted },

  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    padding: Spacing.md, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  confirmBtnHint: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.small, marginTop: 2 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  detailTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  detailTypeLabel: { fontSize: FontSize.small, fontWeight: '600' },
  detailTime: { fontSize: FontSize.caption, color: Colors.textSecondary },
  detailText: { fontSize: FontSize.body, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.lg },
  helpfulBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bg, borderRadius: Radius.button, padding: Spacing.md,
  },
  helpfulBtnText: { fontSize: FontSize.caption, color: Colors.textSecondary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlayDark, justifyContent: 'center', padding: Spacing.xl },
  modeModal: { backgroundColor: Colors.surface, borderRadius: Radius.cardLg, padding: Spacing.base, ...Shadow.card },
  modeModalTitle: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  modeModalRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.card, marginBottom: Spacing.sm,
  },
  modeModalRowActive: { backgroundColor: Colors.primaryLight },
  modeModalIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  modeModalLabel: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  modeModalHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
});
