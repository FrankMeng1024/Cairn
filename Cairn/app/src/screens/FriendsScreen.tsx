import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';
import { MOCK_FRIENDS } from '../data/mockData';

export function FriendsScreen() {
  const { uiMode } = useAppStore();
  const isGuided = uiMode === 'guided';
  const [showAdd, setShowAdd] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  if (showAdd) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowAdd(false)}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>添加好友</Text>
          {isGuided && <Text style={styles.subtitle}>通过邮箱邀请，对方确认后成为好友</Text>}
        </View>
        <View style={styles.addForm}>
          <Text style={styles.fieldLabel}>好友邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder={isGuided ? '对方注册Cairn时使用的邮箱' : '邮箱'}
            placeholderTextColor={Colors.textMuted}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              Alert.alert('', '邀请已发送');
              setInviteEmail('');
              setShowAdd(false);
            }}
          >
            <Text style={styles.primaryBtnText}>发送邀请</Text>
            {isGuided && <Text style={styles.primaryBtnHint}>对方会收到邮件邀请</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{isGuided ? '好友 — 分享路况的人' : '好友'}</Text>
        {isGuided && <Text style={styles.subtitle}>好友可以看到彼此的公开标记</Text>}
      </View>

      <FlatList
        data={MOCK_FRIENDS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friendCard} activeOpacity={0.8}>
            <View style={[styles.avatar, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.avatarText}>{item.initials}</Text>
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{item.name}</Text>
              {isGuided ? (
                <Text style={styles.friendHint}>
                  {item.online ? '在线' : item.lastSeen} · 共{item.sharedMarkers}个共同标记
                </Text>
              ) : (
                <Text style={styles.friendHint}>{item.lastSeen}</Text>
              )}
              {isGuided && <Text style={styles.friendTip}>点击查看Ta标记的路况</Text>}
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.online ? Colors.success : Colors.textMuted }]} />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>
              {isGuided ? '+ 添加好友（通过邮箱邀请）' : '+'}
            </Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  backText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.sm },
  title: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 4 },

  friendCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    ...Shadow.card,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.h3, fontWeight: '700', color: Colors.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  friendHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  friendTip: { fontSize: FontSize.tiny, color: Colors.textMuted, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  addBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.primary },

  addForm: { padding: Spacing.xl },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.base,
  },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    padding: Spacing.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  primaryBtnHint: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.small, marginTop: 2 },
});
