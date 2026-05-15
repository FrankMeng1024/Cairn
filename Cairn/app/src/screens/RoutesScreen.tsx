/**
 * RoutesScreen — Sprint 27 premium uplift (STORY-00077)
 * - Gradient LinearGradient icon badges (Mountain icon)
 * - Consistent h3/700 title treatment, shadow cards
 * - Stat chips with colored left-border capsule style
 * - Empty state matches HomeScreen / MapHistory pattern
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { MOCK_ROUTES } from '../data/mockData';

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RoutesScreen() {
  const { uiMode } = useAppStore();
  const isBeginner = uiMode === 'beginner';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton variant="pill" />
        <Text style={styles.title}>{isBeginner ? 'Route History' : 'Routes'}</Text>
        {isBeginner && <Text style={styles.subtitle}>Every trail you've walked, saved here</Text>}
      </View>

      <FlatList
        data={MOCK_ROUTES}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xl }}
        renderItem={({ item }) => {
          const isRunRoute = item.activityMode === 'running';
          const badgeColors: [string, string] = isRunRoute
            ? [Colors.runningLight, 'rgba(61,122,181,0.25)']
            : [Colors.primaryLight, 'rgba(93,124,70,0.30)'];
          const iconColor = isRunRoute ? Colors.running : Colors.primary;
          return (
            <TouchableOpacity style={styles.routeCard} activeOpacity={0.85}>
              <LinearGradient
                colors={badgeColors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.activityBadge}
              >
                <Icon name="Mountain" size={20} color={iconColor} strokeWidth={1.8} />
              </LinearGradient>

              <View style={styles.routeContent}>
                <Text style={styles.routeName}>{item.name}</Text>
                <Text style={styles.routeDate}>{item.date}</Text>
                {isBeginner ? (
                  <View style={styles.statsRow}>
                    <View style={[styles.statChip, { borderLeftColor: iconColor }]}>
                      <Text style={styles.statValue}>{item.distanceKm}</Text>
                      <Text style={styles.statUnit}> km</Text>
                    </View>
                    <View style={[styles.statChip, { borderLeftColor: iconColor }]}>
                      <Text style={styles.statValue}>{formatDuration(item.durationMin)}</Text>
                      <Text style={styles.statUnit}> time</Text>
                    </View>
                    <View style={[styles.statChip, { borderLeftColor: iconColor }]}>
                      <Text style={styles.statValue}>{item.markerCount}</Text>
                      <Text style={styles.statUnit}> flags</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.routeCompact}>
                    {item.distanceKm}km · {formatDuration(item.durationMin)} · {item.markerCount}pts
                  </Text>
                )}
              </View>

              <View style={styles.chevronWrap}>
                <Icon name="ChevronRight" size={IconSize.sm} color={Colors.textMuted} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="Map" size={36} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No routes yet</Text>
            {isBeginner && (
              <Text style={styles.emptyHint}>Start tracking and your routes will be saved here</Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.h1,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadow.card,
  },
  activityBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routeContent: { flex: 1 },
  routeName: {
    fontSize: FontSize.h3,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  routeDate: {
    fontSize: FontSize.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.bg,
    borderRadius: Radius.pill,
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statValue: {
    fontSize: FontSize.caption,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statUnit: {
    fontSize: FontSize.tiny,
    color: Colors.textSecondary,
  },

  routeCompact: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },

  chevronWrap: { paddingLeft: Spacing.xs },

  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  emptyTitle: {
    fontSize: FontSize.h3,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyHint: {
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
