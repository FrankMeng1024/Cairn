import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, UIMode } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

// ── Mode Preview Card ─────────────────────────────────────────────────────────
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
      {selected && (
        <View style={styles.modeCardBadge}>
          <Text style={styles.modeCardBadgeText}>✓ 当前</Text>
        </View>
      )}
      <Text style={styles.modeCardTitle}>
        {isGuided ? '说明模式' : '简易模式'}
      </Text>
      <Text style={styles.modeCardSubtitle}>
        {isGuided ? '适合新用户，每个操作有说明' : '极简操作，图标优先'}
      </Text>

      {/* Preview mockup */}
      <View style={styles.modePreview}>
        {isGuided ? (
          <>
            <View style={styles.previewBtn}>
              <Text style={styles.previewBtnIcon}>📍</Text>
              <View>
                <Text style={styles.previewBtnLabel}>标记</Text>
                <Text style={styles.previewBtnHint}>在此处插一面旗</Text>
              </View>
            </View>
            <View style={styles.previewBtn}>
              <Text style={styles.previewBtnIcon}>🗺️</Text>
              <View>
                <Text style={styles.previewBtnLabel}>地图</Text>
                <Text style={styles.previewBtnHint}>查看离线步道地图</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.previewSimpleRow}>
            <View style={styles.previewSimpleIcon}><Text style={{ fontSize: 22 }}>📍</Text></View>
            <View style={styles.previewSimpleIcon}><Text style={{ fontSize: 22 }}>🗺️</Text></View>
            <View style={styles.previewSimpleIcon}><Text style={{ fontSize: 22 }}>👥</Text></View>
            <View style={styles.previewSimpleIcon}><Text style={{ fontSize: 22 }}>⚙️</Text></View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({
  icon, label, hint, value, onPress, rightElement, isGuided,
}: {
  icon: string; label: string; hint?: string; value?: string;
  onPress?: () => void; rightElement?: React.ReactNode; isGuided: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingIconWrap}>
        <Text style={styles.settingIcon}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {isGuided && hint ? <Text style={styles.settingHint}>{hint}</Text> : null}
      </View>
      {rightElement ?? (
        <View style={styles.settingRight}>
          {value ? <Text style={styles.settingValue}>{value}</Text> : null}
          <Text style={styles.settingChevron}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main Settings Screen ──────────────────────────────────────────────────────
export function SettingsScreen() {
  const { uiMode, setUIMode, activityMode, setActivityMode } = useAppStore();
  const isGuided = uiMode === 'guided';

  const [broadcastDensity, setBroadcastDensity] = useState<'always' | 'key' | 'off'>('key');
  const [defaultPermission, setDefaultPermission] = useState<'personal' | 'group' | 'public'>('personal');

  const handleModeSwitch = (mode: UIMode) => {
    setUIMode(mode);
    Alert.alert('', `已切换到${mode === 'guided' ? '说明' : '简易'}模式`, [{ text: '好的' }]);
  };

  const densityLabel = { always: '始终播报', key: '仅关键', off: '静音' }[broadcastDensity];
  const permLabel = { personal: '仅自己', group: '好友组', public: '公开' }[defaultPermission];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>设置</Text>
          {isGuided && (
            <Text style={styles.headerSubtitle}>在这里自定义你的Cairn体验</Text>
          )}
        </View>

        {/* ── UI Mode section ── */}
        <SectionHeader title="界面模式" />
        <View style={styles.modeCardRow}>
          <ModeCard mode="guided" selected={uiMode === 'guided'} onSelect={() => handleModeSwitch('guided')} />
          <ModeCard mode="simple" selected={uiMode === 'simple'} onSelect={() => handleModeSwitch('simple')} />
        </View>

        {/* ── Activity ── */}
        <SectionHeader title="运动偏好" />
        <View style={styles.card}>
          <SettingRow
            icon="🥾" label="徒步模式"
            hint={isGuided ? "地图交互为主，标记可见" : undefined}
            isGuided={isGuided}
            rightElement={
              <Switch
                value={activityMode === 'hiking'}
                onValueChange={() => setActivityMode('hiking')}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={activityMode === 'hiking' ? Colors.primary : Colors.textMuted}
              />
            }
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🏃" label="跑步模式"
            hint={isGuided ? "语音为主，屏幕可关闭" : undefined}
            isGuided={isGuided}
            rightElement={
              <Switch
                value={activityMode === 'running'}
                onValueChange={() => setActivityMode('running')}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={activityMode === 'running' ? Colors.primary : Colors.textMuted}
              />
            }
          />
        </View>

        {/* ── Broadcast ── */}
        <SectionHeader title="语音播报" />
        <View style={styles.card}>
          <SettingRow
            icon="🔊" label="播报密度" value={densityLabel}
            hint={isGuided ? "控制路线偏离和标记提醒的频率" : undefined}
            isGuided={isGuided}
            onPress={() => {
              const next = { always: 'key', key: 'off', off: 'always' } as const;
              setBroadcastDensity(next[broadcastDensity]);
            }}
          />
        </View>

        {/* ── Privacy ── */}
        <SectionHeader title="隐私" />
        <View style={styles.card}>
          <SettingRow
            icon="🔒" label="标记默认权限" value={permLabel}
            hint={isGuided ? "新建标记时的默认可见范围" : undefined}
            isGuided={isGuided}
            onPress={() => {
              const next = { personal: 'group', group: 'public', public: 'personal' } as const;
              setDefaultPermission(next[defaultPermission]);
            }}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="📍" label="位置共享" value="仅自己"
            hint={isGuided ? "好友是否可以看到你的实时位置（默认关闭）" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('位置共享', '即将开放')}
          />
        </View>

        {/* ── Map ── */}
        <SectionHeader title="地图" />
        <View style={styles.card}>
          <SettingRow
            icon="📦" label="离线地图包" value="0 MB"
            hint={isGuided ? "预下载步道地图，无网络也可导航" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('离线地图', '请先完成EAS Build配置')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🗑️" label="清除地图缓存" value="12 MB"
            hint={isGuided ? "删除临时地图数据以释放存储空间" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('确认清除', '将删除所有临时地图缓存')}
          />
        </View>

        {/* ── Account ── */}
        <SectionHeader title="账号" />
        <View style={styles.card}>
          <SettingRow
            icon="👤" label="个人信息"
            hint={isGuided ? "修改显示名称和头像" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('个人信息', '即将开放')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="👥" label="好友管理"
            hint={isGuided ? "查看、添加或移除好友" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('好友管理', '请在好友页操作')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🚪" label="退出登录"
            hint={isGuided ? "退出后需重新登录" : undefined}
            isGuided={isGuided}
            onPress={() => Alert.alert('退出登录', '确认退出？', [
              { text: '取消', style: 'cancel' },
              { text: '退出', style: 'destructive' },
            ])}
          />
        </View>

        {/* Version */}
        <Text style={styles.version}>Cairn v0.1.0 (Sprint 2 UI Preview)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 4 },

  sectionHeader: {
    fontSize: FontSize.small, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: Spacing.base, marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.base,
    borderRadius: Radius.card, ...Shadow.card,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },

  modeCardRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.base },
  modeCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 2, borderColor: Colors.border, ...Shadow.card,
  },
  modeCardSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(93,124,70,0.04)' },
  modeCardBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  modeCardBadgeText: { fontSize: FontSize.tiny, color: '#fff', fontWeight: '700' },
  modeCardTitle: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  modeCardSubtitle: { fontSize: 10, color: Colors.textSecondary, marginBottom: Spacing.sm },
  modePreview: { backgroundColor: Colors.bg, borderRadius: 8, padding: 8, gap: 6 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 8, padding: 6,
  },
  previewBtnIcon: { fontSize: 16 },
  previewBtnLabel: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  previewBtnHint: { fontSize: 9, color: Colors.textSecondary },
  previewSimpleRow: { flexDirection: 'row', justifyContent: 'space-around' },
  previewSimpleIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    minHeight: 52,
  },
  settingIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingIcon: { fontSize: 16 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
  settingHint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2 },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingValue: { fontSize: FontSize.caption, color: Colors.textSecondary },
  settingChevron: { fontSize: 20, color: Colors.textMuted, marginLeft: 2 },

  version: {
    textAlign: 'center', fontSize: FontSize.small, color: Colors.textMuted,
    marginTop: Spacing.xl,
  },
});
