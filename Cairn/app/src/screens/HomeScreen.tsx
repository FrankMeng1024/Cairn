/**
 * HomeScreen — design.jpg page 2 "功能选择页"
 *
 * Sprint 6 redesign:
 * - Time-of-day greeting (早上好 / 下午好 / 晚上好)
 * - SVG icons via lucide-react-native (no emoji in interactive elements)
 * - Spring-physics card press animations (scale 0.97 on press-in)
 * - Staggered entrance: cards slide up + fade in, 80ms stagger
 * - Screen fade-in on mount
 * - LinearGradient on activity cards for visual depth
 * - Entry buttons min height 80px, icon + label layout
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Time greeting ─────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '早上好';
  if (h >= 12 && h < 18) return '下午好';
  return '晚上好';
}

// ── Activity Card ─────────────────────────────────────────────────────────────
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
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();
  };

  const translateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });

  return (
    <Animated.View style={{ opacity: entranceAnim, transform: [{ scale }, { translateY }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activityCard}
        >
          {/* Left: icon badge */}
          <View style={[styles.activityIconBadge, { backgroundColor: accentColor + '20' }]}>
            <Icon name={iconName} size={IconSize.xl} color={accentColor} strokeWidth={1.8} />
          </View>

          {/* Center: text */}
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>{title}</Text>
            <Text style={styles.activitySubtitle}>{subtitle}</Text>
          </View>

          {/* Right: chevron pill */}
          <View style={[styles.activityChevronPill, { backgroundColor: accentColor + '18' }]}>
            <Icon name="ChevronRight" size={IconSize.sm} color={accentColor} strokeWidth={2.5} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Entry Button ──────────────────────────────────────────────────────────────
function EntryButton({
  iconName, label, onPress,
}: {
  iconName: IconName;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 8,
    }).start();
  };

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={styles.entryBtn}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
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

  // Screen entrance fade
  const screenOpacity = useRef(new Animated.Value(0)).current;

  // Per-card entrance animations
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Screen fade in
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();

    // Staggered card entrance
    Animated.stagger(80, [
      Animated.spring(card1Anim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      Animated.spring(card2Anim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <Animated.View style={[{ flex: 1 }, { opacity: screenOpacity }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logo}>Cairn</Text>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>β</Text>
              </View>
            </View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.headerSub}>选择今天的活动</Text>
          </View>

          {/* Activity Cards */}
          <View style={styles.cardsSection}>
            <ActivityCard
              iconName="Mountain"
              title="徒步"
              subtitle="地图导航 · 插旗标记 · 探索步道"
              accentColor={Colors.primary}
              gradientColors={['#ffffff', '#f6f9f3', '#eef4e8']}
              onPress={() => nav.navigate('Hiking')}
              entranceAnim={card1Anim}
            />
            <ActivityCard
              iconName="PersonStanding"
              title="跑步"
              subtitle="路线规划 · 语音播报 · 锁屏模式"
              accentColor="#3d7ab5"
              gradientColors={['#ffffff', '#f3f7fc', '#e8f1f8']}
              onPress={() => nav.navigate('Running')}
              entranceAnim={card2Anim}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>工具</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Entry Buttons */}
          <View style={styles.entriesRow}>
            <EntryButton iconName="Map" label="地图" onPress={() => nav.navigate('MapHistory')} />
            <EntryButton iconName="Users" label="好友" onPress={() => nav.navigate('Friends')} />
            <EntryButton iconName="Settings2" label="设置" onPress={() => nav.navigate('Settings')} />
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

  // Header
  header: { marginBottom: Spacing.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  logoBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 4,
  },
  logoBadgeText: { fontSize: FontSize.tiny, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  greeting: {
    fontSize: FontSize.h2,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },

  // Activity cards
  cardsSection: { gap: Spacing.md, marginBottom: Spacing.xl },
  activityCard: {
    borderRadius: Radius.cardLg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1 },
  activityTitle: {
    fontSize: FontSize.h2,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  activityChevronPill: {
    width: 32,
    height: 32,
    borderRadius: Radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontSize: FontSize.small,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Entry buttons
  entriesRow: { flexDirection: 'row', gap: Spacing.sm },
  entryBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
    ...Shadow.card,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    justifyContent: 'center',
  },
  entryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  entryLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
