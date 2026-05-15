/**
 * AuthScreen — Sprint 21 premium redesign (STORY-00051)
 *
 * - Cairn logo glow pulse after stack animation
 * - Premium pill entry buttons (minHeight 52, borderRadius 28)
 * - Name field visible in registration
 * - Privacy row: checkbox + "I agree to the" text + tappable underlined "Privacy Policy" link (independent targets)
 * - Inline field validation (red text under each invalid field)
 * - Branded social login buttons (Apple=black, Google=white+border)
 * - `setUIMode('beginner')` on register (not 'guided')
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, ScrollView,
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
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Step 1: stack stones appear with spring stagger
    Animated.stagger(90, STONES.map((_, i) =>
      Animated.spring(anims[i], { toValue: 1, tension: 100, friction: 8, useNativeDriver: true })
    )).start(() => {
      // Step 2: after stack completes, pulse glow once then hold at full opacity
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.7, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  return (
    <Animated.View style={[cairnStyles.container, { opacity: glow, transform: [{ scale: size }] }]}>
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
                transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const cairnStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  stone: { height: 11, borderRadius: 6 },
});

// ── Press-animated wrapper ─────────────────────────────────────────────────
function PressBtn({ onPress, style, children, scale = 0.97 }: {
  onPress: () => void; style?: object | object[]; children: React.ReactNode; scale?: number;
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
function PasswordInput({ value, onChangeText, placeholder, error, onBlur }: {
  value: string; onChangeText: (v: string) => void; placeholder: string;
  error?: string; onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <>
      <View style={[formStyles.inputWrap, !!error && formStyles.inputError]}>
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
          onBlur={onBlur}
        />
        <TouchableOpacity style={formStyles.eyeBtn} onPress={() => setShow(v => !v)}>
          <Icon name={show ? 'EyeOff' : 'Eye'} size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={formStyles.fieldError}>{error}</Text>}
    </>
  );
}

// ── Inline text input with error ───────────────────────────────────────────
function FieldInput({ icon, placeholder, value, onChangeText, error, onBlur, keyboardType, autoCapitalize }: {
  icon: string; placeholder: string; value: string; onChangeText: (v: string) => void;
  error?: string; onBlur?: () => void; keyboardType?: any; autoCapitalize?: any;
}) {
  return (
    <>
      <View style={[formStyles.inputWrap, !!error && formStyles.inputError]}>
        <View style={formStyles.inputIcon}>
          <Icon name={icon as any} size={IconSize.sm} color={Colors.textMuted} strokeWidth={1.8} />
        </View>
        <TextInput
          style={formStyles.inputInner}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          onBlur={onBlur}
        />
      </View>
      {!!error && <Text style={formStyles.fieldError}>{error}</Text>}
    </>
  );
}

// ── Auth Screen ────────────────────────────────────────────────────────────
type AuthView = 'splash' | 'login' | 'register';

export function AuthScreen() {
  const nav = useNavigation<Nav>();
  const { setLoggedIn, setUIMode } = useAppStore();
  const [view, setView] = useState<AuthView>('splash');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [privacyError, setPrivacyError] = useState('');

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

  const resetErrors = () => {
    setNameError(''); setEmailError(''); setPasswordError(''); setConfirmError(''); setPrivacyError('');
  };

  const handleViewChange = (v: AuthView) => {
    resetErrors();
    setView(v);
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Please enter a valid email';
    return '';
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Password is required';
    if (val.length < 6) return 'Minimum 6 characters';
    return '';
  };

  const handleAuth = () => {
    const isRegister = view === 'register';
    let valid = true;

    if (isRegister && !name.trim()) { setNameError('Name is required'); valid = false; }
    const eErr = validateEmail(email); if (eErr) { setEmailError(eErr); valid = false; }
    const pErr = validatePassword(password); if (pErr) { setPasswordError(pErr); valid = false; }
    if (isRegister && password !== confirm) { setConfirmError('Passwords do not match'); valid = false; }
    if (!privacyChecked) { setPrivacyError('Please agree to continue'); valid = false; }

    if (!valid) return;

    setLoggedIn(true);
    if (isRegister) setUIMode('beginner');
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
            <PressBtn style={styles.primaryBtn} onPress={() => handleViewChange('register')}>
              <View style={styles.btnContent}>
                <Icon name="UserPlus" size={IconSize.sm} color="#fff" strokeWidth={2} />
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </View>
            </PressBtn>
            <PressBtn style={styles.secondaryBtn} onPress={() => handleViewChange('login')}>
              <View style={styles.btnContent}>
                <Icon name="LogIn" size={IconSize.sm} color={Colors.textPrimary} strokeWidth={2} />
                <Text style={styles.secondaryBtnText}>Sign In</Text>
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
        <ScrollView contentContainerStyle={formStyles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={formStyles.backBtn} onPress={() => handleViewChange('splash')}>
            <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
            <Text style={formStyles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={formStyles.miniLogo}>
            <AnimatedCairn size={0.85} />
          </View>

          <Text style={formStyles.title}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
          {isRegister && (
            <Text style={formStyles.sub}>You'll start in Explorer mode. Switch anytime in Settings.</Text>
          )}

          {/* Name field — register only */}
          {isRegister && (
            <>
              <Text style={formStyles.label}>Name</Text>
              <FieldInput
                icon="User"
                placeholder="Your name"
                value={name}
                onChangeText={(v) => { setName(v); if (nameError) setNameError(''); }}
                error={nameError}
                onBlur={() => { if (!name.trim()) setNameError('Name is required'); }}
              />
            </>
          )}

          <Text style={formStyles.label}>Email</Text>
          <FieldInput
            icon="Mail"
            placeholder="your@email.com"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(''); }}
            error={emailError}
            onBlur={() => setEmailError(validateEmail(email))}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={formStyles.label}>Password</Text>
          <PasswordInput
            value={password}
            onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
            placeholder={isRegister ? 'Min. 6 characters' : '••••••••'}
            error={passwordError}
            onBlur={() => setPasswordError(validatePassword(password))}
          />

          {isRegister && (
            <>
              <Text style={formStyles.label}>Confirm Password</Text>
              <PasswordInput
                value={confirm}
                onChangeText={(v) => { setConfirm(v); if (confirmError) setConfirmError(''); }}
                placeholder="Re-enter password"
                error={confirmError}
                onBlur={() => { if (confirm && confirm !== password) setConfirmError('Passwords do not match'); }}
              />
            </>
          )}

          {/* Privacy row — checkbox and link are independent targets */}
          <View style={formStyles.privacyRow}>
            <TouchableOpacity
              style={[formStyles.checkbox, privacyChecked && formStyles.checkboxChecked]}
              onPress={() => { setPrivacyChecked(v => !v); setPrivacyError(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              {privacyChecked && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
            </TouchableOpacity>
            <Text style={formStyles.privacyText}>
              {'I agree to the '}
              <Text
                style={formStyles.privacyLink}
                onPress={() => setPrivacyExpanded(!privacyExpanded)}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
          {!!privacyError && <Text style={formStyles.fieldError}>{privacyError}</Text>}

          {privacyExpanded && (
            <View style={formStyles.privacyExpanded}>
              <Text style={formStyles.privacyContent}>
                Cairn only collects location data for trail tracking. We never sell your data or make social recommendations. You can delete your account and data at any time. Location is only collected when you actively start tracking.
              </Text>
            </View>
          )}

          <PressBtn style={[styles.primaryBtn, formStyles.submitBtn]} onPress={handleAuth}>
            <View style={styles.btnContent}>
              <Icon name={isRegister ? 'UserPlus' : 'LogIn'} size={IconSize.sm} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
            </View>
          </PressBtn>

          <View style={formStyles.divider}>
            <View style={formStyles.divLine} />
            <Text style={formStyles.divText}>or</Text>
            <View style={formStyles.divLine} />
          </View>

          {/* Apple — black background, white text */}
          <PressBtn style={formStyles.appleBtn} onPress={handleAuth} scale={0.98}>
            <View style={styles.btnContent}>
              <Icon name="Apple" size={IconSize.sm} color="#fff" strokeWidth={1.8} />
              <Text style={formStyles.appleBtnText}>Continue with Apple</Text>
            </View>
          </PressBtn>

          {/* Google — white background, border, colored G */}
          <PressBtn style={formStyles.googleBtn} onPress={handleAuth} scale={0.98}>
            <View style={styles.btnContent}>
              <View style={formStyles.googleG}>
                <Text style={formStyles.googleGText}>G</Text>
              </View>
              <Text style={formStyles.googleBtnText}>Continue with Google</Text>
            </View>
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
  logoArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  appName: { fontSize: 52, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -2.5, marginTop: Spacing.md },
  tagline: { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  splashActions: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 28,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  secondaryBtn: {
    backgroundColor: Colors.surface, borderRadius: 28,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.body },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});

const formStyles = StyleSheet.create({
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: Spacing.lg },
  backText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  miniLogo: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 20 },
  label: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md,
  },
  inputError: { borderColor: Colors.danger },
  inputIcon: { marginRight: Spacing.xs },
  inputInner: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary },
  eyeBtn: { padding: Spacing.xs },
  fieldError: { fontSize: FontSize.small, color: Colors.danger, fontWeight: '600', marginTop: 3, marginLeft: 2 },

  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.base },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  privacyText: { flex: 1, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 20 },
  privacyLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  privacyExpanded: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  privacyContent: { fontSize: FontSize.small, color: Colors.textSecondary, lineHeight: 18 },
  submitBtn: { marginTop: Spacing.lg },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.base },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: FontSize.caption, color: Colors.textMuted },

  // Apple — black
  appleBtn: {
    backgroundColor: '#000', borderRadius: 28,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52,
    justifyContent: 'center', marginBottom: Spacing.sm,
  },
  appleBtnText: { fontSize: FontSize.body, fontWeight: '600', color: '#fff' },

  // Google — white + border
  googleBtn: {
    backgroundColor: Colors.surface, borderRadius: 28,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52,
    justifyContent: 'center', marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  googleBtnText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  googleG: {
    width: 20, height: 20, borderRadius: 4, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  googleGText: {
    fontSize: 14, fontWeight: '800',
    color: '#4285F4', // Google blue
  },
});
