/**
 * HomeScreen — design.jpg page 2 "功能选择页"
 *
 * Layout:
 *  - Top: Cairn wordmark + greeting
 *  - Middle: 2 large activity cards (Hiking / Running) — full width, prominent
 *  - Bottom: 3 function entry buttons (Map / Friends / Settings) — row
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Activity Card ─────────────────────────────────────────────────────────────
function ActivityCard({
  emoji, title, subtitle, accent, onPress,
}: {
  emoji: string; title: string; subtitle: string; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.activityCard, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.activityEmojiBg, { backgroundColor: accent + '1a' }]}>
        <Text style={styles.activityEmoji}>{emoji}</Text>
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.activityChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Entry Button ──────────────────────────────────────────────────────────────
function EntryButton({
  emoji, label, onPress,
}: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.entryBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.entryEmoji}>{emoji}</Text>
      <Text style={styles.entryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function HomeScreen() {
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Cairn</Text>
          <Text style={styles.headerSub}>选择今天的活动</Text>
        </View>

        {/* Activity Cards */}
        <View style={styles.cardsSection}>
          <ActivityCard
            emoji="🥾"
            title="徒步"
            subtitle="地图 · 插旗 · 探索步道"
            accent={Colors.primary}
            onPress={() => nav.navigate('Hiking')}
          />
          <ActivityCard
            emoji="🏃"
            title="跑步"
            subtitle="路线选择 · 语音播报 · 锁屏模式"
            accent="#3d7ab5"
            onPress={() => nav.navigate('Running')}
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
          <EntryButton emoji="🗺️" label="地图" onPress={() => nav.navigate('MapHistory')} />
          <EntryButton emoji="👥" label="好友" onPress={() => nav.navigate('Friends')} />
          <EntryButton emoji="⚙️" label="设置" onPress={() => nav.navigate('Settings')} />
        </View>
      </ScrollView>
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
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  headerSub: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  cardsSection: { gap: Spacing.md, marginBottom: Spacing.xl },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.cardLg,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.card,
  },
  activityEmojiBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmoji: { fontSize: 28 },
  activityText: { flex: 1 },
  activityTitle: {
    fontSize: FontSize.h2,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  activitySubtitle: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  activityChevron: {
    fontSize: 26,
    color: Colors.textMuted,
    marginRight: 4,
  },

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
  },
  entryEmoji: { fontSize: 26 },
  entryLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
