/**
 * FriendsScreen — design.jpg "好友页"
 *
 * - Friend list with per-friend "不分享" toggle (individual share control)
 * - Online status indicator
 * - Shared marker count
 * - "+ 添加好友" → email invite flow
 * - Back button (stack navigation)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';
import { MOCK_FRIENDS } from '../data/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Friend = typeof MOCK_FRIENDS[0] & { sharing: boolean };

// ── Friend Card ───────────────────────────────────────────────────────────────
function FriendCard({ friend, onToggleShare }: {
  friend: Friend;
  onToggleShare: () => void;
}) {
  return (
    <View style={styles.friendCard}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: friend.sharing ? Colors.primaryLight : Colors.border }]}>
          <Text style={[styles.avatarText, { color: friend.sharing ? Colors.primary : Colors.textMuted }]}>
            {friend.initials}
          </Text>
        </View>
        {/* Online dot */}
        <View style={[
          styles.onlineDot,
          { backgroundColor: friend.online ? Colors.success : Colors.border },
        ]} />
      </View>

      {/* Info */}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.name}</Text>
        <Text style={styles.friendMeta}>
          {friend.online ? '在线' : friend.lastSeen}
          {friend.sharedMarkers > 0 ? ` · ${friend.sharedMarkers}个共同旗帜` : ''}
        </Text>
        {!friend.sharing && (
          <Text style={styles.noShareLabel}>旗帜不分享</Text>
        )}
      </View>

      {/* Share toggle */}
      <View style={styles.shareToggleCol}>
        <Text style={styles.shareToggleLabel}>{friend.sharing ? '分享' : '不分享'}</Text>
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

// ── Add Friend Sheet ──────────────────────────────────────────────────────────
function AddFriendView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>添加好友</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.addForm}>
        <View style={styles.addIllustration}>
          <Text style={styles.addIllustrationEmoji}>👥</Text>
          <Text style={styles.addIllustrationText}>通过邮箱邀请好友{'\n'}对方确认后成为好友</Text>
        </View>

        <Text style={styles.fieldLabel}>好友邮箱</Text>
        <TextInput
          style={styles.input}
          placeholder="对方注册Cairn时使用的邮箱"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.sendBtn, !email.trim() && styles.sendBtnDisabled]}
          onPress={() => {
            if (!email.trim()) return;
            Alert.alert('', `邀请已发送至 ${email}`, [{ text: '好的', onPress: onBack }]);
          }}
          activeOpacity={email.trim() ? 0.8 : 1}
        >
          <Text style={styles.sendBtnText}>发送邀请</Text>
        </TouchableOpacity>

        <Text style={styles.addHint}>对方会收到一封邮件邀请，确认后自动成为好友</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Main FriendsScreen ────────────────────────────────────────────────────────
export function FriendsScreen() {
  const nav = useNavigation<Nav>();
  const [showAdd, setShowAdd] = useState(false);

  // Local share state per friend
  const [friends, setFriends] = useState<Friend[]>(
    MOCK_FRIENDS.map(f => ({ ...f, sharing: true }))
  );

  const toggleShare = (id: string) => {
    setFriends(prev => prev.map(f =>
      f.id === id ? { ...f, sharing: !f.sharing } : f
    ));
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
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>好友</Text>
        <TouchableOpacity
          style={styles.addTopBtn}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.addTopBtnText}>+ 添加</Text>
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
        {/* Friends list */}
        {friends.map(friend => (
          <FriendCard
            key={friend.id}
            friend={friend}
            onToggleShare={() => toggleShare(friend.id)}
          />
        ))}

        {/* Add friend button */}
        <TouchableOpacity
          style={styles.addCard}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.addCardIcon}>+</Text>
          <View>
            <Text style={styles.addCardLabel}>添加好友</Text>
            <Text style={styles.addCardHint}>通过邮箱邀请</Text>
          </View>
        </TouchableOpacity>

        {/* Info footer */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            💡 关闭分享后，该好友将看不到你新建的旗帜。已有的共同旗帜不受影响。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  backBtn: { paddingVertical: 6, paddingRight: Spacing.sm },
  backText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.primary },
  topTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.h3, fontWeight: '700', color: Colors.textPrimary },
  addTopBtn: {
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

  friendCard: {
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
  friendInfo: { flex: 1 },
  friendName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  friendMeta: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  noShareLabel: {
    fontSize: FontSize.tiny, fontWeight: '600', color: Colors.textMuted,
    marginTop: 3, backgroundColor: Colors.border,
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  shareToggleCol: { alignItems: 'center', gap: 2 },
  shareToggleLabel: { fontSize: FontSize.tiny, color: Colors.textMuted, fontWeight: '500' },

  addCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addCardIcon: { fontSize: 22, color: Colors.primary, fontWeight: '700', width: 46, textAlign: 'center' },
  addCardLabel: { fontSize: FontSize.body, fontWeight: '600', color: Colors.primary },
  addCardHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 1 },

  infoBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  infoBoxText: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 18 },

  // Add friend form
  addForm: { padding: Spacing.xl, gap: Spacing.md },
  addIllustration: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  addIllustrationEmoji: { fontSize: 56 },
  addIllustrationText: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  addHint: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
