/**
 * HomeScreen — Sprint 41 full-screen layout
 *
 * Layout: flex column, no ScrollView, fills SafeArea exactly.
 * Hierarchy: Header → Stats? → Recent? → Activity Cards (dominant) → Tools row
 * Design: Golden ratio φ=1.618 applied to card proportions and spacing.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';
import { Icon, type IconName } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import { useSessionStore } from '../store/useSessionStore';
import { useMarkerStore } from '../store/useMarkerStore';
import { formatDistance, formatDuration, getRelativeTime } from '../utils/geo';
import { getCurrentRegion } from '../config/regions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function getGreeting(mode: 'beginner' | 'expert') {
  const h = new Date().getHours();
  const label = mode === 'expert' ? 'Navigator' : 'Explorer';
  if (h >= 5 && h < 12) return `Good morning, ${label}`;
  if (h >= 12 && h < 18) return `Good afternoon, ${label}`;
  return `Good evening, ${label}`;
}

// ── Small static cairn logo (3 stacked stones, inline SVG) ───────────────────
function CairnLogo({ size = 22 }: { size?: number }) {
  const s = size / 22;
  const stones = [
    { w: 14 * s, h: 5 * s, color: Colors.primary },
    { w: 19 * s, h: 5 * s, color: '#7a9e5a' },
    { w: 12 * s, h: 5 * s, color: Colors.primary },
  ];
  const gap = 2 * s;
  const totalH = stones.reduce((acc, st) => acc + st.h, 0) + gap * (stones.length - 1);
  const maxW = Math.max(...stones.map(st => st.w));
  return (
    <Svg width={maxW} height={totalH} style={{ overflow: 'visible' }}>
      {stones.map((stone, i) => {
        const y = i * (stones[0].h + gap);
        const x = (maxW - stone.w) / 2;
        return (
          <Rect
            key={i}
            x={x} y={y}
            width={stone.w} height={stone.h}
            rx={stone.h / 2}
            fill={stone.color}
          />
        );
      })}
    </Svg>
  );
}

// ── Compact recent activity row — placed ABOVE cards ─────────────────────────
function RecentRow({ onPress }: { onPress: () => void }) {
  const sessions = useSessionStore(s => s.sessions);
  if (sessions.length === 0) return null;

  const last = sessions.reduce((best, s) => s.startedAt > best.startedAt ? s : best);
  const isRun = last.activityMode === 'running';
  const accent = isRun ? Colors.running : Colors.primary;
  const bg = isRun ? Colors.runningLight : Colors.primaryLight;
  const label = isRun ? 'Run' : 'Hike';
  const stat = last.distanceM > 10
    ? `${formatDistance(last.distanceM, 'km', 1)} km`
    : formatDuration(last.durationS);
  const when = getRelativeTime(last.startedAt);

  return (
    <TouchableOpacity style={recentStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[recentStyles.dot, { backgroundColor: bg }]}>
        <Icon name={isRun ? 'PersonStanding' : 'Mountain'} size={14} color={accent} strokeWidth={2} />
      </View>
      <View style={recentStyles.textGroup}>
        <Text style={[recentStyles.badge, { color: accent }]}>{label}</Text>
        <Text style={recentStyles.stat}>{stat}</Text>
      </View>
      <Text style={recentStyles.when}>{when}</Text>
      <Icon name="ChevronRight" size={14} color={Colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ── Big activity card — golden-ratio proportioned ────────────────────────────
function ActivityCard({
  iconName, title, subtitle, accentColor, lightBg, cardBg, onPress, anim, cardHeight,
}: {
  iconName: IconName;
  title: string;
  subtitle: string;
  accentColor: string;
  lightBg: string;
  cardBg: string;
  onPress: () => void;
  anim: Animated.Value;
  cardHeight: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const h = cardHeight > 0 ? cardHeight : 150;
  const panelW = Math.min(Math.round(h * 0.38), 130);
  const iconSize = Math.round(panelW * 0.55);

  return (
    <Animated.View style={{ height: h, opacity: anim, transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start()}
        style={[cardStyles.card, { backgroundColor: cardBg, height: h, flex: 1 }]}
      >
        {/* Left panel — absolute position ensures it fills card height regardless of RN Web flex quirks */}
        <View style={[cardStyles.leftPanel, { width: panelW, height: h, backgroundColor: lightBg }]}>
          <Icon name={iconName} size={iconSize} color={accentColor} strokeWidth={1.4} />
        </View>

        {/* Text area — explicit height ensures vertical centering on RN Web */}
        <View style={[cardStyles.innerRow, { marginLeft: panelW, height: h }]}>
          <View style={cardStyles.textCol}>
            <Text style={[cardStyles.title, { color: Colors.textPrimary }]}>{title}</Text>
            <Text style={cardStyles.subtitle}>{subtitle}</Text>
            <View style={[cardStyles.accentLine, { backgroundColor: accentColor }]} />
          </View>
          <View style={[cardStyles.chevron, { backgroundColor: lightBg }]}>
            <Icon name="ChevronRight" size={16} color={accentColor} strokeWidth={2.5} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Tool button ───────────────────────────────────────────────────────────────
