/**
 * RunningScreen — design.jpg "跑步模式"
 *
 * States:
 * 1. Pre-start: route selection (from planned routes or none)
 * 2. Running — LOCKED: large direction indicator, GPS stats, double-tap to unlock
 * 3. Stopped: "插旗" button appears bottom-right
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, PanResponder, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: W, height: H } = Dimensions.get('window');

const MOCK_ROUTES = [
  { id: 'r1', name: 'Tongariro Alpine Crossing', distanceKm: 19.4 },
  { id: 'r2', name: 'Kepler Track Day 1', distanceKm: 14.6 },
  { id: 'r3', name: 'Routeburn Flats', distanceKm: 8.1 },
];

type RunState = 'pre' | 'running' | 'stopped';

export function RunningScreen() {
  const nav = useNavigation<Nav>();
  const [runState, setRunState] = useState<RunState>('pre');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulated running stats
  const [elapsed, setElapsed] = useState({ km: 3.2, min: 18, pace: '5\'38"', hr: 152 });

  // Double-tap to unlock
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

  // ── Pre-start ───────────────────────────────────────────────────────────────
  if (runState === 'pre') {
    return (
      <SafeAreaView style={preStyles.container} edges={['top', 'bottom']}>
        <View style={preStyles.header}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={preStyles.back}>← 返回</Text>
          </TouchableOpacity>
          <Text style={preStyles.title}>跑步模式</Text>
          <Text style={preStyles.subtitle}>选择路线（可选）</Text>
        </View>

        <View style={preStyles.routeList}>
          {/* No route option */}
          <TouchableOpacity
            style={[preStyles.routeCard, selectedRoute === null && preStyles.routeCardSelected]}
            onPress={() => setSelectedRoute(null)}
          >
            <View style={preStyles.routeIcon}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={preStyles.routeName}>自由跑步</Text>
              <Text style={preStyles.routeMeta}>不选路线，GPS追踪 + 偏离提醒</Text>
            </View>
            {selectedRoute === null && <Text style={preStyles.selectedCheck}>✓</Text>}
          </TouchableOpacity>

          {MOCK_ROUTES.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[preStyles.routeCard, selectedRoute === r.id && preStyles.routeCardSelected]}
              onPress={() => setSelectedRoute(r.id)}
            >
              <View style={preStyles.routeIcon}>
                <Text style={{ fontSize: 22 }}>🗺️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={preStyles.routeName}>{r.name}</Text>
                <Text style={preStyles.routeMeta}>{r.distanceKm} km</Text>
              </View>
              {selectedRoute === r.id && <Text style={preStyles.selectedCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={preStyles.footer}>
          <TouchableOpacity
            style={preStyles.startBtn}
            onPress={() => { setRunState('running'); setIsLocked(true); }}
          >
            <Text style={preStyles.startBtnText}>▶  开始跑步</Text>
          </TouchableOpacity>
          <Text style={preStyles.lockHint}>启动后屏幕锁定 · 双击解锁</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Running — Locked ────────────────────────────────────────────────────────
  return (
    <View style={runStyles.container}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={handleScreenTap}
        activeOpacity={1}
      >
        {/* Background — dark, minimal */}
        <View style={runStyles.bg}>
          {/* Top stats strip */}
          <SafeAreaView edges={['top']}>
            <View style={runStyles.statsBar}>
              <View style={runStyles.statItem}>
                <Text style={runStyles.statValue}>{elapsed.km}</Text>
                <Text style={runStyles.statLabel}>公里</Text>
              </View>
              <View style={runStyles.statItem}>
                <Text style={runStyles.statValue}>{elapsed.min}</Text>
                <Text style={runStyles.statLabel}>分钟</Text>
              </View>
              <View style={runStyles.statItem}>
                <Text style={runStyles.statValue}>{elapsed.pace}</Text>
                <Text style={runStyles.statLabel}>配速</Text>
              </View>
              <View style={runStyles.statItem}>
                <Text style={runStyles.statValue}>{elapsed.hr}</Text>
                <Text style={runStyles.statLabel}>心率</Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Large direction compass */}
          <View style={runStyles.compassArea}>
            <View style={runStyles.compassRing}>
              <Text style={runStyles.compassArrow}>▼</Text>
              <Text style={runStyles.compassDir}>继续前进</Text>
            </View>
            {selectedRoute && (
              <Text style={runStyles.routeName}>
                {MOCK_ROUTES.find(r => r.id === selectedRoute)?.name}
              </Text>
            )}
          </View>

          {/* Lock indicator */}
          {isLocked ? (
            <View style={runStyles.lockIndicator}>
              <Text style={runStyles.lockIcon}>🔒</Text>
              <Text style={runStyles.lockText}>双击屏幕解锁</Text>
              <View style={runStyles.tapDots}>
                {[0, 1].map(i => (
                  <View key={i} style={[runStyles.tapDot, i < tapCount && runStyles.tapDotActive]} />
                ))}
              </View>
            </View>
          ) : (
            // Unlocked controls
            <SafeAreaView edges={['bottom']} style={runStyles.unlockedControls}>
              <View style={runStyles.unlockedRow}>
                <TouchableOpacity
                  style={runStyles.unlockStopBtn}
                  onPress={() => setRunState('stopped')}
                >
                  <Text style={runStyles.unlockStopText}>■  停止</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={runStyles.relockBtn}
                  onPress={() => setIsLocked(true)}
                >
                  <Text style={runStyles.relockText}>🔒 重新锁定</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </View>
      </TouchableOpacity>

      {/* Flag button when stopped */}
      {runState === 'stopped' && (
        <TouchableOpacity
          style={runStyles.flagFab}
          onPress={() => Alert.alert('插旗', '已记录位置')}
        >
          <Text style={{ fontSize: 24 }}>📍</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const preStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  back: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.sm },
  title: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 4 },
  routeList: { flex: 1, paddingHorizontal: Spacing.base, gap: Spacing.sm },
  routeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md,
    borderWidth: 2, borderColor: 'transparent', ...Shadow.card,
  },
  routeCardSelected: { borderColor: '#3d7ab5', backgroundColor: 'rgba(61,122,181,0.04)' },
  routeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  selectedCheck: { fontSize: 18, color: '#3d7ab5', fontWeight: '800' },
  footer: { padding: Spacing.xl, gap: Spacing.sm },
  startBtn: { backgroundColor: '#3d7ab5', borderRadius: Radius.button, paddingVertical: Spacing.lg, alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.h3 },
  lockHint: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center' },
});

const runStyles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1, backgroundColor: '#0d1a0d' },
  statsBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.base,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.h2, fontWeight: '800', color: '#e8f5e8' },
  statLabel: { fontSize: FontSize.tiny, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  compassArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  compassRing: {
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 2, borderColor: 'rgba(93,124,70,0.5)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(93,124,70,0.1)',
    gap: Spacing.xs,
  },
  compassArrow: { fontSize: 80, color: Colors.primary },
  compassDir: { fontSize: FontSize.caption, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  routeName: { fontSize: FontSize.small, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: Spacing.xl },

  lockIndicator: { alignItems: 'center', paddingBottom: 60, gap: Spacing.sm },
  lockIcon: { fontSize: 28 },
  lockText: { fontSize: FontSize.caption, color: 'rgba(255,255,255,0.4)' },
  tapDots: { flexDirection: 'row', gap: Spacing.md, marginTop: 8 },
  tapDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  tapDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  unlockedControls: { paddingBottom: Spacing.lg },
  unlockedRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  unlockStopBtn: {
    flex: 2, backgroundColor: Colors.danger, borderRadius: Radius.button,
    paddingVertical: Spacing.lg, alignItems: 'center',
    ...Shadow.fab,
  },
  unlockStopText: { color: '#fff', fontWeight: '800', fontSize: FontSize.h3 },
  relockBtn: {
    flex: 1, borderRadius: Radius.button, paddingVertical: Spacing.lg,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  relockText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: FontSize.caption },

  flagFab: {
    position: 'absolute', bottom: 60, right: Spacing.xl,
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.fab,
  },
});
