/**
 * DebugAnnotationFAB — floating "label what just happened" button.
 *
 * Visible only when:
 *   - useSettingsStore.debugMode === true
 *   - useSettingsStore.debugAnnotationFabVisible === true
 *
 * Tapping the main FAB expands 6 tag buttons. Selecting a tag writes a
 * `user_annotation` event with the current GPS coordinate (best known).
 *
 * Doesn't block tracking — single tap, haptic feedback, "Logged ✓" toast (1s).
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, Radius } from './tokens';
import { Icon } from './Icon';
import { debugLogger } from '../services/debugLogger';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTrackingStore } from '../store/useTrackingStore';

const TAGS: Array<{
  tag:
    | 'gps_inaccurate'
    | 'deviation_false_positive'
    | 'deviation_missed'
    | 'broadcast_jarring'
    | 'marker_misplaced'
    | 'other';
  label: string;
  color: string;
}> = [
  { tag: 'gps_inaccurate',           label: 'GPS off',         color: '#3F8FA0' },
  { tag: 'deviation_false_positive', label: 'False deviation', color: '#F26522' },
  { tag: 'deviation_missed',         label: 'Missed dev.',     color: '#F0C419' },
  { tag: 'broadcast_jarring',        label: 'Broadcast bad',   color: '#9C5CB7' },
  { tag: 'marker_misplaced',         label: 'Marker off',      color: '#7B6750' },
  { tag: 'other',                    label: 'Other',           color: '#777777' },
];

export function DebugAnnotationFAB() {
  const debugMode = useSettingsStore((s) => s.debugMode);
  const visible = useSettingsStore((s) => s.debugAnnotationFabVisible);
  const lastCoord = useTrackingStore((s) => s.lastCoordinate);

  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  if (!debugMode || !visible) return null;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(expandAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function annotate(tag: typeof TAGS[number]['tag']) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    debugLogger.log({
      ts: Date.now(),
      event: 'user_annotation',
      tag,
      lat: lastCoord?.lat ?? null,
      lon: lastCoord?.lng ?? null,
      accuracy_m: lastCoord?.accuracy ?? null,
    });

    setToast(`Logged: ${tag.replace(/_/g, ' ')}`);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 1000);

    // Auto-collapse
    setExpanded(false);
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Tag buttons (only rendered when expanded) */}
      {expanded && (
        <View style={styles.menu} pointerEvents="box-none">
          {TAGS.map((t, i) => {
            const translateY = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, -(i + 1) * 50],
            });
            return (
              <Animated.View
                key={t.tag}
                style={[
                  styles.tagBtnWrap,
                  { transform: [{ translateY }], opacity: expandAnim },
                ]}
              >
                <TouchableOpacity
                  style={[styles.tagBtn, { borderColor: t.color }]}
                  onPress={() => annotate(t.tag)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dot, { backgroundColor: t.color }]} />
                  <Text style={styles.tagLabel}>{t.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Main FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityLabel="Debug annotations"
      >
        <Icon name="MapPin" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 100, // above tab bar
    alignItems: 'flex-end',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5C3A8E', // distinct purple — unmistakably "debug"
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  menu: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
  },
  tagBtnWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  tagLabel: {
    fontSize: 13,
    color: '#222',
  },
  toast: {
    position: 'absolute',
    bottom: 56,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default DebugAnnotationFAB;
