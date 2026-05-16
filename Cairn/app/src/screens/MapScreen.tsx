/**
 * MapScreen — Sprint 31 premium uplift
 *
 * - STORY-00095: Map placeholder → topo rings + S-curve trail + GPS pill + Download CTA
 * - STORY-00096: CreateMarkerSheet → 4-card grid, LinearGradient badges, CircleCheck selection, 3-tier char counter
 * - STORY-00097: MarkerDetailSheet → LinearGradient type badge, outlined Helpful pill
 * - STORY-00098: Tracking bar → Colors.surface + Shadow.elevated + 3px green left-border, red FAB badge
 * - STORY-00099: GPS/mode chips → rgba(255,255,255,0.95), LinearGradient in activity modal
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal,
  TextInput, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MOCK_MARKERS, MARKER_META, MarkerType } from '../data/mockData';

const { width: W, height: H } = Dimensions.get('window');

// ── Flag type config (matching HikingScreen FLAG_TYPES) ───────────────────────
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
  { id: 'junction', icon: 'Navigation2',   label: 'Junction', color: Colors.warning,  bg: Colors.warningBg },
];

// ── Map Placeholder (STORY-00095 + STORY-00105) ───────────────────────────────
function MapPlaceholder({
  markers, onMarkerPress,
}: {
  markers: typeof MOCK_MARKERS;
  onMarkerPress: (m: typeof MOCK_MARKERS[0]) => void;
}) {
  const pulseOpacity = useRef(new Animated.Value(0.3)).current;
  const dotScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.timing(pulseOpacity, { toValue: 0, duration: 2000, useNativeDriver: true })
    );
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    scaleLoop.start();
    return () => { pulseLoop.stop(); scaleLoop.stop(); };
  }, []);

  return (
    <View style={styles.mapContainer}>
      {/* Topo elevation rings — concentric, varying opacity (matches HikingScreen) */}
      <View style={[styles.topoRing, { width: 320, height: 320, borderRadius: 160, top: 100, left: W / 2 - 160, borderColor: Colors.primaryDim }]} />
      <View style={[styles.topoRing, { width: 240, height: 240, borderRadius: 120, top: 140, left: W / 2 - 120, borderColor: Colors.primaryDeep }]} />
      <View style={[styles.topoRing, { width: 165, height: 165, borderRadius: 83, top: 178, left: W / 2 - 83, borderColor: Colors.primaryMuted }]} />
      <View style={[styles.topoRing, { width: 96, height: 96, borderRadius: 48, top: 212, left: W / 2 - 48, borderColor: Colors.primaryMuted, backgroundColor: 'rgba(93,124,70,0.06)' }]} />
      {/* Trail S-curve — three segments */}
      <View style={styles.trailLine} />
      <View style={styles.trailLine2} />
      <View style={styles.trailLine3} />
      {/* Location pin at trail midpoint — animated GPS pulse (STORY-00105) */}
      <View style={styles.locationDot}>
        <Animated.View style={[styles.locationDotInner, { transform: [{ scale: dotScale }] }]} />
        <Animated.View style={[styles.locationPulse, { opacity: pulseOpacity }]} />
      </View>
      {/* Trail Map label + CTA */}
      <View style={styles.mapLabelWrap}>
        <Text style={styles.mapLabel}>Trail Map</Text>
        <Text style={styles.mapSubLabel}>Download an offline pack to get started</Text>
        <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.8}>
          <Icon name="Download" size={12} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.downloadBtnText}>Download Map</Text>
        </TouchableOpacity>
      </View>
      {/* Mock markers */}
      {markers.map((m) => {
        const meta = MARKER_META[m.type];
        const flagType = FLAG_TYPES.find(f => f.id === m.type);
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.mapMarker, {
              left: m.x * W - 16,
              top: m.y * (H * 0.75) - 16,
              borderColor: meta.color,
              backgroundColor: meta.bg,
            }]}
            onPress={() => onMarkerPress(m)}
          >
            <Icon name={(flagType?.icon ?? meta.iconName) as IconName} size={14} color={meta.color} strokeWidth={2.5} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── CreateMarkerSheet (STORY-00096) ───────────────────────────────────────────
function CreateMarkerSheet({
  visible, onClose, onConfirm,
}: {
  visible: boolean; onClose: () => void;
  onConfirm: (type: MarkerType, text: string) => void;
}) {
  const [selectedType, setSelectedType] = useState<MarkerType | null>(null);
  const [text, setText] = useState('');
  const [textFocused, setTextFocused] = useState(false);
  const [permission, setPermission] = useState<'personal' | 'group' | 'public'>('personal');
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const charCount = text.length;
  const canSave = selectedType !== null;

  const permIconNames: Record<'personal' | 'group' | 'public', IconName> = {
    personal: 'Lock', group: 'Users', public: 'Globe',
  };
  const permLabels = { personal: 'Only me', group: 'Friends', public: 'Public' };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.sheetOverlay, { opacity: opacityAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />
          {/* Header */}
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Plant a Flag</Text>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
              <Icon name="X" size={IconSize.sm} color={Colors.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* 4-card flag type grid (STORY-00096) */}
          <View style={styles.typeGrid}>
            {FLAG_TYPES.map((flag) => {
              const isSelected = selectedType === flag.id;
              return (
                <TouchableOpacity
                  key={flag.id}
                  style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                  onPress={() => { setSelectedType(flag.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[flag.bg, flag.bg.replace(')', ', 0.9)').replace('rgb', 'rgba')]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.typeIconBadge, { borderColor: flag.color + '40' }]}
                  >
                    <Icon name={flag.icon} size={IconSize.md} color={flag.color} strokeWidth={2} />
                  </LinearGradient>
                  <Text style={[styles.typeCardLabel, { color: isSelected ? Colors.primary : Colors.textSecondary }]}>
                    {flag.label}
                  </Text>
                  {/* CircleCheck selection indicator */}
                  {isSelected && (
                    <View style={styles.typeCardCheck}>
                      <Icon name="CircleCheck" size={14} color={Colors.primary} strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note input with 3-tier char counter */}
          <View style={styles.noteWrap}>
            <TextInput
              style={[styles.noteInput, textFocused && styles.noteInputFocused, charCount >= 30 && styles.noteInputError]}
              placeholder="Describe this spot… (optional)"
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={(t) => setText(t.slice(0, 30))}
              multiline
              numberOfLines={2}
              onFocus={() => setTextFocused(true)}
              onBlur={() => setTextFocused(false)}
            />
            <View style={styles.noteFooterRow}>
              <Text style={styles.noteMaxLabel}>Max 30 characters</Text>
              {(textFocused || charCount > 0) && (
                <Text style={[
                  styles.charCount,
                  charCount >= 30 ? { color: Colors.danger } : charCount >= 22 ? { color: Colors.warning } : null,
                ]}>{charCount}/30</Text>
              )}
            </View>
          </View>

          {/* Permission selector — outlined pill style */}
          <View style={styles.permRow}>
            {(['personal', 'group', 'public'] as const).map((p) => {
              const active = permission === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.permPill, active && styles.permPillActive]}
                  onPress={() => setPermission(p)}
                >
                  <Icon name={permIconNames[p]} size={14} color={active ? Colors.primary : Colors.textSecondary} strokeWidth={1.8} />
                  <Text style={[styles.permPillLabel, active && styles.permPillLabelActive]}>{permLabels[p]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save button — disabled until type selected */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => {
              if (!canSave) return;
              onConfirm(selectedType!, text);
              onClose();
              setText('');
              setSelectedType(null);
            }}
            activeOpacity={canSave ? 0.8 : 1}
          >
            <Icon name="Flag" size={IconSize.sm} color={canSave ? '#fff' : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.saveBtnText, !canSave && { color: Colors.textMuted }]}>Plant Flag</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ── MarkerDetailSheet (STORY-00097) ───────────────────────────────────────────
function MarkerDetailSheet({
  marker, onClose,
}: {
  marker: typeof MOCK_MARKERS[0] | null;
  onClose: () => void;
}) {
  if (!marker) return null;
  const meta = MARKER_META[marker.type];
  const flagType = FLAG_TYPES.find(f => f.id === marker.type);

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <View style={[styles.sheet, { paddingBottom: 40 }]}>
        <View style={styles.sheetHandle} />
        {/* Header: LinearGradient type badge + time/author */}
        <View style={styles.detailHeaderRow}>
          <LinearGradient
            colors={[meta.bg, meta.bg.replace(')', ', 0.9)').replace('rgb', 'rgba')]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.detailTypeBadge, { borderColor: meta.color + '50' }]}
          >
            <Icon name={(flagType?.icon ?? meta.iconName) as IconName} size={14} color={meta.color} strokeWidth={2.5} />
            <Text style={[styles.detailTypeLabel, { color: meta.color }]}>{meta.label}</Text>
          </LinearGradient>
          <Text style={styles.detailMeta}>{marker.author} · {marker.minutesAgo}m ago</Text>
        </View>
        {/* Marker title h3/600 */}
        {marker.title ? (
          <Text style={styles.detailTitle}>{marker.title}</Text>
        ) : null}
        {/* Note text */}
        <Text style={styles.detailNote}>{marker.text}</Text>
        {/* Helpful outlined pill */}
        <TouchableOpacity style={styles.helpfulPill}>
          <Icon name="ThumbsUp" size={15} color={Colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.helpfulPillText}>Helpful</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Map Screen ───────────────────────────────────────────────────────────
export function MapScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { uiMode, activityMode, setActivityMode, trackingState, setTrackingState,
    trackingDistance, trackingDuration, incrementTracking } = useAppStore();

  const [markers, setMarkers] = useState(MOCK_MARKERS);
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<typeof MOCK_MARKERS[0] | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);

  // Spring scales for buttons
  const fabScale = useRef(new Animated.Value(1)).current;
  const springIn = (val: Animated.Value) =>
    Animated.spring(val, { toValue: 0.95, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const springOut = (val: Animated.Value) =>
    Animated.spring(val, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();

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

  const isTracking = trackingState === 'tracking';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Map — full bleed topo placeholder */}
      <MapPlaceholder markers={markers} onMarkerPress={(m) => setSelectedMarker(m)} />

      {/* Top bar — STORY-00099: rgba(255,255,255,0.95) overlay chips */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        {/* Left: back + GPS */}
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.backChip} onPress={() => nav.goBack()}>
            <Icon name="ChevronLeft" size={16} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.backChipText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.gpsChip}>
            <View style={styles.gpsDot} />
            <Text style={styles.chipText}>GPS Connected ±5m</Text>
          </View>
        </View>

        {/* Activity mode chip */}
        <TouchableOpacity style={styles.modeChip} onPress={() => setShowModeModal(true)}>
          <Icon
            name={activityMode === 'hiking' ? 'Mountain' : 'PersonStanding'}
            size={16} color={Colors.primary} strokeWidth={1.8}
          />
          <Text style={styles.chipText}>{activityMode === 'hiking' ? 'Hiking' : 'Running'}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Tracking bar — STORY-00098: white card + Shadow.elevated + 3px green left-border */}
      {isTracking && (
        <View style={styles.trackingBar}>
          {activityMode === 'running' ? (
            <>
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValueLg}>5:30</Text>
                <Text style={styles.trackingUnit}>pace /km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValue}>{trackingDistance.toFixed(2)}</Text>
                <Text style={styles.trackingUnit}>km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValue}>{formatDuration(trackingDuration)}</Text>
                <Text style={styles.trackingUnit}>elapsed</Text>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={() => setTrackingState('idle')}>
                <Icon name="Square" size={12} color="#fff" strokeWidth={3} />
                <Text style={styles.stopBtnText}>Stop</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValueLg}>{trackingDistance.toFixed(2)}</Text>
                <Text style={styles.trackingUnit}>km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValue}>{formatDuration(trackingDuration)}</Text>
                <Text style={styles.trackingUnit}>elapsed</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.trackingStatItem}>
                <Text style={styles.trackingValue}>850</Text>
                <Text style={styles.trackingUnit}>elev m</Text>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={() => setTrackingState('idle')}>
                <Icon name="Square" size={12} color="#fff" strokeWidth={3} />
                <Text style={styles.stopBtnText}>Stop</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          {/* Start/Stop tracking button */}
          {!isTracking ? (
            <TouchableOpacity
              style={styles.startTrackingBtn}
              onPress={() => setTrackingState('tracking')}
            >
              <Icon name="Play" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.startTrackingText}>
                {activityMode === 'hiking' ? 'Start Hiking' : 'Start Running'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* FAB — STORY-00098: red badge showing flag count */}
          <Animated.View style={{ transform: [{ scale: fabScale }] }}>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setCreateVisible(true)}
              activeOpacity={1}
              onPressIn={() => springIn(fabScale)}
              onPressOut={() => springOut(fabScale)}
            >
              <Icon name="MapPin" size={22} color="#fff" strokeWidth={2} />
              {markers.length > 0 && (
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>{markers.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Sheets */}
      <CreateMarkerSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onConfirm={handleAddMarker}
      />
      <MarkerDetailSheet
        marker={selectedMarker}
        onClose={() => setSelectedMarker(null)}
      />

      {/* Activity mode modal — STORY-00099: LinearGradient icon badges */}
      <Modal visible={showModeModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowModeModal(false)} activeOpacity={1}>
          <View style={styles.modeModal}>
            <Text style={styles.modeModalTitle}>Activity Mode</Text>
            {([
              { id: 'hiking' as const, icon: 'Mountain' as IconName, label: 'Hiking Mode', hint: 'Map-first, full flag features', gradColors: [Colors.primaryLight, Colors.primaryBg] as [string, string] },
              { id: 'running' as const, icon: 'PersonStanding' as IconName, label: 'Running Mode', hint: 'Voice-first, minimal UI, lock-screen safe', gradColors: [Colors.infoBg, Colors.infoBg] as [string, string] },
            ]).map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeModalRow, activityMode === m.id && styles.modeModalRowActive]}
                onPress={() => { setActivityMode(m.id); setShowModeModal(false); }}
              >
                {/* LinearGradient icon badge */}
                <LinearGradient
                  colors={m.gradColors}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.modeModalIconBadge}
                >
                  <Icon
                    name={m.icon}
                    size={22} color={activityMode === m.id ? Colors.primary : Colors.textSecondary}
                    strokeWidth={1.8}
                  />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeModalLabel}>{m.label}</Text>
                  <Text style={styles.modeModalHint}>{m.hint}</Text>
                </View>
                {activityMode === m.id && (
                  <Icon name="CircleCheck" size={18} color={Colors.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Map Placeholder (STORY-00095) ───────────────────────────────────────────
  mapContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.primaryBg, overflow: 'hidden',
  },
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
  mapMarker: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },

  // ── Top bar (STORY-00099) ────────────────────────────────────────────────────
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  backChipText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.primary },
  gpsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card,
  },
  chipText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textPrimary },

  // ── Tracking bar (STORY-00098) ───────────────────────────────────────────────
  trackingBar: {
    position: 'absolute', top: 90, left: Spacing.base, right: Spacing.base,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card, padding: Spacing.md,
    gap: Spacing.sm, ...Shadow.elevated,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  trackingStatItem: { alignItems: 'center', flex: 1 },
  trackingValueLg: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary },
  trackingValue: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary },
  trackingUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.small },

  // ── Bottom controls ──────────────────────────────────────────────────────────
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  bottomRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg, gap: Spacing.sm,
  },
  startTrackingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderWidth: 2, borderColor: Colors.primaryMuted,
    ...Shadow.card,
  },
  startTrackingText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.primary },
  fab: {
    backgroundColor: Colors.primary, borderRadius: Radius.circle,
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
  fabBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff',
  },
  fabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // ── Sheets ───────────────────────────────────────────────────────────────────
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100, backgroundColor: Colors.overlayDark },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet, padding: Spacing.xl,
    paddingBottom: 48, gap: Spacing.md, ...Shadow.overlay,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.xs,
  },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },

  // 4-card grid (STORY-00096)
  typeGrid: { flexDirection: 'row', gap: Spacing.sm },
  typeCard: {
    flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm,
    borderRadius: Radius.card, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, ...Shadow.card,
  },
  typeCardSelected: {
    borderColor: Colors.primary, backgroundColor: Colors.primaryBg,
  },
  typeIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  typeCardLabel: { fontSize: FontSize.small, fontWeight: '700' },
  typeCardCheck: {
    position: 'absolute', top: 6, right: 6,
  },

  // Note input
  noteWrap: { position: 'relative' },
  noteInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, minHeight: 70,
    textAlignVertical: 'top',
  },
  noteInputFocused: { borderColor: Colors.primary },
  noteInputError: { borderColor: Colors.danger },
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

  // Permission pills
  permRow: { flexDirection: 'row', gap: Spacing.sm },
  permPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  permPillActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  permPillLabel: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },
  permPillLabelActive: { color: Colors.primary },

  // Save button
  saveBtn: {
    borderRadius: Radius.button, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.primary,
    flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },

  // MarkerDetailSheet (STORY-00097)
  detailHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  detailTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1.5,
  },
  detailTypeLabel: { fontSize: FontSize.caption, fontWeight: '700' },
  detailMeta: { fontSize: FontSize.caption, color: Colors.textSecondary },
  detailTitle: { fontSize: FontSize.h3, fontWeight: '600', color: Colors.textPrimary },
  detailNote: { fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22 },
  helpfulPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  helpfulPillText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },

  // Activity mode modal (STORY-00099)
  modalOverlay: { flex: 1, backgroundColor: Colors.overlayDark, justifyContent: 'center', padding: Spacing.xl },
  modeModal: {
    backgroundColor: Colors.surface, borderRadius: Radius.cardLg,
    padding: Spacing.base, ...Shadow.overlay,
  },
  modeModalTitle: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  modeModalRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.card, marginBottom: Spacing.sm,
  },
  modeModalRowActive: { backgroundColor: Colors.primaryBg },
  modeModalIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modeModalLabel: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  modeModalHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
});