function ToolBtn({ iconName, label, onPress }: { iconName: IconName; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={toolStyles.btn}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start()}
      >
        <View style={toolStyles.iconWrap}>
          <Icon name={iconName} size={20} color={Colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={toolStyles.label}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const uiMode = useAppStore(s => s.uiMode);
  const sessions = useSessionStore(s => s.sessions);
  const allMarkers = useMarkerStore(s => s.markers);
  const region = getCurrentRegion();
  const markerCount = allMarkers.filter(m => m.regionCode === region.code).length;
  const hasData = sessions.length > 0 || markerCount > 0;
  const hasRecent = sessions.length > 0;

  const [screenH, setScreenH] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    Animated.stagger(70, [
      Animated.spring(card1, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      Animated.spring(card2, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // Compute explicit card heights for RN Web flex compatibility.
  // Count direct children of screen: header + cardsArea + toolsRow (always) + optional rows
  const siblingCount = 3 + (hasData ? 1 : 0) + (hasRecent ? 1 : 0);
  const FIXED_H = 44 + (hasData ? 36 : 0) + (hasRecent ? 46 : 0) + 72 + 20 + Spacing.sm * (siblingCount - 1);
  const cardsH = screenH > 0 ? Math.max(screenH - FIXED_H, 280) : 280;
  const cardH = Math.floor((cardsH - Spacing.sm) / 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <Animated.View
        style={[styles.screen, { opacity }]}
        onLayout={(e: LayoutChangeEvent) => setScreenH(e.nativeEvent.layout.height)}
      >

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <CairnLogo size={22} />
            <Text style={styles.logo}>Cairn</Text>
          </View>
          <Text style={styles.greeting}>{getGreeting(uiMode)}</Text>
        </View>

        {/* Stats strip — only when data exists */}
        {hasData && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Icon name="Route" size={12} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.statText}>{plural(sessions.length, 'session')}</Text>
            </View>
            <View style={styles.statChip}>
              <Icon name="Flag" size={12} color={Colors.flag} strokeWidth={2} />
              <Text style={styles.statText}>{plural(markerCount, 'flag')}</Text>
            </View>
          </View>
        )}

        {/* Recent activity — above the cards so user sees it before cards */}
        {hasRecent && <RecentRow onPress={() => nav.navigate('MapHistory')} />}

        {/* Activity Cards — dominant, fill remaining space */}
        <View style={[styles.cardsArea, { height: cardsH }]}>
          <ActivityCard
            iconName="Mountain"
            title="Hiking"
            subtitle="Navigate trails · Plant flags · Explore"
            accentColor={Colors.primary}
            lightBg={Colors.primaryLight}
            cardBg="#eef4e8"
            onPress={() => nav.navigate('Hiking')}
            anim={card1}
            cardHeight={cardH}
          />
          <ActivityCard
            iconName="PersonStanding"
            title="Running"
            subtitle="Route planning · Voice guidance · Lock mode"
            accentColor={Colors.running}
            lightBg={Colors.runningLight}
            cardBg="#e8f1f8"
            onPress={() => nav.navigate('Running')}
            anim={card2}
            cardHeight={cardH}
          />
        </View>

        {/* Tools */}
        <View style={styles.toolsRow}>
          <ToolBtn iconName="Map" label="Map" onPress={() => nav.navigate('Map')} />
          <ToolBtn iconName="Route" label="Routes" onPress={() => nav.navigate('Routes')} />
          <ToolBtn iconName="Users" label="Friends" onPress={() => nav.navigate('Friends')} />
          <ToolBtn iconName="Settings2" label="Settings" onPress={() => nav.navigate('Settings')} />
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: FontSize.h1, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  greeting: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  statText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },

  cardsArea: { gap: Spacing.sm },

  toolsRow: { flexDirection: 'row', gap: Spacing.sm },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadow.card,
  },
  leftPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: { flex: 1, gap: 5 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 17 },
  accentLine: { width: 24, height: 3, borderRadius: 2, marginTop: 4 },
  chevron: {
    width: 32, height: 32, borderRadius: Radius.card,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});

const recentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  dot: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  badge: { fontSize: FontSize.small, fontWeight: '700' },
  stat: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textPrimary },
  when: { fontSize: FontSize.small, color: Colors.textMuted, flexShrink: 0 },
});

const toolStyles = StyleSheet.create({
  btn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.card,
    alignItems: 'center', paddingVertical: Spacing.md, gap: 4,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },
});
