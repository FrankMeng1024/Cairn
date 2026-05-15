/**
 * MapHistoryScreen — Sprint 16 real route history
 *
 * - Routes tab: reads from useSessionStore (real completed tracking sessions)
 * - Flags tab: reads from useMarkerStore (real planted markers, current region)
 * - Sessions shown with real distance, duration, elevation, marker count
 * - Marker delete calls useMarkerStore.deleteMarker
 * - Empty states when no sessions/markers yet
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSessionStore } from '../store/useSessionStore';
import { useMarkerStore } from '../store/useMarkerStore';
import { getCurrentRegion } from '../config/regions';
import { formatDistance, formatDuration } from '../utils/geo';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MARKER_META } from '../data/mockData';
import type { TrackingSession } from '../store/useSessionStore';
import type { Marker } from '../store/useMarkerStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: W } = Dimensions.get('window');

// ── Spring press wrapper ────────────────────────────────────────────────────
function PressRow({
  onPress, style, children, scale = 0.98,
}: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
  scale?: number;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(anim, { toValue: scale, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: anim }] }, style]}>
      <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, isSelected, onPress }: {
  session: TrackingSession;
  isSelected: boolean;
  onPress: () => void;
}) {
  const date = new Date(session.startedAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const actLabel = session.activityMode === 'running' ? 'Run' : 'Hike';
  return (
    <PressRow onPress={onPress} style={{ marginBottom: Spacing.sm }}>
      <View style={[cardStyles.routeCard, isSelected && cardStyles.routeCardSelected]}>
        <View style={[cardStyles.routeColorBar, { backgroundColor: session.activityMode === 'running' ? '#3d7ab5' : Colors.primary }]} />
        <View style={cardStyles.routeInfo}>
          <Text style={cardStyles.routeName}>
            {session.name ?? `${actLabel} · ${dateStr}`}
          </Text>
          <Text style={cardStyles.routeMeta}>
            {dateStr} · {formatDistance(session.distanceM, 'km', 1)} km · {formatDuration(session.durationS)}
          </Text>
        </View>
        <View style={cardStyles.routeChevron}>
          <Icon
            name={isSelected ? 'ChevronLeft' : 'ChevronRight'}
            size={IconSize.sm}
            color={isSelected ? Colors.primary : Colors.textMuted}
            strokeWidth={2.5}
          />
        </View>
      </View>
    </PressRow>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export function MapHistoryScreen() {
  const nav = useNavigation<Nav>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tab, setTab] = useState<'routes' | 'flags'>('routes');

  const region = getCurrentRegion();
  const sessions = useSessionStore(s => s.sessions);
  const deleteSession = useSessionStore(s => s.deleteSession);
  const allMarkers = useMarkerStore(s => s.markers);
  const markers = allMarkers.filter(m => m.regionCode === region.code);
  const deleteMarker = useMarkerStore(s => s.deleteMarker);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null;

  // Show real markers on map; fall back to empty array
  const mapMarkers: Marker[] = markers.slice(0, 8);

  return (
    <View style={styles.container}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {/* Route lines (decorative — real track rendering in Phase B) */}
        <View style={styles.routeLine1} />
        <View style={styles.routeLine2} />
        <View style={styles.routeLine3} />

        {/* Map placeholder label */}
        <View style={styles.mapLabelWrap}>
          <Icon name="Map" size={28} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.mapLabel}>Trail Map</Text>
          <Text style={styles.mapSubLabel}>Route history · Flag markers</Text>
        </View>

        {/* Real marker pins */}
        {mapMarkers.map((m, i) => {
          const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
          return (
            <View
              key={m.id}
              style={[
                styles.markerPin,
                {
                  left: 60 + (i % 4) * 75,
                  top: 120 + (i % 3) * 70,
                  borderColor: meta.color,
                  backgroundColor: meta.bg,
                },
              ]}
            >
              <Icon
                name={meta.iconName as IconName}
                size={13}
                color={meta.color}
                strokeWidth={2}
              />
            </View>
          );
        })}
      </View>

      {/* Top bar — overlays map */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
            <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Route Map</Text>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => Alert.alert('Plan Route', 'Route planning coming soon')}
          >
            <Icon name="Route" size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.planBtnText}>Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'routes' && styles.tabItemActive]}
            onPress={() => setTab('routes')}
          >
            <Icon
              name="Route"
              size={14}
              color={tab === 'routes' ? '#fff' : Colors.textSecondary}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, tab === 'routes' && styles.tabTextActive]}>
              Route History{sessions.length > 0 ? ` (${sessions.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'flags' && styles.tabItemActive]}
            onPress={() => setTab('flags')}
          >
            <Icon
              name="Flag"
              size={14}
              color={tab === 'flags' ? '#fff' : Colors.textSecondary}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, tab === 'flags' && styles.tabTextActive]}>
              My Flags{markers.length > 0 ? ` (${markers.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom list panel */}
      <View style={styles.listPanel}>
        <View style={styles.panelHandle} />

        {tab === 'routes' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="Route" size={32} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No routes yet</Text>
                <Text style={styles.emptySubtitle}>Your hikes and runs will appear here</Text>
              </View>
            ) : (
              <>
                {sessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    isSelected={selectedSessionId === s.id}
                    onPress={() => setSelectedSessionId(selectedSessionId === s.id ? null : s.id)}
                  />
                ))}

                {selectedSession && (
                  <View style={cardStyles.routeDetail}>
                    <Text style={cardStyles.routeDetailTitle}>
                      {selectedSession.name ?? (selectedSession.activityMode === 'running' ? 'Run' : 'Hike')}
                    </Text>
                    <View style={cardStyles.statsGrid}>
                      {[
                        { v: formatDistance(selectedSession.distanceM, 'km', 2), u: 'km' },
                        { v: formatDuration(selectedSession.durationS), u: 'time' },
                        { v: `${selectedSession.markerIds.length}`, u: 'flags' },
                        { v: `+${selectedSession.elevationGainM}m`, u: 'elev' },
                      ].map((s, i) => (
                        <View key={i} style={cardStyles.statChip}>
                          <Text style={cardStyles.statValue}>{s.v}</Text>
                          <Text style={cardStyles.statUnit}>{s.u}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={cardStyles.deleteBtn}
                      onPress={() => Alert.alert(
                        'Delete Route',
                        'Are you sure you want to delete this route?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete', style: 'destructive', onPress: () => {
                              deleteSession(selectedSession.id);
                              setSelectedSessionId(null);
                            },
                          },
                        ]
                      )}
                    >
                      <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
                      <Text style={cardStyles.deleteBtnText}>Delete Route</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {markers.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="Flag" size={32} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No flags yet</Text>
                <Text style={styles.emptySubtitle}>Plant flags while hiking to see them here</Text>
              </View>
            ) : (
              markers.map(m => {
                const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
                const timeAgo = (() => {
                  const diffMs = Date.now() - m.createdAt;
                  const mins = Math.floor(diffMs / 60000);
                  if (mins < 1) return 'Just now';
                  if (mins < 60) return `${mins}m ago`;
                  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
                  return `${Math.floor(mins / 1440)}d ago`;
                })();
                return (
                  <PressRow key={m.id} onPress={() => {}} style={{ marginBottom: 0 }}>
                    <View style={flagStyles.row}>
                      <View style={[flagStyles.dot, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                        <Icon
                          name={meta.iconName as IconName}
                          size={16}
                          color={meta.color}
                          strokeWidth={2}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={flagStyles.title}>{meta.label}</Text>
                        <Text style={flagStyles.note}>{m.note || timeAgo}</Text>
                      </View>
                      <TouchableOpacity
                        style={flagStyles.deleteBtn}
                        onPress={() => Alert.alert(
                          'Delete Flag',
                          'Are you sure?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteMarker(m.id) },
                          ]
                        )}
                      >
                        <Icon name="Trash2" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
                      </TouchableOpacity>
                    </View>
                  </PressRow>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8f0e0' },

  mapArea: { flex: 1, backgroundColor: '#e8f0e0', position: 'relative', overflow: 'hidden' },
  routeLine1: {
    position: 'absolute', top: 160, left: 40, width: W - 80,
    height: 3, backgroundColor: Colors.primary + '70', borderRadius: 2,
  },
  routeLine2: {
    position: 'absolute', top: 200, left: 40, width: W * 0.6,
    height: 3, backgroundColor: '#3d7ab5' + '70', borderRadius: 2,
  },
  routeLine3: {
    position: 'absolute', top: 180, right: 40, width: W * 0.4,
    height: 3, backgroundColor: '#b5823d' + '70', borderRadius: 2,
  },
  mapLabelWrap: {
    position: 'absolute', alignItems: 'center',
    top: '38%', left: 0, right: 0, gap: 4, opacity: 0.35,
  },
  mapLabel: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textMuted },
  mapSubLabel: { fontSize: FontSize.small, color: Colors.textMuted },
  markerPin: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm, paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7,
    ...Shadow.card,
  },
  backText: { fontSize: FontSize.small, fontWeight: '700', color: Colors.primary },
  topTitle: {
    flex: 1, textAlign: 'center',
    fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary,
  },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
  },
  planBtnText: { fontSize: FontSize.small, fontWeight: '700', color: '#fff' },

  tabBar: {
    flexDirection: 'row', marginHorizontal: Spacing.base,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: Radius.pill, padding: 3,
    ...Shadow.card,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.pill, paddingVertical: 7, gap: 5,
  },
  tabItemActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  listPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: 380,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxl,
    ...Shadow.overlay,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  panelHandle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md,
  },

  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.xxl, gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center' },
});

const cardStyles = StyleSheet.create({
  routeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.card,
    overflow: 'hidden', ...Shadow.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  routeCardSelected: {
    backgroundColor: 'rgba(93,124,70,0.06)',
    borderColor: Colors.primary + '50',
  },
  routeColorBar: { width: 5, alignSelf: 'stretch', backgroundColor: Colors.primary },
  routeInfo: { flex: 1, padding: Spacing.md },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  routeChevron: { paddingRight: Spacing.md },

  routeDetail: {
    backgroundColor: Colors.bg, borderRadius: Radius.card,
    padding: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  routeDetailTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  statChip: {
    flex: 1, minWidth: '22%',
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingVertical: 8, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: FontSize.caption, fontWeight: '800', color: Colors.textPrimary },
  statUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.button, paddingVertical: Spacing.sm,
    justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.danger + '60',
    backgroundColor: Colors.dangerBg,
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.caption },
});

const flagStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dot: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  note: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 3 },
  deleteBtn: { padding: Spacing.sm },
});
