/**
 * RoutesScreen — Sprint 27 premium uplift (STORY-00077)
 * - Gradient LinearGradient icon badges (Mountain icon)
 * - Consistent h3/700 title treatment, shadow cards
 * - Stat chips with colored left-border capsule style
 * - Empty state matches HomeScreen / MapHistory pattern
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
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

function formatRouteDate(isoStr: string): string {
  const today = new Date();
  const date = new Date(isoStr);
  const todayStr = today.toDateString();
  const dateStr = date.toDateString();
  if (dateStr === todayStr) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateStr === yesterday.toDateString()) return 'Yesterday';
  const day = date.getDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[date.getMonth()];
  if (date.getFullYear() === today.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} ${date.getFullYear()}`;
}

export function RoutesScreen() {
  const { uiMode } = useAppStore();
  const isBeginner = uiMode === 'beginner';
  const [downloadSheet, setDownloadSheet] = useState<{ name: string } | null>(null);

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
            ? [Colors.runningLight, Colors.runningGrad]
            : [Colors.primaryLight, Colors.primaryDeep];
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
                <Text style={styles.routeDate}>{formatRouteDate(item.date)}</Text>
                {isBeginner ? (
                  <View style={styles.statsRow}>
                    <View style={[styles.statChip, { backgroundColor: isRunRoute ? Colors.runningLight : Colors.primaryLight }]}>
                      <Icon name="MapPin" size={9} color={iconColor} strokeWidth={2.5} />
                      <Text style={[styles.statValue, { color: iconColor }]}>{item.distanceKm} km</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: isRunRoute ? Colors.runningLight : Colors.primaryLight }]}>
                      <Icon name="Timer" size={9} color={iconColor} strokeWidth={2.5} />
                      <Text style={[styles.statValue, { color: iconColor }]}>{formatDuration(item.durationMin)}</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: isRunRoute ? Colors.runningLight : Colors.primaryLight }]}>
                      <Icon name="Flag" size={9} color={iconColor} strokeWidth={2.5} />
                      <Text style={[styles.statValue, { color: iconColor }]}>{item.markerCount}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.routeCompact}>
                    {item.distanceKm}km · {formatDuration(item.durationMin)} · {item.markerCount}pts
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.downloadBtn}
                  activeOpacity={0.7}
                  onPress={() => setDownloadSheet({ name: item.name })}
                >
                  <Icon name="Download" size={12} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.downloadBtnText}>Download</Text>
                </TouchableOpacity>
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

      {/* Download premium overlay sheet (STORY-00101) */}
      <Modal
        visible={!!downloadSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setDownloadSheet(null)}
      >
        <TouchableOpacity style={dlStyles.scrim} activeOpacity={1} onPress={() => setDownloadSheet(null)} />
        <View style={dlStyles.sheet}>
          <View style={dlStyles.handle} />
          <TouchableOpacity style={dlStyles.closeBtn} onPress={() => setDownloadSheet(null)}>
            <Icon name="X" size={18} color={Colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={dlStyles.iconWrap}>
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primaryBg]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={dlStyles.iconBadge}
            >
              <Icon name="Download" size={32} color={Colors.primary} strokeWidth={1.8} />
            </LinearGradient>
          </View>
          <Text style={dlStyles.title}>Download for Offline Use</Text>
          <Text style={dlStyles.desc}>
            Save routes to your device and access them without internet — perfect for remote trails.
          </Text>
          <TouchableOpacity style={dlStyles.upgradeBtn} activeOpacity={0.85} onPress={() => setDownloadSheet(null)}>
            <Icon name="Star" size={16} color="#fff" strokeWidth={2} />
            <Text style={dlStyles.upgradeBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statValue: {
    fontSize: FontSize.tiny,
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

  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: Spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  downloadBtnText: {
    fontSize: FontSize.tiny,
    fontWeight: '600',
    color: Colors.primary,
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

// ── Download premium overlay sheet styles (STORY-00101) ──────────────────────
const dlStyles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.cardLg, borderTopRightRadius: Radius.cardLg,
    padding: Spacing.xl, paddingBottom: Spacing.xxl,
    alignItems: 'center',
    ...Shadow.overlay,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.border, marginBottom: Spacing.lg,
  },
  closeBtn: {
    position: 'absolute', top: Spacing.xl, right: Spacing.xl,
    padding: 4,
  },
  iconWrap: { marginBottom: Spacing.base },
  iconBadge: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.caption, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl,
  },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    minHeight: 48, ...Shadow.fab,
  },
  upgradeBtnText: {
    fontSize: FontSize.body, fontWeight: '700', color: '#fff',
  },
});
