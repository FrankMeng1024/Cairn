/**
 * SettingsScreen — Sprint 26 premium redesign
 *
 * - Mode cards: LinearGradient icon badges (40×40), h3/600 title, CircleCheck badge
 * - Section headers: tiny/uppercase/muted (unchanged)
 * - Toggle rows: 32×32 icon badge with tint bg (unchanged)
 * - Save button: hidden until dirty, shimmer animation (unchanged)
 * - Sprint 12 SVG icons retained
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore, UIMode } from '../store/useAppStore';
import { logout } from '../services/authService';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { BackButton } from '../components/BackButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Spring press wrapper ────────────────────────────────────────────────────
function PressCard({
  onPress, style, children, scale = 0.97,
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

// ── Mode Card ────────────────────────────────────────────────────────────────
const MODE_META: Record<UIMode, {
  icon: IconName; iconColor: string;
  gradientStart: string; gradientEnd: string;
  title: string; desc: string;
}> = {
  beginner: {
    icon: 'Mountain',
    iconColor: Colors.primary,
    gradientStart: Colors.primaryLight,
    gradientEnd: Colors.primaryLight.replace('0.15', '0.28'),
    title: 'Explorer',
    desc: 'Simplified view · Guided prompts',
  },
  expert: {
    icon: 'Compass',
    iconColor: Colors.flag,
    gradientStart: Colors.flagLight,
    gradientEnd: Colors.flagLight.replace('0.12', '0.24'),
    title: 'Navigator',
    desc: 'Full data · Dense interface · Expert controls',
  },
};

function ModeCard({
  mode, selected, onSelect,
}: { mode: UIMode; selected: boolean; onSelect: () => void }) {
  const meta = MODE_META[mode];
  return (
    <PressCard onPress={onSelect} style={{ flex: 1 }}>
      <View style={[modeStyles.card, selected && modeStyles.cardSelected]}>
        <View style={modeStyles.top}>
          <LinearGradient
            colors={[meta.gradientStart, meta.gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={modeStyles.iconWrap}
          >
            <Icon name={meta.icon} size={20} color={meta.iconColor} strokeWidth={1.8} />
          </LinearGradient>
          {selected && (
            <View style={modeStyles.checkBadge}>
              <Icon name="CircleCheck" size={18} color={Colors.primary} strokeWidth={2} />
            </View>
          )}
        </View>
        <Text style={modeStyles.title}>{meta.title}</Text>
        <Text style={modeStyles.desc}>{meta.desc}</Text>
      </View>
    </PressCard>
  );
}

// ── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({
  iconName, iconColor, iconBg, label, hint, value, onToggle, pending,
}: {
  iconName: IconName; iconColor: string; iconBg: string;
  label: string; hint?: string;
  value: boolean; onToggle: () => void; pending?: boolean;
}) {
  return (
    <View style={[rowStyles.row, pending && rowStyles.rowPending]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={iconName} size={16} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={rowStyles.content}>
        <Text style={rowStyles.label}>{label}</Text>
        {hint ? <Text style={rowStyles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.switchTrack, true: Colors.primary }}
        thumbColor={Colors.surface}
      />
    </View>
  );
}

// ── Action Row ───────────────────────────────────────────────────────────────
function ActionRow({
  iconName, iconColor, iconBg, label, labelColor, onPress,
}: {
  iconName: IconName; iconColor: string; iconBg: string;
  label: string; labelColor?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={rowStyles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={iconName} size={16} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text style={[rowStyles.actionLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <Icon name="ChevronRight" size={IconSize.sm} color={Colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { uiMode, setUIMode, user, isLoggedIn, logout: appLogout } = useAppStore();

  const [pendingMode, setPendingMode] = useState<UIMode>(uiMode);
  const [shareAfterAdd, setShareAfterAdd] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [locationShare, setLocationShare] = useState(false);

  const hasChanges = pendingMode !== uiMode
    || shareAfterAdd !== true
    || nightMode !== false;

  // Hint fade animation — fades in (200ms) when hasChanges, out when not
  const hintOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(hintOpacity, {
      toValue: hasChanges ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [hasChanges]);

  // Shimmer animation — active only when hasChanges
  const shimmerX = useRef(new Animated.Value(-200)).current;
  useEffect(() => {
    if (!hasChanges) {
      shimmerX.setValue(-200);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shimmerX, { toValue: 300, duration: 2000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [hasChanges]);

  const handleSave = () => {
    setUIMode(pendingMode);
    Alert.alert('', 'Settings saved', [{ text: 'OK' }]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <BackButton variant="inline" />
        <Text style={styles.topTitle}>Settings</Text>
        <TouchableOpacity
          style={[styles.saveBtn, hasChanges && styles.saveBtnActive]}
          onPress={handleSave}
        >
          <Icon name="Save" size={14} color={hasChanges ? '#fff' : Colors.textMuted} strokeWidth={2} />
          <Text style={[styles.saveBtnText, hasChanges && styles.saveBtnTextActive]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Interface Mode ── */}
        <SectionHeader title="Interface Mode" />
        <Text style={styles.sectionNote}>Choose your preferred UI style</Text>
        <View style={styles.modeRow}>
          <ModeCard mode="beginner" selected={pendingMode === 'beginner'} onSelect={() => setPendingMode('beginner')} />
          <ModeCard mode="expert" selected={pendingMode === 'expert'} onSelect={() => setPendingMode('expert')} />
        </View>
        <Animated.View style={[styles.pendingHint, { opacity: hintOpacity }]} pointerEvents="none">
          <Icon name="ArrowUp" size={12} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.pendingHintText}>Tap "Save" to apply</Text>
        </Animated.View>

        {/* ── Sharing ── */}
        <SectionHeader title="Sharing" />
        <View style={styles.card}>
          <ToggleRow
            iconName="Flag"
            iconColor={Colors.primary}
            iconBg={Colors.primaryLight}
            label="Share flags with new friends by default"
            hint="New friends automatically see your public flags"
            value={shareAfterAdd}
            onToggle={() => setShareAfterAdd(!shareAfterAdd)}
            pending={shareAfterAdd !== true}
          />
          <View style={styles.divider} />
          <ToggleRow
            iconName="MapPin"
            iconColor={Colors.info}
            iconBg={Colors.infoBg}
            label="Live location sharing"
            hint="Let friends see your current location in real time"
            value={locationShare}
            onToggle={() => setLocationShare(!locationShare)}
            pending={locationShare !== false}
          />
        </View>

        {/* ── Display ── */}
        <SectionHeader title="Display" />
        <View style={styles.card}>
          <ToggleRow
            iconName="Moon"
            iconColor={Colors.night}
            iconBg="rgba(90,79,207,0.1)"
            label="Night mode"
            hint="Dark theme, easier on the eyes at night"
            value={nightMode}
            onToggle={() => setNightMode(!nightMode)}
            pending={nightMode !== false}
          />
        </View>

        {/* ── Audio ── */}
        <SectionHeader title="Voice Guidance" />
        <View style={styles.card}>
          <ToggleRow
            iconName="Volume2"
            iconColor={Colors.success}
            iconBg={Colors.successBg}
            label="Route announcements"
            hint="Announce distance and off-route warnings while active"
            value={broadcastEnabled}
            onToggle={() => setBroadcastEnabled(!broadcastEnabled)}
            pending={broadcastEnabled !== true}
          />
        </View>

        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          {isLoggedIn && user ? (
            <>
              {/* Profile row — real name + email */}
              <View style={rowStyles.actionRow}>
                <View style={profileStyles.initialsCircle}>
                  <Text style={profileStyles.initialsText}>
                    {user.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={{ fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary }}>{user.name}</Text>
                  <Text style={{ fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 1 }}>{user.email}</Text>
                </View>
              </View>
              <View style={styles.divider} />
            </>
          ) : (
            <>
              {/* Not logged in CTA */}
              <TouchableOpacity style={rowStyles.actionRow} onPress={() => nav.replace('Auth')} activeOpacity={0.7}>
                <View style={[rowStyles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
                  <Icon name="User" size={16} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary }}>Sign in to save your data</Text>
                  <Text style={{ fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 1 }}>Your sessions will sync across devices</Text>
                </View>
                <Icon name="ChevronRight" size={IconSize.sm} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          )}
          <ActionRow
            iconName="LogOut"
            iconColor={Colors.danger}
            iconBg={Colors.dangerBg}
            label="Sign Out"
            labelColor={Colors.danger}
            onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out', style: 'destructive', onPress: async () => {
                  await logout();
                  appLogout();
                  nav.replace('Auth');
                },
              },
            ])}
          />
        </View>

        {/* Save button (bottom) with shimmer when active */}
        <TouchableOpacity
          style={[styles.saveBtnBottom, hasChanges && styles.saveBtnBottomActive]}
          onPress={handleSave}
          activeOpacity={hasChanges ? 0.8 : 1}
        >
          <Icon name="Save" size={IconSize.sm} color={hasChanges ? '#fff' : Colors.textMuted} strokeWidth={2} />
          <Text style={[styles.saveBtnBottomText, !hasChanges && { color: Colors.textMuted }]}>Save Settings</Text>
          {hasChanges && (
            <Animated.View
              style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerX }] }]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 100, height: '100%' }}
              />
            </Animated.View>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>Cairn v0.1.0</Text>
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
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.border, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  saveBtnActive: { backgroundColor: Colors.primary },
  saveBtnText: { fontSize: FontSize.small, fontWeight: '700', color: Colors.textMuted },
  saveBtnTextActive: { color: '#fff' },

  scroll: { paddingBottom: Spacing.xxl },

  sectionHeader: {
    fontSize: FontSize.small, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
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

  pendingHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginHorizontal: Spacing.base, marginTop: Spacing.xs,
    backgroundColor: 'rgba(93,124,70,0.1)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 4, alignSelf: 'flex-start',
  },
  pendingHintText: { fontSize: FontSize.small, color: Colors.primary, fontWeight: '600' },

  saveBtnBottom: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center',
    marginHorizontal: Spacing.base, marginTop: Spacing.xl,
    backgroundColor: Colors.border, borderRadius: Radius.button,
    paddingVertical: Spacing.md, overflow: 'hidden',
  },
  saveBtnBottomActive: { backgroundColor: Colors.primary },
  saveBtnBottomText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  shimmerOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
  },

  version: {
    textAlign: 'center', fontSize: FontSize.small, color: Colors.textMuted,
    marginTop: Spacing.lg, marginBottom: Spacing.base,
  },
});

const modeStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  cardSelected: {
    borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primaryBg,
    ...Shadow.card,
  },
  top: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBadge: {
    // Uses Icon name="CircleCheck" directly — no wrapper needed
  },
  title: { fontSize: FontSize.h3, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  desc: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 18 },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    minHeight: 54,
  },
  rowPending: { backgroundColor: 'rgba(93,124,70,0.03)' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: { flex: 1 },
  label: { fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
  hint: { fontSize: FontSize.small, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    minHeight: 54,
  },
  actionLabel: { flex: 1, fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
});

const profileStyles = StyleSheet.create({
  initialsCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md, flexShrink: 0,
  },
  initialsText: {
    fontSize: FontSize.body, fontWeight: '700', color: Colors.primary,
  },
});
