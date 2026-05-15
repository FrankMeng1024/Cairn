/**
 * MapHistoryScreen — Sprint 19 track visualization + flag detail sheet
 *
 * - STORY-00043: session track polyline on map when session selected
 * - STORY-00046: flag detail bottom sheet, richer flag list items, improved empty states
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { formatDistance, formatDuration, formatDate } from '../utils/geo';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { MARKER_META } from '../data/mockData';
import type { TrackingSession } from '../store/useSessionStore';
import type { Marker } from '../store/useMarkerStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: W, height: H } = Dimensions.get('window');

// Map display area height (approx — the area above the list panel)
const MAP_H = H - 380;
// Map bounds for coordinate mapping
const MAP_PADDING = 40;

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

// ── Track polyline ────────────────────────────────────────────────────────────
// Converts trackPoints lat/lng to pixel positions within the map area.
// If no trackPoints, renders a dashed "No GPS" placeholder line.
function TrackPolyline({ session }: { session: TrackingSession }) {
  const pts = session.trackPoints;
  const color = session.activityMode === 'running' ? Colors.running : Colors.primary;

  if (pts.length < 2) {
    // No GPS data — show a dashed placeholder line
    return (
      <View style={trackStyles.noGpsWrap}>
        <View style={[trackStyles.noGpsLine, { borderColor: color }]} />
        <Text style={trackStyles.noGpsLabel}>No GPS data recorded</Text>
      </View>
    );
  }

  // Find bounding box of the track
  const lats = pts.map(p => p.lat);
  const lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const mapW = W - MAP_PADDING * 2;
  const mapH = MAP_H - 80;

  // Map lat/lng to pixel coords
  const toPixel = (lat: number, lng: number) => ({
    x: MAP_PADDING + ((lng - minLng) / lngRange) * mapW,
    y: 60 + ((maxLat - lat) / latRange) * mapH,
  });

  // Draw as connected line segments using thin Views positioned absolutely
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = toPixel(pts[i].lat, pts[i].lng);
    const b = toPixel(pts[i + 1].lat, pts[i + 1].lng);
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  return (
    <>
      {segments.map((seg, i) => {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: seg.x1,
              top: seg.y1,
              width: length,
              height: 3,
              backgroundColor: color + 'cc',
              borderRadius: 2,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }}
          />
        );
      })}
      {/* Start dot */}
      {pts.length > 0 && (() => {
        const start = toPixel(pts[0].lat, pts[0].lng);
        return (
          <View style={[trackStyles.trackDot, trackStyles.startDot, { left: start.x - 6, top: start.y - 6, backgroundColor: color }]} />
        );
      })()}
      {/* End dot */}
      {pts.length > 1 && (() => {
        const end = toPixel(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
        return (
          <View style={[trackStyles.trackDot, trackStyles.endDot, { left: end.x - 8, top: end.y - 8, borderColor: color }]} />
        );
      })()}
    </>
  );
}

// ── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, isSelected, isExpanded, onPress, onViewOnMap }: {
  session: TrackingSession;
  isSelected: boolean;
  isExpanded: boolean;
  onPress: () => void;
  onViewOnMap: () => void;
}) {
  const dateStr = formatDate(session.startedAt);
  const actLabel = session.activityMode === 'running' ? 'Run' : 'Hike';
  const actColor = session.activityMode === 'running' ? Colors.running : Colors.primary;
  const actIconBg = session.activityMode === 'running' ? Colors.runningLight : Colors.primaryLight;
  const actIcon: IconName = session.activityMode === 'running' ? 'PersonStanding' : 'Mountain';

  const expandAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0, duration: 200, useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const expandedHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });

  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <PressRow onPress={onPress}>
        <View style={[cardStyles.routeCard, (isSelected || isExpanded) && cardStyles.routeCardSelected]}>
          <View style={[cardStyles.activityBadge, { backgroundColor: actIconBg }]}>
            <Icon name={actIcon} size={20} color={actColor} strokeWidth={1.8} />
          </View>
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
              name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
              size={IconSize.sm}
              color={isExpanded ? actColor : Colors.textMuted}
              strokeWidth={2.5}
            />
          </View>
        </View>
      </PressRow>
      {/* Inline expanded stats */}
      <Animated.View style={[cardStyles.expandedArea, { height: expandedHeight, opacity: expandAnim }]}>
        <View style={cardStyles.expandedStats}>
          <View style={cardStyles.expandedStat}>
            <Text style={cardStyles.expandedStatVal}>{formatDistance(session.distanceM, 'km', 2)}</Text>
            <Text style={cardStyles.expandedStatLbl}>km</Text>
          </View>
          <View style={cardStyles.expandedStat}>
            <Text style={cardStyles.expandedStatVal}>{formatDuration(session.durationS)}</Text>
            <Text style={cardStyles.expandedStatLbl}>time</Text>
          </View>
          <View style={cardStyles.expandedStat}>
            <Text style={cardStyles.expandedStatVal}>+{session.elevationGainM ?? 0}m</Text>
            <Text style={cardStyles.expandedStatLbl}>elev</Text>
          </View>
          <View style={cardStyles.expandedStat}>
            <Text style={cardStyles.expandedStatVal}>{session.markerIds?.length ?? 0}</Text>
            <Text style={cardStyles.expandedStatLbl}>flags</Text>
          </View>
        </View>
        <TouchableOpacity style={[cardStyles.viewOnMapBtn, { borderColor: actColor }]} onPress={onViewOnMap}>
          <Icon name="Map" size={14} color={actColor} strokeWidth={2} />
          <Text style={[cardStyles.viewOnMapText, { color: actColor }]}>View on Map</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Flag detail bottom sheet ─────────────────────────────────────────────────
