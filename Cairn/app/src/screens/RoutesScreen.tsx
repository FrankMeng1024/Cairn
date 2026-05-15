/**
 * RoutesScreen — Sprint 13 SVG polish
 * - MapPin SVG replaces 📍 in compact stat
 * - Map SVG replaces 🗺️ in empty state
 * - ChevronRight SVG replaces › text glyph
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { MOCK_ROUTES } from '../data/mockData';

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RoutesScreen() {
  const { uiMode } = useAppStore();
  const isGuided = uiMode === 'guided';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{isGuided ? '路线历史' : '路线'}</Text>
        {isGuided && <Text style={styles.subtitle}>你走过的每一条路都留在这里</Text>}
      </View>

      <FlatList
        data={MOCK_ROUTES}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.routeCard} activeOpacity={0.8}>
            <View style={styles.routeColorBar} />
            <View style={styles.routeContent}>
              <Text style={styles.routeName}>{item.name}</Text>
              <Text style={styles.routeDate}>{item.date}</Text>
              {isGuided ? (
                <View style={styles.statsRow}>
                  <View style={styles.statChip}>
                    <Text style={styles.statValue}>{item.distanceKm}</Text>
                    <Text style={styles.statUnit}>公里</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statValue}>{formatDuration(item.durationMin)}</Text>
                    <Text style={styles.statUnit}>用时</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statValue}>{item.markerCount}</Text>
                    <Text style={styles.statUnit}>个标记</Text>
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
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="Map" size={36} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>暂无路线记录</Text>
            {isGuided && <Text style={styles.emptyHint}>开始追踪后，路线会自动保存到这里</Text>}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 4 },

  routeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', ...Shadow.card,
  },
  routeColorBar: { width: 4, alignSelf: 'stretch', backgroundColor: Colors.primary },
  routeContent: { flex: 1, padding: Spacing.base },
  routeName: { fontSize: FontSize.h3, fontWeight: '600', color: Colors.textPrimary },
  routeDate: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    backgroundColor: Colors.bg, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statValue: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary },
  statUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary },
  routeCompact: { fontSize: FontSize.caption, color: Colors.textSecondary },
  chevronWrap: { paddingRight: Spacing.base, paddingLeft: Spacing.sm },

  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: FontSize.h3, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
});
