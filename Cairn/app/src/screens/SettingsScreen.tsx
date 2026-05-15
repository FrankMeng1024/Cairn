/**
 * SettingsScreen — design.jpg "设置页"
 *
 * - Simple/Expert (简易/说明) mode toggle — 2-card selector
 * - 添加好友后是否默认分享旗帜 (share-after-add toggle)
 * - 夜间模式 toggle
 * - Other preferences
 * - MUST click "保存" to apply — changes are local until saved
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore, UIMode } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Mode Card ────────────────────────────────────────────────────────────────
function ModeCard({
  mode, selected, onSelect,
}: { mode: UIMode; selected: boolean; onSelect: () => void }) {
  const isGuided = mode === 'guided';
  return (
    <TouchableOpacity
      style={[styles.modeCard, selected && styles.modeCardSelected]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={styles.modeCardTop}>
        <Text style={styles.modeEmoji}>{isGuided ? '📖' : '⚡'}</Text>
        {selected && (
          <View style={styles.modeCheckBadge}>
            <Text style={styles.modeCheckText}>✓</Text>
          </View>
        )}
      </View>
      <Text style={styles.modeCardTitle}>{isGuided ? '说明模式' : '简易模式'}</Text>
      <Text style={styles.modeCardDesc}>
        {isGuided ? '操作说明 · 新手友好' : '图标优先 · 极简'}
      </Text>
    </TouchableOpacity>
  );
}

// ── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon, label, hint, value, onToggle, pending,
}: {
  icon: string; label: string; hint?: string;
  value: boolean; onToggle: () => void; pending?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, pending && styles.toggleRowPending]}>
      <View style={styles.toggleIconWrap}>
        <Text style={styles.toggleIcon}>{icon}</Text>
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { uiMode, setUIMode } = useAppStore();

  // Pending (draft) state — not applied until Save is pressed
  const [pendingMode, setPendingMode] = useState<UIMode>(uiMode);
  const [shareAfterAdd, setShareAfterAdd] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [locationShare, setLocationShare] = useState(false);

  const hasChanges = pendingMode !== uiMode
    || shareAfterAdd !== true  // vs. initial values (simplified for mock)
    || nightMode !== false;

  const handleSave = () => {
    setUIMode(pendingMode);
    Alert.alert('', '设置已保存', [{ text: '好的' }]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top nav bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>设置</Text>
        <TouchableOpacity
          style={[styles.saveBtn, hasChanges && styles.saveBtnActive]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, hasChanges && styles.saveBtnTextActive]}>保存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Interface Mode ── */}
        <SectionHeader title="界面模式" />
        <Text style={styles.sectionNote}>选择你偏好的操作界面风格</Text>
        <View style={styles.modeRow}>
          <ModeCard mode="guided" selected={pendingMode === 'guided'} onSelect={() => setPendingMode('guided')} />
          <ModeCard mode="simple" selected={pendingMode === 'simple'} onSelect={() => setPendingMode('simple')} />
        </View>
        {pendingMode !== uiMode && (
          <View style={styles.pendingHint}>
            <Text style={styles.pendingHintText}>⬆ 点击"保存"后生效</Text>
          </View>
        )}

        {/* ── Sharing ── */}
        <SectionHeader title="分享设置" />
        <View style={styles.card}>
          <ToggleRow
            icon="🏳️"
            label="添加好友后默认分享旗帜"
            hint="新好友可以自动看到你的公开旗帜"
            value={shareAfterAdd}
            onToggle={() => setShareAfterAdd(!shareAfterAdd)}
            pending={shareAfterAdd !== true}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="📍"
            label="位置实时共享"
            hint="让好友看到你当前的实时位置"
            value={locationShare}
            onToggle={() => setLocationShare(!locationShare)}
            pending={locationShare !== false}
          />
        </View>

        {/* ── Display ── */}
        <SectionHeader title="显示" />
        <View style={styles.card}>
          <ToggleRow
            icon="🌙"
            label="夜间模式"
            hint="深色界面，减少夜间用眼疲劳"
            value={nightMode}
            onToggle={() => setNightMode(!nightMode)}
            pending={nightMode !== false}
          />
        </View>

        {/* ── Audio ── */}
        <SectionHeader title="语音播报" />
        <View style={styles.card}>
          <ToggleRow
            icon="🔊"
            label="路线播报"
            hint="跑步/徒步时播报距离和偏离提醒"
            value={broadcastEnabled}
            onToggle={() => setBroadcastEnabled(!broadcastEnabled)}
            pending={broadcastEnabled !== true}
          />
        </View>

        {/* ── Account ── */}
        <SectionHeader title="账号" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={() => Alert.alert('个人信息', '即将开放')}>
            <View style={styles.toggleIconWrap}><Text style={styles.toggleIcon}>👤</Text></View>
            <Text style={styles.actionLabel}>个人信息</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('退出登录', '确认退出账号？', [
              { text: '取消', style: 'cancel' },
              { text: '退出', style: 'destructive' },
            ])}
          >
            <View style={styles.toggleIconWrap}><Text style={styles.toggleIcon}>🚪</Text></View>
            <Text style={[styles.actionLabel, { color: Colors.danger }]}>退出登录</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Save button (bottom) */}
        <TouchableOpacity
          style={[styles.saveBtnBottom, hasChanges && styles.saveBtnBottomActive]}
          onPress={handleSave}
          activeOpacity={hasChanges ? 0.8 : 1}
        >
          <Text style={styles.saveBtnBottomText}>保存设置</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Cairn v0.1.0</Text>
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
  saveBtn: { backgroundColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  saveBtnActive: { backgroundColor: Colors.primary },
  saveBtnText: { fontSize: FontSize.small, fontWeight: '700', color: Colors.textMuted },
  saveBtnTextActive: { color: '#fff' },

  scroll: { paddingBottom: Spacing.xxl },

  sectionHeader: {
    fontSize: FontSize.small, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: Spacing.base, marginTop: Spacing.xl, marginBottom: 4,
  },
  sectionNote: {
    fontSize: FontSize.small, color: Colors.textMuted,
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.base,
    borderRadius: Radius.card, ...Shadow.card, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },

  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.base },
  modeCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 2, borderColor: Colors.border, ...Shadow.card,
  },
  modeCardSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(93,124,70,0.05)' },
  modeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  modeEmoji: { fontSize: 22 },
  modeCheckBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  modeCheckText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  modeCardTitle: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  modeCardDesc: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },

  pendingHint: {
    marginHorizontal: Spacing.base, marginTop: Spacing.xs,
    backgroundColor: 'rgba(93,124,70,0.1)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 4, alignSelf: 'flex-start',
  },
  pendingHintText: { fontSize: FontSize.small, color: Colors.primary, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    minHeight: 56,
  },
  toggleRowPending: { backgroundColor: 'rgba(93,124,70,0.03)' },
  toggleIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  toggleIcon: { fontSize: 16 },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
  toggleHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  actionLabel: { flex: 1, fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary, marginLeft: 0 },
  chevron: { fontSize: 20, color: Colors.textMuted },

  saveBtnBottom: {
    marginHorizontal: Spacing.base, marginTop: Spacing.xl,
    backgroundColor: Colors.border, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  saveBtnBottomActive: { backgroundColor: Colors.primary },
  saveBtnBottomText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },

  version: {
    textAlign: 'center', fontSize: FontSize.small, color: Colors.textMuted,
    marginTop: Spacing.lg, marginBottom: Spacing.base,
  },
});
