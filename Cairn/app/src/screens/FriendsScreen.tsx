/**
 * FriendsScreen — Sprint 19 uplift (STORY-00045)
 *
 * - Empty state: illustration + "No friends yet" + CTA
 * - Add-friend form: email validation, "Can't invite yourself", loading → success state
 * - Existing friends list unchanged; Add button works from both CTA and top-right
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Animated, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { MOCK_FRIENDS } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Friend = typeof MOCK_FRIENDS[0] & { sharing: boolean };

const OWN_EMAIL = 'me@cairn.app';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Spring press wrapper ────────────────────────────────────────────────────
function PressCard({
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

// Derive status dot color: online=success, recent(<1h)=warning, inactive=border
function getStatusDotColor(online: boolean, lastSeen: string): string {
  if (online) return Colors.success;
  // "45m ago", "1h ago", "Just now" → recent
  const recentMatch = lastSeen.match(/^(\d+)m ago$/i);
  if (recentMatch) return Colors.warning;
  if (/^1h ago$/i.test(lastSeen)) return Colors.warning;
  if (/just now/i.test(lastSeen)) return Colors.success;
  return Colors.border;
}

// ── Friend Card ─────────────────────────────────────────────────────────────
function FriendCard({ friend, onToggleShare }: {
  friend: Friend;
  onToggleShare: () => void;
}) {
  const statusColor = getStatusDotColor(friend.online, friend.lastSeen);
  const avatarGradStart = Colors.primaryLight;
  const avatarGradEnd = Colors.primaryDeep;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.avatarWrap}>
        <LinearGradient
          colors={[avatarGradStart, avatarGradEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={cardStyles.avatar}
        >
          <Text style={cardStyles.avatarText}>
            {friend.initials}
          </Text>
        </LinearGradient>
        <View style={[cardStyles.onlineDot, { backgroundColor: statusColor }]} />
      </View>
      <View style={cardStyles.info}>
        <Text style={cardStyles.name}>{friend.name}</Text>
        <View style={cardStyles.metaRow}>
          <Text style={cardStyles.meta}>
            {friend.online ? 'Online' : friend.lastSeen}
          </Text>
          {friend.sharedMarkers > 0 && (
            <>
              <Text style={cardStyles.metaDot}> · </Text>
              <Icon name="Flag" size={12} color={Colors.flag} strokeWidth={2} />
              <Text style={cardStyles.meta}> {friend.sharedMarkers} shared flags</Text>
            </>
          )}
        </View>
        {!friend.sharing && (
          <Text style={cardStyles.noShareLabel}>Not sharing flags</Text>
        )}
      </View>
      <View style={cardStyles.toggleCol}>
        <Text style={cardStyles.toggleLabel}>{friend.sharing ? 'Sharing' : 'Hidden'}</Text>
        <Switch
          value={friend.sharing}
          onValueChange={onToggleShare}
          trackColor={{ false: Colors.border, true: Colors.primaryLight }}
          thumbColor="#fff"
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>
    </View>
  );
}

// ── Add Friend Sheet ─────────────────────────────────────────────────────────
type AddState = 'idle' | 'loading' | 'success' | 'error';

function AddFriendSheet({ onDismiss }: { onDismiss: () => void }) {
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState('');
  const [addState, setAddState] = useState<AddState>('idle');
  const successEmail = useRef('');

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setValidationError('Enter a valid email');
      return;
    }
    if (trimmed.toLowerCase() === OWN_EMAIL.toLowerCase()) {
      setValidationError("Can't invite yourself");
      return;
    }
    setValidationError('');
    setAddState('loading');
    successEmail.current = trimmed;
    // Simulate async send
    setTimeout(() => {
      setAddState('success');
      setTimeout(() => {
        setEmail('');
        setAddState('idle');
        onDismiss();
      }, 2000);
    }, 900);
  };

  return (
    <View style={sheetStyles.backdrop}>
      <View style={sheetStyles.sheet}>
        {/* Drag handle */}
        <View style={sheetStyles.handle} />

        {addState === 'success' ? (
          <View style={sheetStyles.successState}>
            <View style={sheetStyles.successIcon}>
              <Icon name="CircleCheck" size={40} color={Colors.success} strokeWidth={1.5} />
            </View>
            <Text style={sheetStyles.successTitle}>Invite sent!</Text>
            <Text style={sheetStyles.successEmail}>{successEmail.current}</Text>
          </View>
        ) : (
          <>
            <View style={sheetStyles.illustration}>
              <View style={sheetStyles.illustrationIcon}>
                <Icon name="Users" size={40} color={Colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={sheetStyles.illustrationTitle}>Add a Friend</Text>
              <Text style={sheetStyles.illustrationSub}>
                They'll receive an email invitation
              </Text>
            </View>

            <Text style={sheetStyles.fieldLabel}>Friend's email</Text>
            <View style={[sheetStyles.inputWrap, validationError ? sheetStyles.inputError : null]}>
              <Icon name="Mail" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
              <TextInput
                style={sheetStyles.input}
                placeholder="Email they use for Cairn"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); if (validationError) setValidationError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>
            {!!validationError && (
              <Text style={sheetStyles.errorText}>{validationError}</Text>
            )}

            <TouchableOpacity
              style={[sheetStyles.sendBtn, (!email.trim() || addState === 'loading') && sheetStyles.sendBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={email.trim() ? 0.8 : 1}
            >
              {addState === 'loading' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="Send" size={IconSize.sm} color="#fff" strokeWidth={2} />
                  <Text style={sheetStyles.sendBtnText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onDismiss}>
              <Text style={sheetStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onAddFriend }: { onAddFriend: () => void }) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        <Icon name="Users" size={56} color={Colors.textMuted} strokeWidth={1.2} />
      </View>
      <Text style={emptyStyles.heading}>No friends yet</Text>
      <Text style={emptyStyles.body}>Add friends to share flags and stay connected</Text>
      <TouchableOpacity style={emptyStyles.cta} onPress={onAddFriend}>
        <Icon name="UserPlus" size={IconSize.sm} color="#fff" strokeWidth={2} />
        <Text style={emptyStyles.ctaText}>Add a Friend</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function FriendsScreen() {
  const nav = useNavigation<Nav>();
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<Friend[]>(
    MOCK_FRIENDS.map(f => ({ ...f, sharing: true }))
  );

  // STORY-00109: staggered entrance animations
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTransY = useRef(new Animated.Value(12)).current;
  // 4 friend cards + 1 add card = 5 card anims
  const cardAnims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      transY: new Animated.Value(16),
    }))
  ).current;

  useEffect(() => {
    // Screen fade-in: 280ms ease-out
    Animated.timing(screenOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();

    // Banner: fade + slide up, 250ms, delay 80ms
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 250, delay: 80, useNativeDriver: true }),
      Animated.timing(bannerTransY, { toValue: 0, duration: 250, delay: 80, useNativeDriver: true }),
    ]).start();

    // Cards: stagger 60ms, starting at delay ~160ms
    const cardAnimations = cardAnims.map((a) =>
      Animated.parallel([
        Animated.timing(a.opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(a.transY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ])
    );
    setTimeout(() => Animated.stagger(60, cardAnimations).start(), 160);
  }, []);

  const toggleShare = (id: string) => {
    setFriends(prev => prev.map(f => f.id === id ? { ...f, sharing: !f.sharing } : f));
  };

  const sharingCount = friends.filter(f => f.sharing).length;
  const hasFriends = friends.length > 0;

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: screenOpacity }]}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <BackButton variant="inline" />
        <Text style={styles.topTitle}>Friends</Text>
        <TouchableOpacity style={styles.addTopBtn} onPress={() => setShowAdd(true)}>
          <Icon name="UserPlus" size={14} color="#fff" strokeWidth={2} />
          <Text style={styles.addTopBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {hasFriends ? (
        <>
          {/* Share summary banner */}
          <Animated.View style={{ opacity: bannerOpacity, transform: [{ translateY: bannerTransY }] }}>
          <View style={styles.shareBannerRow}>
            <View style={styles.sharePill}>
              <Icon name="Users" size={12} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.shareBannerText}>
                Sharing flags with {sharingCount}/{friends.length} friends
              </Text>
            </View>
            <Text style={styles.shareBannerSub}>Toggle sharing individually per friend</Text>
          </View>
          </Animated.View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {friends.map((friend, i) => (
              <Animated.View
                key={friend.id}
                style={{ opacity: cardAnims[i]?.opacity ?? 1, transform: [{ translateY: cardAnims[i]?.transY ?? 0 }] }}
              >
                <FriendCard
                  friend={friend}
                  onToggleShare={() => toggleShare(friend.id)}
                />
              </Animated.View>
            ))}

            {/* Add friend card */}
            <Animated.View style={{ opacity: cardAnims[friends.length]?.opacity ?? 1, transform: [{ translateY: cardAnims[friends.length]?.transY ?? 0 }], marginTop: Spacing.xs }}>
            <PressCard onPress={() => setShowAdd(true)}>
              <View style={styles.addCard}>
                <View style={styles.addCardIconWrap}>
                  <Icon name="UserPlus" size={IconSize.md} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={styles.addCardLabel}>Add a friend</Text>
                  <Text style={styles.addCardHint}>Invite by email</Text>
                </View>
              </View>
            </PressCard>
            </Animated.View>

            {/* Info box */}
            <View style={styles.infoBox}>
              <Icon name="Info" size={14} color={Colors.textSecondary} strokeWidth={1.8} />
              <Text style={styles.infoBoxText}>
                When you turn off sharing, that friend won't see your new flags. Existing shared flags are not affected.
              </Text>
            </View>
          </ScrollView>
        </>
      ) : (
        <EmptyState onAddFriend={() => setShowAdd(true)} />
      )}

      {/* Add Friend Sheet */}
      {showAdd && (
        <AddFriendSheet onDismiss={() => setShowAdd(false)} />
      )}
    </SafeAreaView>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 6, paddingRight: Spacing.sm,
  },
  backText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.primary },
  topTitle: {
    flex: 1, textAlign: 'center',
    fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary,
  },
  addTopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  addTopBtnText: { fontSize: FontSize.small, fontWeight: '700', color: '#fff' },

  shareBannerRow: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 4,
  },
  sharePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
  },
  shareBannerText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.primary },
  shareBannerSub: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2, paddingHorizontal: 2 },

  scrollContent: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  addCard: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary,
    borderStyle: 'dashed', opacity: 0.9,
  },
  addCardIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addCardLabel: { fontSize: FontSize.body, fontWeight: '600', color: Colors.primary },
  addCardHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 1 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    marginTop: Spacing.xs,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  infoBoxText: {
    flex: 1, fontSize: FontSize.small,
    color: Colors.textSecondary, lineHeight: 18,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.primary },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: Colors.bg,
  },
  info: { flex: 1 },
  name: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaDot: { fontSize: FontSize.small, color: Colors.textSecondary },
  meta: { fontSize: FontSize.small, color: Colors.textSecondary },
  noShareLabel: {
    fontSize: FontSize.tiny, fontWeight: '600', color: Colors.textMuted,
    marginTop: 3, backgroundColor: Colors.border,
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  toggleCol: { alignItems: 'center', gap: 2 },
  toggleLabel: { fontSize: FontSize.tiny, color: Colors.textMuted, fontWeight: '500' },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.overlayDark,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  illustration: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  illustrationIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  illustrationTitle: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  illustrationSub: { fontSize: FontSize.small, color: Colors.textSecondary, textAlign: 'center' },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  inputError: { borderColor: Colors.danger },
  input: {
    flex: 1, paddingVertical: Spacing.md,
    fontSize: FontSize.body, color: Colors.textPrimary,
  },
  errorText: {
    fontSize: FontSize.small, color: Colors.danger,
    fontWeight: '600', marginTop: -Spacing.xs,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingVertical: Spacing.md, minHeight: 52,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '500' },

  successState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.successBg,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.success },
  successEmail: { fontSize: FontSize.body, color: Colors.textSecondary },
});

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.lg,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: {
    fontSize: FontSize.h2, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.body, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
});
