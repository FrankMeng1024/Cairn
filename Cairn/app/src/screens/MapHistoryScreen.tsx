/**
 * MapHistoryScreen — Sprint 10 redesign
 *
 * - SVG icons replace all emoji (Map, Flag, Trash2, ChevronLeft, Route, etc.)
 * - Spring press animations on route cards and flag rows
 * - Marker pins use SVG icons via Icon component
 * - Tab bar with Map / Flag icons
 * - Delete uses Trash2 SVG, back uses ChevronLeft SVG
 * - Plan button uses Route SVG
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
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MOCK_ROUTES, MOCK_MARKERS, MARKER_META } from '../data/mockData';

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

// ── Route card ──────────────────────────────────────────────────────────────
function RouteCard({ route, isSelected, onPress }: {
  route: typeof MOCK_ROUTES[0];
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <PressRow onPress={onPress} style={{ marginBottom: Spacing.sm }}>
      <View style={[cardStyles.routeCard, isSelected && cardStyles.routeCardSelected]}>
        <View style={cardStyles.routeColorBar} />
        <View style={cardStyles.routeInfo}>
          <Text style={cardStyles.routeName}>{route.name}</Text>
          <Text style={cardStyles.routeMeta}>{route.date} · {route.distanceKm} km · {route.durationMin} 分钟</Text>
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
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [tab, setTab] = useState<'routes' | 'flags'>('routes');

  const currentRoute = MOCK_ROUTES.find(r => r.id === selectedRoute);

  return (
    <View style={styles.container}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {/* Route lines */}
        <View style={styles.routeLine1} />
        <View style={styles.routeLine2} />
        <View style={styles.routeLine3} />

        {/* Map placeholder label */}
        <View style={styles.mapLabelWrap}>
          <Icon name="Map" size={28} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.mapLabel}>步道地图</Text>
          <Text style={styles.mapSubLabel}>历史路线 · 旗帜标记</Text>
        </View>

        {/* Marker pins */}
        {MOCK_MARKERS.map((m, i) => {
          const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
          return (
            <View
              key={m.id}
              style={[
                styles.markerPin,
                {
                  left: 60 + i * 100,
                  top: 120 + (i % 2) * 90,
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
            <Text style={styles.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>地图记录</Text>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => Alert.alert('规划路线', '路线规划功能即将上线')}
          >
            <Icon name="Route" size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.planBtnText}>规划</Text>
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
            <Text style={[styles.tabText, tab === 'routes' && styles.tabTextActive]}>路线历史</Text>
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
            <Text style={[styles.tabText, tab === 'flags' && styles.tabTextActive]}>我的旗帜</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom list panel */}
      <View style={styles.listPanel}>
        <View style={styles.panelHandle} />

        {tab === 'routes' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {MOCK_ROUTES.map(r => (
              <RouteCard
                key={r.id}
                route={r}
                isSelected={selectedRoute === r.id}
                onPress={() => setSelectedRoute(selectedRoute === r.id ? null : r.id)}
              />
            ))}

            {selectedRoute && currentRoute && (
              <View style={cardStyles.routeDetail}>
                <Text style={cardStyles.routeDetailTitle}>{currentRoute.name}</Text>
                <View style={cardStyles.statsGrid}>
                  {[
                    { v: `${currentRoute.distanceKm}`, u: '公里' },
                    { v: `${Math.floor(currentRoute.durationMin / 60)}h${currentRoute.durationMin % 60}m`, u: '用时' },
                    { v: `${currentRoute.markerCount}`, u: '旗帜' },
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
                    '删除路线',
                    '确认删除此路线记录？',
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => setSelectedRoute(null) },
                    ]
                  )}
                >
                  <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
                  <Text style={cardStyles.deleteBtnText}>删除路线</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {MOCK_MARKERS.map(m => {
              const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
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
                      <Text style={flagStyles.title}>{m.title}</Text>
                      <Text style={flagStyles.note}>{m.note}</Text>
                    </View>
                    <TouchableOpacity
                      style={flagStyles.deleteBtn}
                      onPress={() => Alert.alert(
                        '删除旗帜',
                        `删除"${m.title}"？`,
                        [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive' }]
                      )}
                    >
                      <Icon name="Trash2" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                </PressRow>
              );
            })}
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
  statsGrid: { flexDirection: 'row', gap: Spacing.sm },
  statChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.pill,
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
