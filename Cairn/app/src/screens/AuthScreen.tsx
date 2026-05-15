/**
 * AuthScreen — design.jpg page 1 "Login页"
 *
 * - Animated Cairn stone stack logo (stones drop in one by one)
 * - Email + password login
 * - Google / Apple quick login
 * - Privacy policy checkbox (must tick before proceeding)
 * - Expandable privacy terms
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Animated Cairn Stack ───────────────────────────────────────────────────────
const STONES = [
  { width: 44, color: Colors.primary },
  { width: 58, color: '#7a9e5a' },
  { width: 36, color: Colors.primary },
  { width: 50, color: '#7a9e5a' },
  { width: 62, color: '#4a6b38' },
];

function AnimatedCairn() {
  const anims = useRef(STONES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const sequence = STONES.map((_, i) =>
      Animated.spring(anims[i], {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: i * 120,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, sequence).start();
  }, []);

  return (
    <View style={cairnStyles.container}>
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
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
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
  container: { alignItems: 'center', gap: 3 },
  stone: { height: 10, borderRadius: 5 },
});

// ── Auth Screen ────────────────────────────────────────────────────────────────
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

  const handleAuth = () => {
    if (!privacyChecked) {
      Alert.alert('请先同意隐私政策');
      return;
    }
    setLoggedIn(true);
    setUIMode('guided'); // new users default to guided
    nav.replace('Home');
  };

  // ── Splash ──────────────────────────────────────────────────────────────────
  if (view === 'splash') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.splashInner}>
          <View style={styles.logoArea}>
            <AnimatedCairn />
            <Text style={styles.appName}>Cairn</Text>
            <Text style={styles.tagline}>Leave a mark.{'\n'}Guide the next.</Text>
          </View>
          <View style={styles.splashActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('register')}>
              <Text style={styles.primaryBtnText}>创建账号</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setView('login')}>
              <Text style={styles.secondaryBtnText}>已有账号，登录</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Login / Register (shared layout) ───────────────────────────────────────
  const isRegister = view === 'register';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('splash')}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </TouchableOpacity>

          {/* Logo mini */}
          <View style={styles.miniLogo}>
            <AnimatedCairn />
          </View>

          <Text style={styles.formTitle}>{isRegister ? '创建账号' : '登录'}</Text>
          {isRegister && (
            <Text style={styles.formSub}>注册后默认开启说明模式，随时可在设置中切换</Text>
          )}

          {/* Fields */}
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder={isRegister ? '你的邮箱，用于找回账号' : 'your@email.com'}
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            placeholder={isRegister ? '至少8位，字母+数字' : '••••••••'}
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {isRegister && (
            <>
              <Text style={styles.label}>确认密码</Text>
              <TextInput
                style={styles.input}
                placeholder="再次输入密码"
                placeholderTextColor={Colors.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </>
          )}

          {/* Privacy checkbox */}
          <TouchableOpacity
            style={styles.privacyRow}
            onPress={() => setPrivacyChecked(!privacyChecked)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, privacyChecked && styles.checkboxChecked]}>
              {privacyChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.privacyText}>
              我已阅读并同意{' '}
              <Text
                style={styles.privacyLink}
                onPress={() => setPrivacyExpanded(!privacyExpanded)}
              >
                隐私政策
              </Text>
            </Text>
          </TouchableOpacity>

          {privacyExpanded && (
            <View style={styles.privacyExpanded}>
              <Text style={styles.privacyContent}>
                Cairn仅收集你的位置数据用于路线追踪功能。我们不向第三方出售数据，不做任何社交推荐。你可随时删除账号和数据。位置数据仅在你主动开启追踪时收集，后台不追踪。
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: Spacing.lg }, !privacyChecked && styles.primaryBtnDisabled]}
            onPress={handleAuth}
            activeOpacity={privacyChecked ? 0.8 : 1}
          >
            <Text style={styles.primaryBtnText}>{isRegister ? '创建账号' : '登录'}</Text>
          </TouchableOpacity>

          {/* OAuth divider */}
          <View style={styles.oauthDivider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>或</Text>
            <View style={styles.divLine} />
          </View>

          <TouchableOpacity style={styles.oauthBtn} onPress={handleAuth}>
            <Text style={styles.oauthBtnText}>🍎  Apple 登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.oauthBtn} onPress={handleAuth}>
            <Text style={styles.oauthBtnText}>🔵  Google 登录</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Splash
  splashInner: { flex: 1, justifyContent: 'space-between', padding: Spacing.xl, paddingBottom: Spacing.xxl },
  logoArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  appName: { fontSize: 44, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -2, marginTop: Spacing.md },
  tagline: { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  splashActions: { gap: Spacing.sm },

  // Form
  form: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  backBtn: { marginBottom: Spacing.lg },
  backBtnText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  miniLogo: { alignItems: 'center', marginBottom: Spacing.lg },
  formTitle: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  formSub: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 20 },
  label: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.button,
    padding: Spacing.md,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  // Privacy
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.base },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  privacyText: { flex: 1, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 20 },
  privacyLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  privacyExpanded: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.button,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyContent: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 18 },

  // Buttons
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  secondaryBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.body },

  // OAuth
  oauthDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.base },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: FontSize.caption, color: Colors.textMuted },
  oauthBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  oauthBtnText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
});
