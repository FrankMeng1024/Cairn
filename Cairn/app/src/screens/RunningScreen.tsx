/**
 * RunningScreen — Sprint 7 redesign
 *
 * States:
 * 1. Pre-start: route selection with SVG icons, animated start button
 * 2. Running — LOCKED: stats bar, compass ring, lock indicator (SVG icons)
 * 3. Running — UNLOCKED: stop/relock controls fade in
 *
 * expo-keep-awake: activates when runState === 'running'
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { MOCK_ROUTES } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RunState = 'pre' | 'running' | 'stopped';

// ── Keep-awake guard ────────────────────────────────────────────────────────
function useRunKeepAwake(active: boolean) {
  // expo-keep-awake: hook must be called unconditionally, we pass activation flag
  useKeepAwake(active ? undefined : 'INACTIVE');
}

// ── Stat item ───────────────────────────────────────────────────────────────
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

  // Keep screen awake when running
  useRunKeepAwake(runState === 'running');

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
    } else {
      tapTimer.current = setTimeout(() => setTapCount(0), 500);
    }
  };

  const selectedRouteName = MOCK_ROUTES.find(r => r.id === selectedRoute)?.name;

  // ── Pre-start ─────────────────────────────────────────────────────────────
  if (runState === 'pre') {
    return (
      <SafeAreaView style={preStyles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={preStyles.header}>
          <TouchableOpacity style={preStyles.backBtn} onPress={() => nav.goBack()}>
            <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
            <Text style={preStyles.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={preStyles.title}>跑步模式</Text>
          <Text style={preStyles.subtitle}>选择路线（可选）</Text>
        </View>

        {/* Route list */}
        <View style={preStyles.routeList}>
          {/* Free run */}
          <TouchableOpacity
            style={[preStyles.routeCard, selectedRoute === null && preStyles.routeCardSelected]}
            onPress={() => setSelectedRoute(null)}
            activeOpacity={0.85}
          >
            <View style={[preStyles.routeIconBadge, { backgroundColor: Colors.primaryLight }]}>
              <Icon name="Target" size={IconSize.md} color={Colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={preStyles.routeName}>自由跑步</Text>
              <Text style={preStyles.routeMeta}>GPS追踪 · 不限路线</Text>
            </View>
            {selectedRoute === null && (
              <View style={preStyles.checkBadge}>
                <Text style={preStyles.checkText}>✓</Text>
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
              <View style={[preStyles.routeIconBadge, { backgroundColor: 'rgba(61,122,181,0.12)' }]}>
                <Icon name="Route" size={IconSize.md} color="#3d7ab5" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={preStyles.routeName}>{r.name}</Text>
                <Text style={preStyles.routeMeta}>{r.distanceKm} km</Text>
              </View>
              {selectedRoute === r.id && (
                <View style={preStyles.checkBadge}>
                  <Text style={preStyles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Start footer */}
        <View style={preStyles.footer}>
          <Animated.View style={{ transform: [{ scale: startBtnScale }] }}>
            <TouchableOpacity
              style={preStyles.startBtn}
              activeOpacity={1}
              onPress={() => { setRunState('running'); setIsLocked(true); }}
              onPressIn={onStartPressIn}
              onPressOut={onStartPressOut}
            >
              <Icon name="Play" size={IconSize.md} color="#fff" strokeWidth={2} />
              <Text style={preStyles.startBtnText}>开始跑步</Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={preStyles.lockHint}>启动后屏幕锁定 · 双击解锁</Text>
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
              <StatItem value="3.2" label="公里" />
              <StatItem value="18" label="分钟" />
              <StatItem value="5'38&quot;" label="配速" />
              <StatItem value="152" label="心率" />
            </View>
          </SafeAreaView>

          {/* Compass area */}
          <View style={runStyles.compassArea}>
            <View style={runStyles.compassRing}>
              <Icon name="Navigation" size={72} color={Colors.primary} strokeWidth={1.5} />
              <Text style={runStyles.compassDir}>继续前进</Text>
            </View>
            {selectedRouteName && (
              <Text style={runStyles.routeLabel}>{selectedRouteName}</Text>
            )}
          </View>

          {/* Lock indicator */}
          {isLocked && (
            <View style={runStyles.lockIndicator}>
              <Icon name="Lock" size={IconSize.lg} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
              <Text style={runStyles.lockText}>双击屏幕解锁</Text>
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
                  onPress={() => setRunState('stopped')}
                >
                  <Icon name="Square" size={IconSize.sm} color="#fff" strokeWidth={2.5} />
                  <Text style={runStyles.stopBtnText}>停止</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={runStyles.relockBtn}
                  onPress={() => setIsLocked(true)}
                >
                  <Icon name="Lock" size={IconSize.sm} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  <Text style={runStyles.relockText}>重新锁定</Text>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: Spacing.md, alignSelf: 'flex-start',
  },
  backText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  title: {
    fontSize: FontSize.h1, fontWeight: '800',
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 4 },

  routeList: { flex: 1, paddingHorizontal: Spacing.base, gap: Spacing.sm },
  routeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
    borderWidth: 2, borderColor: 'transparent',
    ...Shadow.card,
  },
  routeCardSelected: { borderColor: '#3d7ab5', backgroundColor: 'rgba(61,122,181,0.04)' },
  routeIconBadge: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  checkBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#3d7ab5', alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  footer: { padding: Spacing.xl, gap: Spacing.sm },
  startBtn: {
    backgroundColor: '#3d7ab5', borderRadius: Radius.button,
    paddingVertical: Spacing.lg, alignItems: 'center',
    flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.h3 },
  lockHint: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center' },
});

// ── Styles: running ─────────────────────────────────────────────────────────
const runStyles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1, backgroundColor: '#0a1a0a' },

  statsBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.base,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.h2, fontWeight: '800', color: '#e8f5e8', letterSpacing: -0.5 },
  statLabel: { fontSize: FontSize.tiny, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.5 },

  compassArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  compassRing: {
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 1.5, borderColor: 'rgba(93,124,70,0.4)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(93,124,70,0.08)',
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

  lockIndicator: { alignItems: 'center', paddingBottom: 60, gap: Spacing.sm },
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
