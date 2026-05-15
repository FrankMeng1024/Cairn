/**
 * MapHistoryScreen — design.jpg "地图页（历史查看）"
 *
 * - Shows user's past routes as colored lines on map
 * - Past flag markers visible and clickable
 * - Route detail sheet with delete option
 * - "规划路线" button to set a new planned route
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';
import { MOCK_ROUTES, MOCK_MARKERS, MARKER_META } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: W } = Dimensions.get('window');

function RouteCard({ route, isSelected, onPress }: {
  route: typeof MOCK_ROUTES[0];
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.routeCard, isSelected && styles.routeCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.routeColorBar} />
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{route.name}</Text>
        <Text style={styles.routeMeta}>{route.date} · {route.distanceKm}km · {route.durationMin}分钟</Text>
      </View>
      {isSelected && <Text style={styles.selectedChevron}>▲</Text>}
    </TouchableOpacity>
  );
}

export function MapHistoryScreen() {
  const nav = useNavigation<Nav>();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [tab, setTab] = useState<'routes' | 'flags'>('routes');

  const currentRoute = MOCK_ROUTES.find(r => r.id === selectedRoute);

  return (
    <View style={styles.container}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {/* Fake route lines */}
        <View style={styles.routeLine1} />
        <View style={styles.routeLine2} />
        <View style={styles.routeLine3} />
        {/* Fake trail path indicators */}
        <Text style={styles.mapLabel}>步道地图</Text>
        <Text style={styles.mapSubLabel}>历史路线 · 旗帜标记</Text>
        {/* Markers */}
        {MOCK_MARKERS.map((m, i) => {
          const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.markerPin, { left: 60 + i * 100, top: 120 + (i % 2) * 90, borderColor: meta.color, backgroundColor: meta.bg }]}
              onPress={() => setSelectedMarker(m.id)}
            >
              <Text style={[styles.markerIcon, { color: meta.color }]}>{meta.icon}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>地图记录</Text>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => Alert.alert('规划路线', '路线规划功能即将上线')}
          >
            <Text style={styles.planBtnText}>+ 规划</Text>
          </TouchableOpacity>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'routes' && styles.tabItemActive]}
            onPress={() => setTab('routes')}
          >
            <Text style={[styles.tabText, tab === 'routes' && styles.tabTextActive]}>🗺️ 路线历史</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'flags' && styles.tabItemActive]}
            onPress={() => setTab('flags')}
          >
            <Text style={[styles.tabText, tab === 'flags' && styles.tabTextActive]}>📍 我的旗帜</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom list */}
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
              <View style={styles.routeDetail}>
                <Text style={styles.routeDetailTitle}>{currentRoute.name}</Text>
                <View style={styles.statsGrid}>
                  {[
                    { v: currentRoute.distanceKm, u: '公里' },
                    { v: `${Math.floor(currentRoute.durationMin / 60)}h${currentRoute.durationMin % 60}m`, u: '用时' },
                    { v: currentRoute.markerCount, u: '个旗帜' },
                  ].map((s, i) => (
                    <View key={i} style={styles.statChip}>
                      <Text style={styles.statValue}>{s.v}</Text>
                      <Text style={styles.statUnit}>{s.u}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.deleteRouteBtn}
                  onPress={() => Alert.alert('删除路线', '确认删除此路线记录？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => setSelectedRoute(null) }])}
                >
                  <Text style={styles.deleteRouteBtnText}>🗑  删除路线</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {MOCK_MARKERS.map(m => {
              const meta = MARKER_META[m.type as keyof typeof MARKER_META] || MARKER_META.free;
              return (
                <TouchableOpacity key={m.id} style={styles.flagRow} onPress={() => setSelectedMarker(m.id)}>
                  <View style={[styles.flagDot, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                    <Text style={[styles.flagDotIcon, { color: meta.color }]}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flagTitle}>{m.title}</Text>
                    <Text style={styles.flagNote}>{m.note}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('删除旗帜', `删除"${m.title}"？`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive' }])}
                  >
                    <Text style={styles.deleteIcon}>🗑</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8f0e0' },

  mapArea: { flex: 1, backgroundColor: '#e8f0e0', position: 'relative', overflow: 'hidden' },
  routeLine1: { position: 'absolute', top: 160, left: 40, width: W - 80, height: 3, backgroundColor: Colors.primary + '70', borderRadius: 2 },
  routeLine2: { position: 'absolute', top: 200, left: 40, width: W * 0.6, height: 3, backgroundColor: '#3d7ab5' + '70', borderRadius: 2 },
  routeLine3: { position: 'absolute', top: 180, right: 40, width: W * 0.4, height: 3, backgroundColor: '#b5823d' + '70', borderRadius: 2 },
  mapLabel: { position: 'absolute', top: '40%', alignSelf: 'center', left: W * 0.3, fontSize: FontSize.h3, fontWeight: '700', color: Colors.textMuted, opacity: 0.4 },
  mapSubLabel: { position: 'absolute', top: '40%', marginTop: 28, alignSelf: 'center', left: W * 0.22, fontSize: FontSize.small, color: Colors.textMuted, opacity: 0.4 },
  markerPin: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  markerIcon: { fontSize: 13, fontWeight: '800' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.sm },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7, ...Shadow.card },
  backText: { fontSize: FontSize.small, fontWeight: '700', color: Colors.primary },
  topTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  planBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  planBtnText: { fontSize: FontSize.small, fontWeight: '700', color: '#fff' },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: Radius.pill, padding: 3, ...Shadow.card },
  tabItem: { flex: 1, borderRadius: Radius.pill, paddingVertical: 7, alignItems: 'center' },
  tabItemActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  listPanel: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 380, paddingTop: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxl, ...Shadow.overlay, borderTopWidth: 1, borderColor: Colors.border },
  panelHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },

  routeCard: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, backgroundColor: Colors.bg, borderRadius: Radius.card, overflow: 'hidden', ...Shadow.card, borderWidth: 1, borderColor: Colors.border },
  routeCardSelected: { backgroundColor: 'rgba(93,124,70,0.06)', borderColor: Colors.primary + '40' },
  routeColorBar: { width: 5, alignSelf: 'stretch', backgroundColor: Colors.primary },
  routeInfo: { flex: 1, padding: Spacing.md },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  selectedChevron: { fontSize: 16, color: Colors.primary, paddingRight: Spacing.md },

  routeDetail: { backgroundColor: Colors.bg, borderRadius: Radius.card, padding: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm },
  routeDetailTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm },
  statChip: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 8, alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.caption, fontWeight: '800', color: Colors.textPrimary },
  statUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary },
  deleteRouteBtn: { borderRadius: Radius.button, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.danger + '60', backgroundColor: Colors.dangerBg },
  deleteRouteBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.caption },

  flagRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  flagDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  flagDotIcon: { fontSize: 16, fontWeight: '800' },
  flagTitle: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  flagNote: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 3 },
  deleteIcon: { fontSize: 18, padding: Spacing.sm, color: Colors.textMuted },
});
