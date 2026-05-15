/**
 * HomeScreen — Sprint 18 recent activity strip
 *
 * Design: design_interpretation.md page 2
 * - Time-based English greeting (Good morning/afternoon/evening)
 * - Recent activity strip (last session, if any)
 * - 2 large activity cards: Hiking, Running
 * - 3 entry buttons: Map, Friends, Settings
 * - No bottom tab bar (per design doc)
 * - Spring press animations + staggered entrance
 * - Competitor quality: AllTrails/Strava card hierarchy
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon, type IconName } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import { useSessionStore } from '../store/useSessionStore';
import { useMarkerStore } from '../store/useMarkerStore';
import { formatDistance, formatDuration } from '../utils/geo';
import { getCurrentRegion } from '../config/regions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Time greeting ─────────────────────────────────────────────────────────────
function getGreeting(mode: 'beginner' | 'expert', hasData: boolean) {
  if (!hasData) return 'Welcome to Cairn';
  const h = new Date().getHours();
  const modeLabel = mode === 'expert' ? 'Navigator' : 'Explorer';
  if (h >= 5 && h < 12) return `Good morning, ${modeLabel}`;
  if (h >= 12 && h < 18) return `Good afternoon, ${modeLabel}`;
  return `Good evening, ${modeLabel}`;
}

// ── Quick Stats Row ───────────────────────────────────────────────────────────
function QuickStats({ sessions, markerCount }: { sessions: any[]; markerCount: number }) {
  const totalDistM = sessions.reduce((acc, s) => acc + s.distanceM, 0);
  const stat1Anim = useRef(new Animated.Value(0)).current;
  const stat2Anim = useRef(new Animated.Value(0)).current;
  const stat3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(60, [
      Animated.timing(stat1Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(stat2Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(stat3Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const capsule = (anim: Animated.Value, icon: IconName, value: string, unit: string, color: string, bg: string) => (
    <Animated.View style={[statsStyles.capsule, { opacity: anim }]}>
      <View style={[statsStyles.capIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={14} color={color} strokeWidth={1.8} />
      </View>
      <Text style={statsStyles.capValue}>{value}</Text>
      <Text style={statsStyles.capUnit}>{unit}</Text>
    </Animated.View>
  );

  return (
    <View style={statsStyles.row}>
      {capsule(stat1Anim, 'Route', String(sessions.length), sessions.length === 1 ? 'session' : 'sessions', Colors.primary, Colors.primaryLight)}
      {capsule(stat2Anim, 'Map', formatDistance(totalDistM, 'km', 1), 'km', '#3d7ab5', 'rgba(61,122,181,0.12)')}
      {capsule(stat3Anim, 'Flag', String(markerCount), markerCount === 1 ? 'flag' : 'flags', '#c87941', 'rgba(200,121,65,0.12)')}
    </View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function HomeEmptyState({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={emptyStyles.card}>
      <View style={emptyStyles.iconRow}>
        <Animated.View style={[emptyStyles.iconCircle, { backgroundColor: Colors.primaryLight, transform: [{ scale: pulse }] }]}>
          <Icon name="Mountain" size={24} color={Colors.primary} strokeWidth={1.5} />
        </Animated.View>
        <View style={[emptyStyles.iconCircle, { backgroundColor: 'rgba(61,122,181,0.12)', marginLeft: -10 }]}>
          <Icon name="Flag" size={20} color="#3d7ab5" strokeWidth={1.5} />
        </View>
      </View>
      <Text style={emptyStyles.heading}>Your adventure begins here</Text>
      <Text style={emptyStyles.body}>Start your first hike or run to see your stats and history</Text>
      <TouchableOpacity style={emptyStyles.cta} onPress={onPress} activeOpacity={0.8}>
        <Icon name="Play" size={14} color="#fff" strokeWidth={2.5} />
        <Text style={emptyStyles.ctaText}>Start a Hike</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── How It Works Row ──────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: 'Flag' as IconName, label: 'Plant flags', color: Colors.primary, bg: Colors.primaryLight },
    { icon: 'Users' as IconName, label: 'Share with friends', color: '#3d7ab5', bg: 'rgba(61,122,181,0.15)' },
    { icon: 'Compass' as IconName, label: 'Guide others', color: '#c87941', bg: 'rgba(200,121,65,0.12)' },
  ];
  return (
    <View style={howStyles.row}>
      {steps.map((s, i) => (
        <View key={i} style={howStyles.step}>
          <View style={[howStyles.iconCircle, { backgroundColor: s.bg }]}>
            <Icon name={s.icon} size={18} color={s.color} strokeWidth={1.8} />
          </View>
          <Text style={howStyles.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Recent Activity Strip ─────────────────────────────────────────────────────
function RecentActivityStrip({ onPress }: { onPress: () => void }) {
  const sessions = useSessionStore(s => s.sessions);
  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const last = sorted[0];
  const isRun = last.activityMode === 'running';
  const date = new Date(last.startedAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const label = last.name ?? `${isRun ? 'Run' : 'Hike'} · ${dateStr}`;
  const flagCount = last.markerIds?.length ?? 0;
  const elevStr = `+${last.elevationGainM ?? 0}m elev`;
  const flagStr = `${flagCount} flag${flagCount !== 1 ? 's' : ''}`;

  return (
    <View style={recentStyles.stripWrap}>
      <TouchableOpacity style={recentStyles.strip} onPress={onPress} activeOpacity={0.8}>
        <View style={[recentStyles.iconWrap, { backgroundColor: isRun ? 'rgba(61,122,181,0.12)' : Colors.primaryLight }]}>
          <Icon name={isRun ? 'PersonStanding' : 'Mountain'} size={20} color={isRun ? '#3d7ab5' : Colors.primary} strokeWidth={1.8} />
        </View>
        <View style={recentStyles.info}>
          <Text style={recentStyles.label} numberOfLines={1}>{label}</Text>
          <Text style={recentStyles.stats}>
            {formatDistance(last.distanceM, 'km', 1)} km · {formatDuration(last.durationS)}
          </Text>
          <Text style={recentStyles.statsExtra}>{elevStr} · {flagStr}</Text>
        </View>
        <Icon name="ChevronRight" size={IconSize.sm} color={Colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>
      {sessions.length >= 2 && (
        <TouchableOpacity style={recentStyles.viewAll} onPress={onPress}>
          <Text style={recentStyles.viewAllText}>View all</Text>
          <Icon name="ChevronRight" size={12} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}


function ActivityCard({
  iconName, title, subtitle, accentColor, gradientColors, onPress, entranceAnim,
}: {
  iconName: IconName;
  title: string;
  subtitle: string;
  accentColor: string;
  gradientColors: [string, string, string];
  onPress: () => void;
  entranceAnim: Animated.Value;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();
  };

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  return (
    <Animated.View style={{ opacity: entranceAnim, transform: [{ scale }, { translateY }] }}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activityCard}
        >
          <LinearGradient
            colors={[accentColor + '33', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.activityIconBadge}
          >
            <Icon name={iconName} size={IconSize.xl} color={accentColor} strokeWidth={1.8} />
          </LinearGradient>
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>{title}</Text>
            <Text style={styles.activitySubtitle}>{subtitle}</Text>
          </View>
          <View style={[styles.activityChevronPill, { backgroundColor: accentColor + '18' }]}>
            <Icon name="ChevronRight" size={IconSize.sm} color={accentColor} strokeWidth={2.5} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Entry Button ──────────────────────────────────────────────────────────────
function EntryButton({ iconName, label, onPress }: {
  iconName: IconName; label: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale }] }]}>
      <TouchableOpacity style={styles.entryBtn} onPress={onPress} activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.entryIconWrap}>
          <Icon name={iconName} size={IconSize.lg} color={Colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={styles.entryLabel}>{label}</Text>
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

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    Animated.stagger(80, [
      Animated.spring(card1Anim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      Animated.spring(card2Anim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <Animated.View style={[{ flex: 1 }, { opacity: screenOpacity }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logo}>Cairn</Text>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>β</Text>
              </View>
            </View>
            <Text style={styles.greeting}>{getGreeting(uiMode, hasData)}</Text>
            <Text style={styles.headerSub}>Where are you headed today?</Text>
          </View>

          {/* Quick Stats or Empty State */}
          {hasData
            ? <QuickStats sessions={sessions} markerCount={markerCount} />
            : <>
                <HomeEmptyState onPress={() => nav.navigate('Hiking')} />
                <HowItWorks />
              </>
          }

          {/* Activity Cards */}
          <RecentActivityStrip onPress={() => nav.navigate('MapHistory')} />
          <View style={styles.cardsSection}>
            <ActivityCard
              iconName="Mountain"
              title="Hiking"
              subtitle="Navigate trails · Plant flags · Explore"
              accentColor={Colors.primary}
              gradientColors={['#ffffff', '#f6f9f3', '#eef4e8']}
              onPress={() => nav.navigate('Hiking')}
              entranceAnim={card1Anim}
            />
            <ActivityCard
              iconName="PersonStanding"
              title="Running"
              subtitle="Route planning · Voice guidance · Lock mode"
              accentColor="#3d7ab5"
              gradientColors={['#ffffff', '#f3f7fc', '#e8f1f8']}
              onPress={() => nav.navigate('Running')}
              entranceAnim={card2Anim}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Tools</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Entry Buttons */}
          <View style={styles.entriesRow}>
            <EntryButton iconName="Map" label="Map" onPress={() => nav.navigate('MapHistory')} />
            <EntryButton iconName="Users" label="Friends" onPress={() => nav.navigate('Friends')} />
            <EntryButton iconName="Settings2" label="Settings" onPress={() => nav.navigate('Settings')} />
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },

  header: { marginBottom: Spacing.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  logo: { fontSize: 36, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1.5 },
  logoBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
  },
  logoBadgeText: { fontSize: FontSize.tiny, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  greeting: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  headerSub: { fontSize: FontSize.body, color: Colors.textSecondary },

  cardsSection: { gap: Spacing.md, marginBottom: Spacing.xl },
  activityCard: {
    borderRadius: Radius.cardLg ?? 20,
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
    ...Shadow.card, borderWidth: 1, borderColor: Colors.border,
  },
  activityIconBadge: {
    width: 68, height: 68, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  activityText: { flex: 1 },
  activityTitle: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  activitySubtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 18 },
  activityChevronPill: {
    width: 32, height: 32, borderRadius: Radius.circle ?? 50,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.base },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  entriesRow: { flexDirection: 'row', gap: Spacing.sm },
  entryBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.card,
    alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.xs,
    ...Shadow.card, borderWidth: 1, borderColor: Colors.border,
    minHeight: 80, justifyContent: 'center',
  },
  entryIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  entryLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary },
});

const recentStyles = StyleSheet.create({
  stripWrap: { marginBottom: Spacing.md },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  label: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary },
  stats: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  statsExtra: { fontSize: FontSize.tiny, color: Colors.textMuted, marginTop: 1 },
  viewAll: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    alignSelf: 'flex-end', paddingTop: Spacing.xs, paddingRight: 2,
  },
  viewAllText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.primary },
});

const statsStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  capsule: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.button ?? 12,
    paddingVertical: 10, paddingHorizontal: 10,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  capIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  capValue: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  capUnit: { fontSize: FontSize.tiny, color: Colors.textMuted, fontWeight: '500', marginTop: 1 },
});

const emptyStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.cardLg ?? 20,
    alignItems: 'center', padding: Spacing.xl, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  iconCircle: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  body: { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.button ?? 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  ctaText: { fontSize: FontSize.caption, fontWeight: '700', color: '#fff' },
});

const howStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: FontSize.tiny, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500', lineHeight: 14 },
});