function FlagDetailSheet({ marker, onClose, onDelete }: {
  marker: Marker;
  onClose: () => void;
  onDelete: () => void;
}) {
  const slideY = useRef(new Animated.Value(H)).current;

  React.useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0, tension: 200, friction: 20, useNativeDriver: true,
    }).start();
  }, []);

  const meta = MARKER_META[marker.type as keyof typeof MARKER_META] || MARKER_META.free;
  const date = new Date(marker.createdAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const close = () => {
    Animated.timing(slideY, { toValue: H, duration: 200, useNativeDriver: true }).start(onClose);
  };

  return (
    <>
      {/* Scrim */}
      <TouchableOpacity style={sheetStyles.scrim} activeOpacity={1} onPress={close} />
      <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Drag handle */}
        <View style={sheetStyles.handle} />
        {/* Type badge */}
        <View style={[sheetStyles.typeBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
          <Icon name={meta.iconName as IconName} size={20} color={meta.color} strokeWidth={2} />
          <Text style={[sheetStyles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {/* Note */}
        <Text style={sheetStyles.noteLabel}>Note</Text>
        <Text style={sheetStyles.noteText}>{marker.note || 'No note added'}</Text>
        {/* Date */}
        <Text style={sheetStyles.dateLine}>Planted: {dateStr}</Text>
        {/* Delete */}
        <TouchableOpacity
          style={sheetStyles.deleteBtn}
          onPress={() => Alert.alert(
            'Delete Flag',
            'This flag will be permanently removed.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ]
          )}
        >
          <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
          <Text style={sheetStyles.deleteBtnText}>Delete Flag</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export function MapHistoryScreen() {
  const nav = useNavigation<Nav>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [tab, setTab] = useState<'routes' | 'flags'>('routes');

  const region = getCurrentRegion();
  const sessions = useSessionStore(s => s.sessions);
  const deleteSession = useSessionStore(s => s.deleteSession);
  const allMarkers = useMarkerStore(s => s.markers);
  const markers = allMarkers.filter(m => m.regionCode === region.code);
  const deleteMarker = useMarkerStore(s => s.deleteMarker);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null;
  const selectedMarker = markers.find(m => m.id === selectedMarkerId) ?? null;

  // Show real markers on map; up to 8
  const mapMarkers: Marker[] = markers.slice(0, 8);

  return (
    <View style={styles.container}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {/* Track polyline when session selected */}
        {selectedSession ? (
          <TrackPolyline session={selectedSession} />
        ) : (
          // Decorative lines when no session selected
          <>
            <View style={styles.routeLine1} />
            <View style={styles.routeLine2} />
            <View style={styles.routeLine3} />
          </>
        )}

        {/* Map placeholder label */}
        {!selectedSession && (
          <View style={styles.mapLabelWrap}>
            <Icon name="Map" size={28} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.mapLabel}>Trail Map</Text>
            <Text style={styles.mapSubLabel}>Route history · Flag markers</Text>
          </View>
        )}

        {/* Selected session stat bar on map */}
        {selectedSession && (
          <View style={styles.trackStatBar}>
            <View style={styles.trackStat}>
              <Text style={styles.trackStatValue}>{formatDistance(selectedSession.distanceM, 'km', 2)}</Text>
              <Text style={styles.trackStatUnit}>km</Text>
            </View>
            <View style={styles.trackStatDivider} />
            <View style={styles.trackStat}>
              <Text style={styles.trackStatValue}>{formatDuration(selectedSession.durationS)}</Text>
              <Text style={styles.trackStatUnit}>time</Text>
            </View>
            <View style={styles.trackStatDivider} />
            <View style={styles.trackStat}>
              <Text style={styles.trackStatValue}>{selectedSession.markerIds.length}</Text>
              <Text style={styles.trackStatUnit}>flags</Text>
            </View>
            <View style={styles.trackStatDivider} />
            <View style={styles.trackStat}>
              <Text style={styles.trackStatValue}>+{selectedSession.elevationGainM}m</Text>
              <Text style={styles.trackStatUnit}>elev</Text>
            </View>
          </View>
        )}

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
              <Icon name={meta.iconName as IconName} size={13} color={meta.color} strokeWidth={2} />
            </View>
          );
        })}
      </View>

      {/* Top bar — overlays map */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topRow}>
          <BackButton variant="pill" />
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
            <Icon name="Route" size={14} color={tab === 'routes' ? '#fff' : Colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'routes' && styles.tabTextActive]}>
              Routes{sessions.length > 0 ? ` (${sessions.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'flags' && styles.tabItemActive]}
            onPress={() => setTab('flags')}
          >
            <Icon name="Flag" size={14} color={tab === 'flags' ? '#fff' : Colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'flags' && styles.tabTextActive]}>
              Flags{markers.length > 0 ? ` (${markers.length})` : ''}
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
                <Icon name="Route" size={40} color={Colors.textMuted} strokeWidth={1.2} />
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtitle}>Start hiking or running to see your routes here</Text>
                <TouchableOpacity style={styles.emptyCta} onPress={() => nav.navigate('Hiking')}>
                  <Icon name="Play" size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.emptyCtaText}>Start a Hike</Text>
                </TouchableOpacity>
              </View>
            ) : (
              sessions.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isSelected={selectedSessionId === s.id}
                  isExpanded={expandedSessionId === s.id}
                  onPress={() => setExpandedSessionId(expandedSessionId === s.id ? null : s.id)}
                  onViewOnMap={() => {
                    setSelectedSessionId(s.id);
                    setExpandedSessionId(null);
                  }}
                />
              ))
            )}
            {selectedSession && (
              <TouchableOpacity
                style={cardStyles.deleteBtn}
                onPress={() => Alert.alert(
                  'Delete Route',
                  'Are you sure you want to delete this route?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => {
                      deleteSession(selectedSession.id);
                      setSelectedSessionId(null);
                    }},
                  ]
                )}
              >
                <Icon name="Trash2" size={IconSize.sm} color={Colors.danger} strokeWidth={2} />
                <Text style={cardStyles.deleteBtnText}>Delete Route</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {markers.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="Flag" size={40} color={Colors.textMuted} strokeWidth={1.2} />
                <Text style={styles.emptyTitle}>No flags planted</Text>
                <Text style={styles.emptySubtitle}>Open the map to place your first flag</Text>
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
                  <PressRow key={m.id} onPress={() => setSelectedMarkerId(m.id)} style={{ marginBottom: 0 }}>
                    <View style={flagStyles.row}>
                      <View style={[flagStyles.iconBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                        <Icon name={meta.iconName as IconName} size={18} color={meta.color} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={flagStyles.titleRow}>
                          <Text style={flagStyles.title}>{meta.label}</Text>
                          <View style={[flagStyles.typePill, { backgroundColor: meta.bg, borderColor: meta.color + '80' }]}>
                            <Text style={[flagStyles.typePillText, { color: meta.color }]}>{m.type}</Text>
                          </View>
                        </View>
                        <Text style={flagStyles.note} numberOfLines={1}>
                          {m.note ? m.note.substring(0, 40) : timeAgo}
                        </Text>
                      </View>
                      <Icon name="ChevronRight" size={IconSize.sm} color={Colors.textMuted} strokeWidth={2} />
                    </View>
                  </PressRow>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {/* Flag detail bottom sheet */}
      {selectedMarker && (
        <FlagDetailSheet
          marker={selectedMarker}
          onClose={() => setSelectedMarkerId(null)}
          onDelete={() => {
            deleteMarker(selectedMarker.id);
            setSelectedMarkerId(null);
          }}
        />
      )}
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
    height: 3, backgroundColor: Colors.running + '70', borderRadius: 2,
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

  trackStatBar: {
    position: 'absolute', bottom: 16, left: Spacing.base, right: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: Radius.card, paddingVertical: Spacing.sm,
    ...Shadow.card,
  },
  trackStat: { flex: 1, alignItems: 'center' },
  trackStatValue: { fontSize: FontSize.caption, fontWeight: '800', color: Colors.textPrimary },
  trackStatUnit: { fontSize: FontSize.tiny, color: Colors.textSecondary, marginTop: 1 },
  trackStatDivider: { width: 1, height: 24, backgroundColor: Colors.border },

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
  emptyTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: Radius.button ?? 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  emptyCtaText: { fontSize: FontSize.caption, fontWeight: '700', color: '#fff' },
});

const cardStyles = StyleSheet.create({
  routeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.card,
    overflow: 'hidden', ...Shadow.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.md,
  },
  routeCardSelected: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary + '50',
  },
  activityBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  routeMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  routeChevron: {},
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.button, paddingVertical: Spacing.sm,
    justifyContent: 'center', marginTop: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.danger + '60',
    backgroundColor: Colors.dangerBg,
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.caption },
  expandedArea: {
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    marginTop: -4,
    borderWidth: 1, borderTopWidth: 0, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  expandedStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  expandedStat: { alignItems: 'center' },
  expandedStatVal: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textPrimary },
  expandedStatLbl: { fontSize: FontSize.tiny, color: Colors.textMuted, marginTop: 1 },
  viewOnMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', borderWidth: 1, borderRadius: 20,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    marginBottom: Spacing.sm,
  },
  viewOnMapText: { fontSize: FontSize.small, fontWeight: '600' },
});

const flagStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBadge: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 3 },
  title: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  typePill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill,
    borderWidth: 1,
  },
  typePillText: { fontSize: FontSize.tiny, fontWeight: '700', textTransform: 'capitalize' },
  note: { fontSize: FontSize.caption, color: Colors.textSecondary },
});

const trackStyles = StyleSheet.create({
  noGpsWrap: {
    position: 'absolute', top: '35%', left: MAP_PADDING, right: MAP_PADDING,
    alignItems: 'center', gap: Spacing.sm,
  },
  noGpsLine: {
    width: '100%', height: 2,
    borderStyle: 'dashed', borderWidth: 2, borderRadius: 1,
    opacity: 0.5,
  },
  noGpsLabel: {
    fontSize: FontSize.small, color: Colors.textMuted,
    fontStyle: 'italic',
  },
  trackDot: {
    position: 'absolute', borderRadius: 6,
  },
  startDot: { width: 12, height: 12 },
  endDot: { width: 16, height: 16, backgroundColor: '#fff', borderWidth: 3 },
});

const sheetStyles = StyleSheet.create({
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, paddingBottom: Spacing.xxl,
    gap: Spacing.md, zIndex: 11,
    ...Shadow.overlay,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start',
    borderRadius: Radius.pill, borderWidth: 1.5,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  typeBadgeText: { fontSize: FontSize.body, fontWeight: '700' },
  noteLabel: { fontSize: FontSize.small, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  noteText: { fontSize: FontSize.body, color: Colors.textPrimary, lineHeight: 22 },
  dateLine: { fontSize: FontSize.caption, color: Colors.textMuted },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.button, paddingVertical: Spacing.md,
    justifyContent: 'center', marginTop: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.danger + '60',
    backgroundColor: Colors.dangerBg,
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.body },
});
