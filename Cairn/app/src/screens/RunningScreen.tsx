/**
 * RunningScreen — Sprint 18 premium lock screen
 *
 * States:
 * 1. Pre-start: route selection with SVG icons, animated start button
 * 2. Running — LOCKED: large elapsed time + secondary stats, pulsing GPS dot
 * 3. Running — UNLOCKED: stop/relock controls fade in
 *
 * Uses useTrackingStore (real GPS via expo-location, graceful web fallback).
 * activityMode set to 'running' before startTracking.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useTrackingStore } from '../store/useTrackingStore';
import { formatDistance, formatDuration } from '../utils/geo';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { MOCK_ROUTES } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RunState = 'pre' | 'running' | 'stopped';

// ── Keep-awake guard ────────────────────────────────────────────────────────
function useRunKeepAwake() {
  // Keep screen awake whenever RunningScreen is mounted
  useKeepAwake();
}

// ── Pulsing GPS dot ───────────────────────────────────────────────────────────
function PulsingDot({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[runStyles.pulsingDot, { transform: [{ scale: pulse }], backgroundColor: active ? Colors.success : Colors.textMuted }]} />
  );
}

// ── Stat item ────────────────────────────────────────────────────────────────
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={runStyles.statItem}>
      <Text style={runStyles.statValue}>{value}</Text>
      <Text style={runStyles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export function RunningScreen() {
  const nav = useNavigation<Nav>();
  const [runState, setRunState] = useState<RunState>('pre');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real tracking store
  const status = useTrackingStore(s => s.status);
  const durationS = useTrackingStore(s => s.durationS);
  const distanceM = useTrackingStore(s => s.distanceM);
  const locationAvailable = useTrackingStore(s => s.locationAvailable);
  const setActivityMode = useTrackingStore(s => s.setActivityMode);
  const startTracking = useTrackingStore(s => s.startTracking);
  const stopTracking = useTrackingStore(s => s.stopTracking);

  // Keep screen awake when running
  useRunKeepAwake();

  // Animated values
  const startBtnScale = useRef(new Animated.Value(1)).current;
  const controlsFade = useRef(new Animated.Value(0)).current;

  // Show/hide unlocked controls with animation
  useEffect(() => {
    Animated.timing(controlsFade, {
      toValue: isLocked ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isLocked]);

  const onStartPressIn = () =>
    Animated.spring(startBtnScale, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onStartPressOut = () =>
    Animated.spring(startBtnScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();

  const handleScreenTap = () => {
    if (!isLocked) return;
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (newCount >= 2) {
      setIsLocked(false);
      setTapCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      tapTimer.current = setTimeout(() => setTapCount(0), 500);
    }
  };

  async function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivityMode('running');
    await startTracking();
    setRunState('running');
    setIsLocked(true);
  }

  function handleStop() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopTracking();
    setRunState('stopped');
  }

  const selectedRouteName = MOCK_ROUTES.find(r => r.id === selectedRoute)?.name;

  // Format display values
  const distDisplay = locationAvailable ? formatDistance(distanceM, 'km', 2) : '--';
  const durationDisplay = formatDuration(durationS);
  // Pace: min/km (seconds per meter → minutes per km)
  const paceDisplay = (() => {
    if (!locationAvailable || distanceM < 10) return '--';
    const secPerKm = durationS / (distanceM / 1000);
    const paceMin = Math.floor(secPerKm / 60);
    const paceSec = Math.round(secPerKm % 60);
    return `${paceMin}'${String(paceSec).padStart(2, '0')}"`;
  })();

  // ── Stopped state ──────────────────────────────────────────────────────────
  if (runState === 'stopped') {
    const distKm = formatDistance(distanceM, 'km', 2);
    const handleShare = async () => {
      try {
        await Share.share({ message: `I completed a ${distKm} km run on Cairn!` });
      } catch (_) { /* sharing unavailable */ }
    };

    return (
      <SafeAreaView style={preStyles.container} edges={['top', 'bottom']}>
        <View style={preStyles.header}>
          <View style={preStyles.topBar}>
            <View style={{ width: 60 }} />
            <Text style={preStyles.title}>Run Complete</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={preStyles.subtitle}>Session saved</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl }}>
          <Icon name="CircleCheck" size={56} color={Colors.primary} strokeWidth={1.5} />
          <View style={preStyles.summaryCard}>
            <View style={preStyles.summaryStatRow}>
              <View style={preStyles.summaryStat}>
                <Text style={preStyles.summaryStatVal}>{distKm}</Text>
                <Text style={preStyles.summaryStatLbl}>km</Text>
              </View>
              <View style={preStyles.summaryDivider} />
              <View style={preStyles.summaryStat}>
                <Text style={preStyles.summaryStatVal}>{durationDisplay}</Text>
                <Text style={preStyles.summaryStatLbl}>elapsed</Text>
              </View>
              <View style={preStyles.summaryDivider} />
              <View style={preStyles.summaryStat}>
                <Text style={preStyles.summaryStatVal}>{paceDisplay}</Text>
                <Text style={preStyles.summaryStatLbl}>pace</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={preStyles.shareBtn} onPress={handleShare}>
            <Icon name="Send" size={16} color={Colors.primary} strokeWidth={2} />
            <Text style={preStyles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
        <View style={preStyles.footer}>
          <TouchableOpacity onPress={() => { setRunState('pre'); }}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={preStyles.startBtn}
              >
                <Icon name="PlayCircle" size={IconSize.md} color="#fff" strokeWidth={2} />
                <Text style={preStyles.startBtnText}>New Run</Text>
              </LinearGradient>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Pre-start ─────────────────────────────────────────────────────────────
  if (runState === 'pre') {
    return (
      <SafeAreaView style={preStyles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={preStyles.header}>
          <View style={preStyles.topBar}>
            <BackButton variant="inline" />
            <Text style={preStyles.title}>Running Mode</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={preStyles.subtitle}>Select a route (optional)</Text>
        </View>

        {/* Route list */}
        <View style={preStyles.routeList}>
          {/* Free run */}
          <TouchableOpacity
            style={[preStyles.routeCard, selectedRoute === null && preStyles.routeCardSelectedGreen]}
            onPress={() => setSelectedRoute(null)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primaryDeep]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={preStyles.routeIconBadge}
            >
              <Icon name="Target" size={IconSize.md} color={Colors.primary} strokeWidth={1.8} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={preStyles.routeName}>Free Run</Text>
              <Text style={preStyles.routeMeta}>GPS tracking · Any route</Text>
            </View>
            {selectedRoute === null && (
              <View style={[preStyles.checkBadge, { backgroundColor: Colors.primary }]}>
                <Icon name="Check" size={14} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          {MOCK_ROUTES.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[preStyles.routeCard, selectedRoute === r.id && preStyles.routeCardSelected]}
              onPress={() => setSelectedRoute(r.id)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.runningLight, Colors.runningGrad]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={preStyles.routeIconBadge}
              >
                <Icon name="Route" size={IconSize.md} color={Colors.running} strokeWidth={1.8} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={preStyles.routeName}>{r.name}</Text>
                <Text style={preStyles.routeMeta}>{r.distanceKm} km</Text>
              </View>
              {selectedRoute === r.id && (
                <View style={[preStyles.checkBadge, { backgroundColor: Colors.running }]}>
                  <Icon name="Check" size={14} color="#fff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Start footer */}
        <View style={preStyles.footer}>
          <Animated.View style={{ transform: [{ scale: startBtnScale }] }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleStart}
              onPressIn={onStartPressIn}
              onPressOut={onStartPressOut}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={preStyles.startBtn}
              >
                <Icon name="Play" size={IconSize.md} color="#fff" strokeWidth={2} />
                <Text style={preStyles.startBtnText}>Start Running</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <View style={preStyles.lockHintRow}>
            <Icon name="Lock" size={16} color={Colors.textMuted} strokeWidth={2} />
            <Text style={preStyles.lockHint}>Double-tap to unlock</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Running (locked + unlocked) ───────────────────────────────────────────
  return (
    <View style={runStyles.container}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={handleScreenTap}
        activeOpacity={1}
      >
        <View style={runStyles.bg}>
          {/* Stats bar */}
          <SafeAreaView edges={['top']}>
            <View style={runStyles.statsBar}>
              <StatItem value={distDisplay} label="km" />
              <StatItem value={durationDisplay} label="elapsed" />
              <StatItem value={paceDisplay} label="pace" />
              <View style={[runStyles.statItem, { justifyContent: 'center' }]}>
                <View style={[runStyles.gpsIndicator, { backgroundColor: locationAvailable ? Colors.success : Colors.textMuted }]} />
                <Text style={runStyles.statLabel}>{locationAvailable ? 'GPS' : 'Offline'}</Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Compass area */}
          <View style={runStyles.compassArea}>
            <View style={runStyles.compassRing}>
              <Icon name="Navigation" size={72} color={Colors.primary} strokeWidth={1.5} />
              <Text style={runStyles.compassDir}>Keep going</Text>
            </View>
            {selectedRouteName && (
              <Text style={runStyles.routeLabel}>{selectedRouteName}</Text>
            )}
          </View>

          {/* Lock indicator — premium lock screen */}
          {isLocked && (
            <View style={runStyles.lockScreen}>
              {/* GPS pulsing indicator */}
              <PulsingDot active={locationAvailable} />
              {/* Primary stat: elapsed */}
              <Text style={runStyles.lockPrimary}>{durationDisplay}</Text>
              {/* Secondary row */}
              <View style={runStyles.lockSecondary}>
                <Text style={runStyles.lockSecStat}>{distDisplay} <Text style={runStyles.lockSecUnit}>km</Text></Text>
                <View style={runStyles.lockSecDivider} />
                <Text style={runStyles.lockSecStat}>{paceDisplay} <Text style={runStyles.lockSecUnit}>min/km</Text></Text>
              </View>
              {/* Hint */}
              <Text style={runStyles.lockText}>Double-tap to unlock</Text>
              <View style={runStyles.tapDots}>
                {[0, 1].map(i => (
                  <View key={i} style={[runStyles.tapDot, i < tapCount && runStyles.tapDotActive]} />
                ))}
              </View>
            </View>
          )}

          {/* Unlocked controls — fade in */}
          <Animated.View style={[runStyles.unlockedWrap, { opacity: controlsFade }]} pointerEvents={isLocked ? 'none' : 'box-none'}>
            <SafeAreaView edges={['bottom']}>
              <View style={runStyles.unlockedRow}>
                <TouchableOpacity
                  style={runStyles.stopBtn}
                  onPress={handleStop}
                >
                  <Icon name="Square" size={IconSize.sm} color="#fff" strokeWidth={2.5} />
                  <Text style={runStyles.stopBtnText}>Stop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={runStyles.relockBtn}
                  onPress={() => setIsLocked(true)}
                >
                  <Icon name="Lock" size={IconSize.sm} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  <Text style={runStyles.relockText}>Lock Screen</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles: pre-run ─────────────────────────────────────────────────────────
const preStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: Spacing.md, alignSelf: 'flex-start',
  },
  backText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  title: {
    fontSize: FontSize.h3, fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 4 },

  routeList: { flex: 1, paddingHorizontal: Spacing.base, gap: Spacing.sm },
  routeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderLeftWidth: 3, borderLeftColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  routeCardSelected: { borderLeftColor: Colors.running, backgroundColor: Colors.runningCardBg },
  routeCardSelectedGreen: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryBg },
  routeIconBadge: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  checkBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.running, alignItems: 'center', justifyContent: 'center',
  },

  footer: { padding: Spacing.xl, gap: Spacing.sm },
  startBtn: {
    borderRadius: Radius.button,
    paddingVertical: Spacing.lg, alignItems: 'center',
    flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.h3 },
  lockHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  lockHint: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 22,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  shareBtnText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.caption },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.base,
    width: '100%', ...Shadow.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryStatRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  summaryStat: { flex: 1, alignItems: 'center', gap: 4 },
  summaryStatVal: {
    fontSize: FontSize.h2, fontWeight: '800',
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  summaryStatLbl: { fontSize: FontSize.small, color: Colors.textSecondary },
  summaryDivider: { width: 1, height: 36, backgroundColor: Colors.border },
});

// ── Styles: running ─────────────────────────────────────────────────────────
const runStyles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1, backgroundColor: Colors.runningBg },

  statsBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.runningBorder,
    gap: Spacing.base,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.h2, fontWeight: '800', color: Colors.runningText, letterSpacing: -0.5 },
  statLabel: { fontSize: FontSize.tiny, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.5 },
  gpsIndicator: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },

  compassArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  compassRing: {
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 1.5, borderColor: 'rgba(93,124,70,0.4)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
    gap: Spacing.sm,
  },
  compassDir: {
    fontSize: FontSize.small, color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  routeLabel: {
    fontSize: FontSize.small, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', paddingHorizontal: Spacing.xl,
  },

  lockScreen: {
    alignItems: 'center', paddingBottom: 60, gap: Spacing.md,
  },
  lockPrimary: {
    fontSize: 60, fontWeight: '200', color: '#ffffff',
    letterSpacing: -2, lineHeight: 68,
  },
  lockSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
  },
  lockSecStat: {
    fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.85)',
  },
  lockSecUnit: {
    fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.5)',
  },
  lockSecDivider: {
    width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pulsingDot: {
    width: 14, height: 14, borderRadius: 7, marginBottom: Spacing.sm,
  },
  lockText: { fontSize: FontSize.caption, color: 'rgba(255,255,255,0.4)' },
  tapDots: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  tapDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  tapDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  unlockedWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  unlockedRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  stopBtn: {
    flex: 2, backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingVertical: Spacing.lg, alignItems: 'center',
    flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center',
    ...Shadow.fab,
  },
  stopBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.h3 },
  relockBtn: {
    flex: 1, borderRadius: Radius.button, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: Spacing.xs,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  relockText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: FontSize.caption },
});
