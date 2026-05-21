/**
 * OtaBadge — production-grade OTA status pill.
 *
 * Visibility rule (per user request):
 *   • No update → COMPLETELY HIDDEN (no version display, no idle pill)
 *   • Update detected → SHOW persistently top-right until applied
 *   • While downloading → spinner + label
 *   • When ready → amber pulse, tappable
 *   • User taps → modal "Update now / Later"
 *   • Update now → spinner → reload
 *   • Later → stays as small "Update pending" dot until tapped again
 *
 * Mount on every primary screen (Home, Auth, Settings, etc.) so the
 * badge follows the user wherever they go after launch.
 *
 * Lazy-loads expo-updates so a missing module doesn't crash the screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity, Text, View, StyleSheet, ActivityIndicator,
  Animated, Easing, Modal, Pressable,
} from 'react-native';

type OtaState =
  | 'hidden'        // no update / not yet checked — render nothing
  | 'checking'      // brief — only if we want to show "checking" UI; hidden by default
  | 'downloading'   // spinner + "Downloading"
  | 'ready'         // amber pulse, tappable, "Update available"
  | 'applying'      // spinner + "Applying"
  | 'pending';      // user chose Later — small dot, persists

const COLORS = {
  bg: 'rgba(255,255,255,0.96)',
  border: 'rgba(0,0,0,0.06)',
  text: '#111827',
  textMuted: '#6B7280',
  dotBlue: '#3B82F6',
  dotAmber: '#F59E0B',
  dotGreen: '#10B981',
  ctaBg: '#5d7c46',
  ctaText: '#FFFFFF',
};

export function OtaBadge() {
  const [state, setState] = useState<OtaState>('hidden');
  const [modalOpen, setModalOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade in whenever state becomes visible
  useEffect(() => {
    if (state === 'hidden') {
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(fade, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [state]);

  // Pulse when ready
  useEffect(() => {
    if (state === 'ready') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulseLoopRef.current = loop;
      loop.start();
    } else {
      pulseLoopRef.current?.stop();
      pulse.setValue(1);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [state]);

  // OTA check + download flow
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Updates = await import('expo-updates');
        if (!Updates.isEnabled) {
          // No expo-updates → stay hidden silently
          return;
        }
        const result = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (!result.isAvailable) {
          // No update → stay hidden silently
          return;
        }
        // Update available → make visible immediately as "downloading"
        setState('downloading');
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setState('ready');
      } catch {
        // Network / OTA error → stay hidden (don't bother user)
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePress = () => {
    if (state === 'ready' || state === 'pending') setModalOpen(true);
  };

  const handleApply = async () => {
    setModalOpen(false);
    setState('applying');
    try {
      const Updates = await import('expo-updates');
      setTimeout(() => Updates.reloadAsync(), 400);
    } catch {
      setState('hidden');
    }
  };

  const handleLater = () => {
    setModalOpen(false);
    setState('pending');
  };

  if (state === 'hidden') return null;

  // Visual config per state
  let dotColor = COLORS.dotAmber;
  let label = '';
  let showSpinner = false;
  let interactive = false;

  switch (state) {
    case 'downloading':
      dotColor = COLORS.dotBlue;
      label = 'Downloading update';
      showSpinner = true;
      break;
    case 'ready':
      dotColor = COLORS.dotAmber;
      label = 'Update available';
      interactive = true;
      break;
    case 'applying':
      dotColor = COLORS.dotBlue;
      label = 'Applying';
      showSpinner = true;
      break;
    case 'pending':
      dotColor = COLORS.dotAmber;
      label = 'Update pending';
      interactive = true;
      break;
  }

  return (
    <>
      <Animated.View
        style={[styles.wrap, { opacity: fade, transform: [{ scale: pulse }] }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.badge}
          onPress={handlePress}
          activeOpacity={interactive ? 0.65 : 1}
          disabled={!interactive}
        >
          {showSpinner ? (
            <ActivityIndicator size="small" color={dotColor} style={styles.spinner} />
          ) : (
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
          )}
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={[styles.modalIconDot, { backgroundColor: COLORS.dotAmber }]} />
              <View style={[styles.modalIconDot, { backgroundColor: COLORS.dotAmber, opacity: 0.5 }]} />
              <View style={[styles.modalIconDot, { backgroundColor: COLORS.dotAmber, opacity: 0.25 }]} />
            </View>
            <Text style={styles.modalTitle}>New version ready</Text>
            <Text style={styles.modalBody}>
              A small update has been downloaded. Restart now to apply — it only takes a second.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={handleLater} activeOpacity={0.7}>
                <Text style={styles.btnSecondaryText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleApply} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Update now</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1000,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  spinner: { marginRight: 6, transform: [{ scale: 0.7 }] },
  label: { fontSize: 11.5, fontWeight: '600', color: COLORS.text, letterSpacing: 0.1 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 14,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  modalIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  btnPrimary: {
    backgroundColor: COLORS.ctaBg,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ctaText,
  },
});

