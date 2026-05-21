/**
 * OtaBadge — production-grade OTA status pill (策略 3: 可选更新 + 通知).
 *
 * Placement: top-right of AuthScreen (or any screen that includes it).
 *
 * UX flow (策略 3):
 *   1. Mount → check for update silently
 *   2. If no update → show subtle green dot + version (auto-fades after 4s)
 *   3. If update found → start downloading + show animated pill
 *   4. When ready → bounce + change to amber, tappable
 *   5. Tap → modal "New version available — apply now?" with Update / Later
 *   6. Update → spinner → reload (≈1s)
 *   7. Later → minimize to small "Update pending" dot, reappears on next launch
 *
 * Lazy-loads expo-updates so a missing module doesn't crash AuthScreen.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity, Text, View, StyleSheet, ActivityIndicator,
  Animated, Easing, Modal, Pressable,
} from 'react-native';

type OtaState =
  | 'hidden'        // initial / no update / fully fades after idle
  | 'idle'          // showing current version briefly
  | 'checking'      // spinner + "Checking"
  | 'downloading'   // spinner + "Downloading"
  | 'ready'         // pulse amber, tappable
  | 'applying'      // spinner + "Applying"
  | 'pending'       // user chose Later — small dot
  | 'error';        // OTA disabled / network — small red dot

const COLORS = {
  bg: 'rgba(255,255,255,0.94)',
  border: 'rgba(0,0,0,0.06)',
  text: '#111827',
  textMuted: '#6B7280',
  dotIdle: '#10B981',     // green
  dotCheck: '#3B82F6',    // blue
  dotReady: '#F59E0B',    // amber
  dotError: '#EF4444',    // red
  ctaBg: '#5d7c46',       // sage (Cairn primary)
  ctaText: '#FFFFFF',
};

export function OtaBadge() {
  const [state, setState] = useState<OtaState>('hidden');
  const [shortVer, setShortVer] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade in when state changes from hidden
  useEffect(() => {
    if (state === 'hidden') return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state]);

  // Auto-hide idle after 4s (no update available — user just wants to glance at version)
  useEffect(() => {
    if (state !== 'idle') return;
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setState('hidden'); });
    }, 4000);
    return () => clearTimeout(t);
  }, [state]);

  // Pulse animation when ready (gentle, not annoying)
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

  // OTA check + download flow (runs once on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Updates = await import('expo-updates');
        if (!Updates.isEnabled) {
          if (!cancelled) setState('error');
          return;
        }
        // Capture current version short id
        const current = (Updates as any).updateId as string | null;
        if (!cancelled) setShortVer(current ? current.slice(0, 6) : 'embed');

        if (!cancelled) setState('checking');
        const result = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (!result.isAvailable) {
          setState('idle');
          return;
        }
        setState('downloading');
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePress = () => {
    if (state === 'ready') setModalOpen(true);
    else if (state === 'pending') setModalOpen(true);
  };

  const handleApply = async () => {
    setModalOpen(false);
    setState('applying');
    try {
      const Updates = await import('expo-updates');
      // Brief delay so user sees "Applying" before reload
      setTimeout(() => Updates.reloadAsync(), 400);
    } catch {
      setState('error');
    }
  };

  const handleLater = () => {
    setModalOpen(false);
    setState('pending');
  };

  if (state === 'hidden') return null;

  // Pick visual config per state
  let dotColor = COLORS.dotIdle;
  let label = '';
  let showSpinner = false;
  let interactive = false;

  switch (state) {
    case 'idle':        dotColor = COLORS.dotIdle;   label = `v${shortVer}`;          break;
    case 'checking':    dotColor = COLORS.dotCheck;  label = 'Checking';   showSpinner = true; break;
    case 'downloading': dotColor = COLORS.dotCheck;  label = 'Downloading'; showSpinner = true; break;
    case 'ready':       dotColor = COLORS.dotReady;  label = 'Update ready'; interactive = true; break;
    case 'applying':    dotColor = COLORS.dotCheck;  label = 'Applying';   showSpinner = true; break;
    case 'pending':     dotColor = COLORS.dotReady;  label = 'Update pending'; interactive = true; break;
    case 'error':       dotColor = COLORS.dotError;  label = 'Offline';                break;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.wrap,
          { opacity: fade, transform: [{ scale: pulse }] },
        ]}
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
            <Text style={styles.modalTitle}>New version available</Text>
            <Text style={styles.modalBody}>
              A small update is ready. It only takes a second to apply — the app will restart.
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
    // soft drop shadow
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
