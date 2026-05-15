/**
 * AuthScreen — Sprint 9 redesign
 *
 * - Animated Cairn stone stack logo (springs in on mount)
 * - Splash: entrance fade + scale, primary/secondary buttons with spring press
 * - Login/Register: SVG icons (ChevronLeft back, Mail email, KeyRound pw, Eye toggle, LogIn/UserPlus submit)
 * - OAuth buttons: clean text, no emoji
 * - Privacy checkbox: Check SVG instead of text glyph
 * - All interactive elements have spring press animations
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Animated Cairn Stack ───────────────────────────────────────────────────
const STONES = [
  { width: 44, color: Colors.primary },
  { width: 58, color: '#7a9e5a' },
  { width: 36, color: Colors.primary },
  { width: 50, color: '#7a9e5a' },
  { width: 62, color: '#4a6b38' },
];

function AnimatedCairn({ size = 1 }: { size?: number }) {
  const anims = useRef(STONES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(90, STONES.map((_, i) =>
      Animated.spring(anims[i], {
        toValue: 1, tension: 100, friction: 8,
        useNativeDriver: true,
      })
    )).start();
  }, []);

  return (
    <View style={[cairnStyles.container, { transform: [{ scale: size }] }]}>
      {STONES.slice().reverse().map((stone, ri) => {
        const i = STONES.length - 1 - ri;
        return (
          <Animated.View
            key={i}
            style={[
              cairnStyles.stone,
              {
                width: stone.width,
                backgroundColor: stone.color,
                opacity: anims[i],
                transform: [{
                  translateY: anims[i].interpolate({
                    inputRange: [0, 1], outputRange: [-20, 0],
                  }),
                }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const cairnStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  stone: { height: 11, borderRadius: 6 },
});

// ── Press-animated wrapper ─────────────────────────────────────────────────
function PressBtn({
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
    <Animated.View style={{ transform: [{ scale: anim }] }}>
      <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={style}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Password field with eye toggle ─────────────────────────────────────────
function PasswordInput({
  value, onChangeText, placeholder,
}: {
  value: string; onChangeText: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={formStyles.inputWrap}>
      <View style={formStyles.inputIcon}>
        <Icon name="KeyRound" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
      </View>
      <TextInput
        style={formStyles.inputInner}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
      />
      <TouchableOpacity style={formStyles.eyeBtn} onPress={() => setShow(v => !v)}>
        <Icon name={show ? 'EyeOff' : 'Eye'} size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
      </TouchableOpacity>
    </View>
  );
}

// ── Auth Screen ────────────────────────────────────────────────────────────
type AuthView = 'splash' | 'login' | 'register';

export function AuthScreen() {
  const nav = useNavigation<Nav>();
  const { setLoggedIn, setUIMode } = useAppStore();
  const [view, setView] = useState<AuthView>('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  // Splash entrance
  const splashFade = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.96)).current;
  useEffect(() => {
    if (view === 'splash') {
      Animated.parallel([
        Animated.timing(splashFade, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [view]);

  const handleAuth = () => {
    if (!privacyChecked) {
      Alert.alert('请先同意隐私政策');
      return;
    }
    setLoggedIn(true);
    setUIMode('guided');
    nav.replace('Home');
  };

  // ── Splash ─────────────────────────────────────────────────────────────
  if (view === 'splash') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View style={[styles.splashInner, { opacity: splashFade, transform: [{ scale: splashScale }] }]}>
          <View style={styles.logoArea}>
            <AnimatedCairn />
            <Text style={styles.appName}>Cairn</Text>
            <Text style={styles.tagline}>Leave a mark.{'\n'}Guide the next.</Text>
          </View>
          <View style={styles.splashActions}>
            <PressBtn style={styles.primaryBtn} onPress={() => setView('register')}>
              <View style={styles.btnContent}>
                <Icon name="UserPlus" size={IconSize.sm} color="#fff" strokeWidth={2} />
                <Text style={styles.primaryBtnText}>创建账号</Text>
              </View>
            </PressBtn>
            <PressBtn style={styles.secondaryBtn} onPress={() => setView('login')}>
              <View style={styles.btnContent}>
                <Icon name="LogIn" size={IconSize.sm} color={Colors.textPrimary} strokeWidth={2} />
                <Text style={styles.secondaryBtnText}>已有账号，登录</Text>
              </View>
            </PressBtn>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Login / Register ────────────────────────────────────────────────────
  const isRegister = view === 'register';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={formStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={formStyles.backBtn} onPress={() => setView('splash')}>
            <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
            <Text style={formStyles.backText}>返回</Text>
          </TouchableOpacity>

          {/* Mini cairn */}
          <View style={formStyles.miniLogo}>
            <AnimatedCairn size={0.85} />
          </View>

          <Text style={formStyles.title}>{isRegister ? '创建账号' : '登录'}</Text>
          {isRegister && (
            <Text style={formStyles.sub}>注册后默认开启说明模式，随时可在设置中切换</Text>
          )}

          {/* Email */}
          <Text style={formStyles.label}>邮箱</Text>
          <View style={formStyles.inputWrap}>
            <View style={formStyles.inputIcon}>
              <Icon name="Mail" size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
            </View>
            <TextInput
              style={formStyles.inputInner}
              placeholder={isRegister ? '你的邮箱，用于找回账号' : 'your@email.com'}
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={formStyles.label}>密码</Text>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? '至少8位，字母+数字' : '••••••••'}
          />

          {/* Confirm password */}
          {isRegister && (
            <>
              <Text style={formStyles.label}>确认密码</Text>
              <PasswordInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="再次输入密码"
              />
            </>
          )}

          {/* Privacy checkbox */}
          <TouchableOpacity
            style={formStyles.privacyRow}
            onPress={() => setPrivacyChecked(!privacyChecked)}
            activeOpacity={0.7}
          >
            <View style={[formStyles.checkbox, privacyChecked && formStyles.checkboxChecked]}>
              {privacyChecked && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={formStyles.privacyText}>
              我已阅读并同意{' '}
              <Text style={formStyles.privacyLink} onPress={() => setPrivacyExpanded(!privacyExpanded)}>
                隐私政策
              </Text>
            </Text>
          </TouchableOpacity>

          {privacyExpanded && (
            <View style={formStyles.privacyExpanded}>
              <Text style={formStyles.privacyContent}>
                Cairn仅收集你的位置数据用于路线追踪功能。我们不向第三方出售数据，不做任何社交推荐。你可随时删除账号和数据。位置数据仅在你主动开启追踪时收集，后台不追踪。
              </Text>
            </View>
          )}

          {/* Submit */}
          <PressBtn
            style={[styles.primaryBtn, formStyles.submitBtn, !privacyChecked && formStyles.submitDisabled]}
            onPress={handleAuth}
          >
            <View style={styles.btnContent}>
              <Icon name={isRegister ? 'UserPlus' : 'LogIn'} size={IconSize.sm} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>{isRegister ? '创建账号' : '登录'}</Text>
            </View>
          </PressBtn>

          {/* OAuth divider */}
          <View style={formStyles.divider}>
            <View style={formStyles.divLine} />
            <Text style={formStyles.divText}>或</Text>
            <View style={formStyles.divLine} />
          </View>

          {/* OAuth buttons — clean text, no emoji */}
          <PressBtn style={formStyles.oauthBtn} onPress={handleAuth} scale={0.98}>
            <Text style={formStyles.oauthBtnText}>Apple 登录</Text>
          </PressBtn>
          <PressBtn style={formStyles.oauthBtn} onPress={handleAuth} scale={0.98}>
            <Text style={formStyles.oauthBtnText}>Google 登录</Text>
          </PressBtn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  splashInner: {
    flex: 1, justifyContent: 'space-between',
    padding: Spacing.xl, paddingBottom: Spacing.xxl,
  },
  logoArea: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: Spacing.md,
  },
  appName: {
    fontSize: 52, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: -2.5, marginTop: Spacing.md,
  },
  tagline: {
    fontSize: FontSize.body, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
  splashActions: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  secondaryBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.body },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});

const formStyles = StyleSheet.create({
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    alignSelf: 'flex-start', marginBottom: Spacing.lg,
  },
  backText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  miniLogo: { alignItems: 'center', marginBottom: Spacing.lg },
  title: {
    fontSize: FontSize.h1, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: 4,
  },
  sub: {
    fontSize: FontSize.caption, color: Colors.textSecondary,
    marginBottom: Spacing.xl, lineHeight: 20,
  },
  label: {
    fontSize: FontSize.caption, fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: Spacing.xs },
  inputInner: {
    flex: 1, paddingVertical: Spacing.md,
    fontSize: FontSize.body, color: Colors.textPrimary,
  },
  eyeBtn: { padding: Spacing.xs },

  privacyRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginTop: Spacing.base,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  privacyText: { flex: 1, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 20 },
  privacyLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  privacyExpanded: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    padding: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  privacyContent: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 18 },

  submitBtn: { marginTop: Spacing.lg },
  submitDisabled: { opacity: 0.45 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, marginVertical: Spacing.base,
  },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: FontSize.caption, color: Colors.textMuted },

  oauthBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center',
    marginBottom: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border,
  },
  oauthBtnText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
});
