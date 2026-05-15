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

// ── Friend Card ─────────────────────────────────────────────────────────────
function FriendCard({ friend, onToggleShare }: {
  friend: Friend;
  onToggleShare: () => void;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.avatarWrap}>
        <View style={[cardStyles.avatar, { backgroundColor: friend.sharing ? Colors.primaryLight : Colors.border }]}>
          <Text style={[cardStyles.avatarText, { color: friend.sharing ? Colors.primary : Colors.textMuted }]}>
            {friend.initials}
          </Text>
        </View>
        <View style={[cardStyles.onlineDot, { backgroundColor: friend.online ? Colors.success : Colors.border }]} />
      </View>
      <View style={cardStyles.info}>
        <Text style={cardStyles.name}>{friend.name}</Text>
        <Text style={cardStyles.meta}>
          {friend.online ? 'Online' : friend.lastSeen}
          {friend.sharedMarkers > 0 ? ` · ${friend.sharedMarkers} shared flags` : ''}
        </Text>
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
          thumbColor={friend.sharing ? Colors.primary : Colors.textMuted}
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

  const toggleShare = (id: string) => {
    setFriends(prev => prev.map(f => f.id === id ? { ...f, sharing: !f.sharing } : f));
  };

  const sharingCount = friends.filter(f => f.sharing).length;
  const hasFriends = friends.length > 0;

  return (
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
          <View style={styles.shareBanner}>
            <Text style={styles.shareBannerText}>
              Sharing flags with {sharingCount}/{friends.length} friends
            </Text>
            <Text style={styles.shareBannerSub}>Toggle sharing individually per friend</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {friends.map(friend => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onToggleShare={() => toggleShare(friend.id)}
              />
            ))}

            {/* Add friend card */}
            <PressCard onPress={() => setShowAdd(true)} style={{ marginTop: Spacing.xs }}>
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

  shareBanner: {
    backgroundColor: 'rgba(93,124,70,0.08)',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  shareBannerText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.primary },
  shareBannerSub: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },

  scrollContent: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  addCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed',
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
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  infoBoxText: {
    flex: 1, fontSize: FontSize.small,
    color: Colors.textSecondary, lineHeight: 18,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, ...Shadow.card,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.h3, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.bg,
  },
  info: { flex: 1 },
  name: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  meta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
