/**
 * FriendsScreen — Sprint 11 redesign
 *
 * - SVG icons replace all text/emoji (ChevronLeft back, UserPlus add, Users illustration,
 *   Info tip, Mail email prefix, Send submit)
 * - Spring press on friend cards and add card
 * - Switch component kept (native control)
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { MOCK_FRIENDS } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Friend = typeof MOCK_FRIENDS[0] & { sharing: boolean };

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
      {/* Avatar */}
      <View style={cardStyles.avatarWrap}>
        <View style={[cardStyles.avatar, { backgroundColor: friend.sharing ? Colors.primaryLight : Colors.border }]}>
          <Text style={[cardStyles.avatarText, { color: friend.sharing ? Colors.primary : Colors.textMuted }]}>
            {friend.initials}
          </Text>
        </View>
        <View style={[cardStyles.onlineDot, { backgroundColor: friend.online ? Colors.success : Colors.border }]} />
      </View>

      {/* Info */}
      <View style={cardStyles.info}>
        <Text style={cardStyles.name}>{friend.name}</Text>
        <Text style={cardStyles.meta}>
          {friend.online ? '在线' : friend.lastSeen}
          {friend.sharedMarkers > 0 ? ` · ${friend.sharedMarkers}个共同旗帜` : ''}
        </Text>
        {!friend.sharing && (
          <Text style={cardStyles.noShareLabel}>旗帜不分享</Text>
        )}
      </View>

      {/* Share toggle */}
      <View style={cardStyles.toggleCol}>
        <Text style={cardStyles.toggleLabel}>{friend.sharing ? '分享' : '不分享'}</Text>
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

// ── Add Friend View ──────────────────────────────────────────────────────────
function AddFriendView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>添加好友</Text>
        <View style={{ width: 72 }} />
      </View>

      <View style={addStyles.form}>
        {/* Illustration */}
        <View style={addStyles.illustration}>
          <View style={addStyles.illustrationIcon}>
            <Icon name="Users" size={48} color={Colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={addStyles.illustrationText}>通过邮箱邀请好友{'\n'}对方确认后成为好友</Text>
        </View>

        <Text style={addStyles.fieldLabel}>好友邮箱</Text>
        <View style={addStyles.inputWrap}>
          <Icon name="Mail" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
          <TextInput
            style={addStyles.input}
            placeholder="对方注册Cairn时使用的邮箱"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[addStyles.sendBtn, !email.trim() && addStyles.sendBtnDisabled]}
          onPress={() => {
            if (!email.trim()) return;
            Alert.alert('', `邀请已发送至 ${email}`, [{ text: '好的', onPress: onBack }]);
          }}
          activeOpacity={email.trim() ? 0.8 : 1}
        >
          <Icon name="Send" size={IconSize.sm} color="#fff" strokeWidth={2} />
          <Text style={addStyles.sendBtnText}>发送邀请</Text>
        </TouchableOpacity>

        <Text style={addStyles.hint}>对方会收到一封邮件邀请，确认后自动成为好友</Text>
      </View>
    </SafeAreaView>
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

  if (showAdd) {
    return <AddFriendView onBack={() => setShowAdd(false)} />;
  }

  const sharingCount = friends.filter(f => f.sharing).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
          <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>好友</Text>
        <TouchableOpacity style={styles.addTopBtn} onPress={() => setShowAdd(true)}>
          <Icon name="UserPlus" size={14} color="#fff" strokeWidth={2} />
          <Text style={styles.addTopBtnText}>添加</Text>
        </TouchableOpacity>
      </View>

      {/* Share summary banner */}
      <View style={styles.shareBanner}>
        <Text style={styles.shareBannerText}>
          与 {sharingCount}/{friends.length} 位好友分享旗帜
        </Text>
        <Text style={styles.shareBannerSub}>可为每位好友单独开关分享</Text>
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
              <Text style={styles.addCardLabel}>添加好友</Text>
              <Text style={styles.addCardHint}>通过邮箱邀请</Text>
            </View>
          </View>
        </PressCard>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Icon name="Info" size={14} color={Colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.infoBoxText}>
            关闭分享后，该好友将看不到你新建的旗帜。已有的共同旗帜不受影响。
          </Text>
        </View>
      </ScrollView>
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

const addStyles = StyleSheet.create({
  form: { padding: Spacing.xl, gap: Spacing.md },
  illustration: {
    alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md,
  },
  illustrationIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  illustrationText: {
    fontSize: FontSize.caption, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  input: {
    flex: 1, paddingVertical: Spacing.md,
    fontSize: FontSize.body, color: Colors.textPrimary,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingVertical: Spacing.md,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  hint: {
    fontSize: FontSize.small, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 18,
  },
});
