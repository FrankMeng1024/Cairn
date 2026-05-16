/**
 * AuthScreen — Sprint 35 auth overhaul (CR-004 / STORY-00117)
 *
 * Sprint 35 changes:
 * - Splash: Sign In is primary (green), Create Account is secondary — industry convention
 * - Form header: small Cairn icon inline-left of title on same line
 * - Focus ring: border-only highlight, placeholder stays fully visible at all times
 * - Privacy Policy: professional, GDPR/NZ Privacy Act compliant text
 * - Social buttons: Apple (disabled, shows info) + Google (placeholder → Sprint 36 real OAuth)
 * - Auth wired to real backend via authService (STORY-00119)
 *
 * Previous: Sprint 22 splash uplift (STORY-00058)
 * - Cairn logo glow pulse, premium pill entry buttons, inline validation
 * - Branded social login buttons (Apple=black, Google=white+border)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, ScrollView, Dimensions, Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow, IconSize } from '../components/tokens';
import { Icon } from '../components/Icon';
import { login, register } from '../services/authService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { height: SCREEN_H } = Dimensions.get('window');

// ── Animated Cairn Stack ───────────────────────────────────────────────────
const STONES = [
  { width: 52, color: Colors.primary },
  { width: 70, color: '#7a9e5a' },
  { width: 44, color: Colors.primary },
  { width: 62, color: '#7a9e5a' },
  { width: 78, color: '#4a6b38' },
];

function AnimatedCairn({ size = 1 }: { size?: number }) {
  const anims = useRef(STONES.map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.stagger(90, STONES.map((_, i) =>
      Animated.spring(anims[i], { toValue: 1, tension: 100, friction: 8, useNativeDriver: true })
    )).start(() => {
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
  container: { alignItems: 'center', gap: 5 },
  stone: { height: 14, borderRadius: 7 },
});

// ── Press-animated wrapper ─────────────────────────────────────────────────
function PressBtn({ onPress, style, children, scale = 0.97, disabled }: {
  onPress: () => void; style?: object | object[]; children: React.ReactNode; scale?: number; disabled?: boolean;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const onIn = () => !disabled && Animated.spring(anim, { toValue: scale, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale: anim }] }}>
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={disabled ? 0.5 : 1}
        style={[style, disabled && { opacity: 0.5 }]}
      >
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
  const [focused, setFocused] = useState(false);
  return (
    <>
      <View style={[formStyles.inputWrap, !!error && formStyles.inputError, focused && !error && formStyles.inputFocused]}>
        <View style={formStyles.inputIcon}>
          <Icon name="KeyRound" size={IconSize.sm} color={focused ? Colors.primary : Colors.textMuted} strokeWidth={1.8} />
        </View>
        <TextInput
          style={formStyles.inputInner}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
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
function FieldInput({ icon, placeholder, value, onChangeText, error, onBlur, keyboardType, autoCapitalize, autoFocus }: {
  icon: string; placeholder: string; value: string; onChangeText: (v: string) => void;
  error?: string; onBlur?: () => void; keyboardType?: any; autoCapitalize?: any; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <View style={[formStyles.inputWrap, !!error && formStyles.inputError, focused && !error && formStyles.inputFocused]}>
        <View style={formStyles.inputIcon}>
          <Icon name={icon as any} size={IconSize.sm} color={focused ? Colors.primary : Colors.textMuted} strokeWidth={1.8} />
        </View>
        <TextInput
          style={formStyles.inputInner}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
        />
      </View>
      {!!error && <Text style={formStyles.fieldError}>{error}</Text>}
    </>
  );
}

// ── Privacy Policy content ─────────────────────────────────────────────────
const PRIVACY_POLICY = `Cairn Privacy Policy
Effective date: May 2026

1. What we collect
• Account data: name, email address, hashed password (never stored in plain text)
• Location data: GPS coordinates, only while you actively start a tracking session
• Activity data: trail routes, distance, duration, planted flags — associated with your account
• Device info: OS type, app version (for crash reporting only)

2. Why we collect it
• Location: to record your trail, calculate distance, and enable safety features
• Account data: to identify you and protect your personal trail history
• We never collect your location in the background without an active session

3. How we protect it
• Passwords hashed with bcrypt (industry standard)
• Data encrypted in transit (HTTPS/TLS)
• JWT tokens expire after 7 days
• You can delete your account and all associated data at any time

4. Sharing
• We do not sell your data to third parties — ever
• Location and trail data shared only with friends you explicitly add
• We may use aggregated, anonymised statistics to improve the product

5. Your rights
• Access: request a copy of your data at any time
• Deletion: delete your account and all data via Settings → Account → Delete Account
• Portability: export your trail history as GPX at any time
• Correction: update your profile information at any time

6. Applicable law
Cairn complies with the New Zealand Privacy Act 2020 and, where applicable, the EU General Data Protection Regulation (GDPR).

7. Contact
privacy@cairnapp.nz`;

// ── Auth Screen ────────────────────────────────────────────────────────────
type AuthView = 'splash' | 'login' | 'register' | 'welcome';

export function AuthScreen() {
  const nav = useNavigation<Nav>();
  const { setLoggedIn, setUIMode, setUser } = useAppStore();
  const [view, setView] = useState<AuthView>('splash');
  const [welcomeName, setWelcomeName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [privacyError, setPrivacyError] = useState('');

  const splashFade = useRef(new Animated.Value(0)).current;
  const splashTranslate = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (view === 'splash') {
      Animated.parallel([
        Animated.timing(splashFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(splashTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [view]);

  const resetErrors = () => {
    setNameError(''); setEmailError(''); setPasswordError(''); setConfirmError('');
    setPrivacyError(''); setApiError('');
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
    if (val.length < 8) return 'Minimum 8 characters';
    return '';
  };

  const handleAuth = async () => {
    const isRegister = view === 'register';
    let valid = true;

    if (isRegister && !name.trim()) { setNameError('Name is required'); valid = false; }
    const eErr = validateEmail(email); if (eErr) { setEmailError(eErr); valid = false; }
    const pErr = validatePassword(password); if (pErr) { setPasswordError(pErr); valid = false; }
    if (isRegister && password !== confirm) { setConfirmError('Passwords do not match'); valid = false; }
    if (isRegister && !privacyChecked) { setPrivacyError('Please agree to continue'); valid = false; }
    if (!valid) return;

    setLoading(true);
    setApiError('');
    try {
      const result = isRegister
        ? await register(name.trim(), email.trim().toLowerCase(), password)
        : await login(email.trim().toLowerCase(), password);

      if (result.error) {
        setApiError(result.error);
        return;
      }

      setLoggedIn(true);
      if (result.user) setUser(result.user);
      if (isRegister) {
        setUIMode('beginner');
        setWelcomeName(result.user?.name || name.trim() || 'Explorer');
        setView('welcome');
        setTimeout(() => nav.replace('Home'), 1800);
      } else {
        nav.replace('Home');
      }
    } catch (e: any) {
      setApiError(e?.message || 'Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    // Sprint 36: real Google OAuth via expo-auth-session
    Alert.alert(
      'Google Sign In',
      'Google authentication will be available in the next update.',
      [{ text: 'OK' }]
    );
  };

  // ── Splash ─────────────────────────────────────────────────────────────
  if (view === 'splash') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View style={[styles.splashInner, { opacity: splashFade, transform: [{ translateY: splashTranslate }] }]}>
          {/* Hero area — at least 40% of screen */}
          <View style={styles.logoArea}>
            <View style={styles.logoGlowWrap} pointerEvents="none">
              <LinearGradient
                colors={[Colors.primaryLight, 'transparent']}
                style={styles.logoGlow}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 1, y: 1 }}
              />
            </View>
            <AnimatedCairn />
            <Text style={styles.appName}>Cairn</Text>
            <View style={styles.taglineWrap}>
              <Text style={styles.tagline}>Leave a mark.</Text>
              <Text style={styles.tagline}>Guide the next.</Text>
            </View>
          </View>
          {/* CTA buttons — Sign In PRIMARY (returning users are the majority) */}
          <View style={styles.splashActions}>
            <PressBtn style={styles.primaryBtn} onPress={() => handleViewChange('login')}>
              <View style={styles.btnContent}>
                <Icon name="LogIn" size={IconSize.sm} color="#fff" strokeWidth={2} />
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </View>
            </PressBtn>
            <PressBtn style={styles.secondaryBtn} onPress={() => handleViewChange('register')}>
              <View style={styles.btnContent}>
                <Icon name="UserPlus" size={IconSize.sm} color={Colors.textPrimary} strokeWidth={2} />
                <Text style={styles.secondaryBtnText}>Create Account</Text>
              </View>
            </PressBtn>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Welcome (post-registration) ────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <Icon name="CheckCircle" size={56} color={Colors.primary} strokeWidth={1.5} />
        <Text style={[styles.appName, { marginTop: 16, marginBottom: 8 }]}>Welcome, {welcomeName}!</Text>
        <Text style={[styles.tagline, { textAlign: 'center', color: Colors.textSecondary }]}>Your trail starts now.</Text>
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

          {/* Title row: small icon inline-left of title */}
          <View style={formStyles.titleRow}>
            <AnimatedCairn size={0.5} />
            <Text style={formStyles.title}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
          </View>
          {isRegister && (
            <Text style={formStyles.sub}>You'll start in Explorer mode. Switch anytime in Settings.</Text>
          )}

          {/* API error banner */}
          {!!apiError && (
            <View style={formStyles.apiBanner}>
              <Icon name="AlertCircle" size={14} color={Colors.danger} strokeWidth={2} />
              <Text style={formStyles.apiError}>{apiError}</Text>
            </View>
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
                autoFocus={isRegister}
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
            autoFocus={!isRegister}
          />

          <Text style={formStyles.label}>Password</Text>
          <PasswordInput
            value={password}
            onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
            placeholder={isRegister ? 'Min. 8 characters' : '••••••••'}
            error={passwordError}
            onBlur={() => setPasswordError(validatePassword(password))}
          />
          {isRegister && !passwordError && (
            <Text style={[formStyles.fieldError, { color: Colors.textSecondary, fontWeight: '400' }]}>Minimum 8 characters</Text>
          )}

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

          {/* Privacy row — register only */}
          {isRegister && (
            <>
              <View style={formStyles.privacyRow}>
                <TouchableOpacity
                  style={[formStyles.checkbox, privacyChecked && formStyles.checkboxChecked]}
                  onPress={() => { setPrivacyChecked(v => !v); setPrivacyError(''); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  {privacyChecked && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
                </TouchableOpacity>
                <Text style={formStyles.privacyText}>
                  {'I have read and agree to the '}
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
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    <Text style={formStyles.privacyContent}>{PRIVACY_POLICY}</Text>
                  </ScrollView>
                </View>
              )}
            </>
          )}

          <PressBtn
            style={[styles.primaryBtn, formStyles.submitBtn]}
            onPress={handleAuth}
            disabled={loading}
          >
            <View style={styles.btnContent}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name={isRegister ? 'UserPlus' : 'LogIn'} size={IconSize.sm} color="#fff" strokeWidth={2} />
              }
              <Text style={styles.primaryBtnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
            </View>
          </PressBtn>

          <View style={formStyles.divider}>
            <View style={formStyles.divLine} />
            <Text style={formStyles.divText}>or continue with</Text>
            <View style={formStyles.divLine} />
          </View>

          {/* Apple — disabled on web, requires physical iOS device */}
          <PressBtn
            style={formStyles.appleBtn}
            onPress={() => Alert.alert('Apple Sign In', 'Apple Sign In is available on iOS devices. Download the Cairn app from the App Store to use this feature.')}
            scale={0.98}
          >
            <View style={styles.btnContent}>
              <Icon name="Apple" size={IconSize.sm} color="#fff" strokeWidth={1.8} />
              <View>
                <Text style={formStyles.appleBtnText}>Continue with Apple</Text>
              </View>
            </View>
          </PressBtn>
          <Text style={formStyles.socialHint}>Requires iOS device</Text>

          {/* Google — Sprint 36 real OAuth */}
          <PressBtn style={formStyles.googleBtn} onPress={handleGoogleAuth} scale={0.98}>
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
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl,
    paddingTop: Spacing.xl,
  },
  logoArea: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: Spacing.lg,
    minHeight: SCREEN_H * 0.42,
  },
  logoGlowWrap: {
    position: 'absolute',
    width: 200, height: 200,
    alignItems: 'center', justifyContent: 'center',
  },
  logoGlow: {
    width: 200, height: 200, borderRadius: 100,
  },
  appName: {
    fontSize: 56, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: -2.5, marginTop: Spacing.sm,
  },
  taglineWrap: { alignItems: 'center', gap: 2 },
  tagline: {
    fontSize: FontSize.h3, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 26, fontWeight: '400',
  },
  splashActions: { gap: Spacing.sm, paddingTop: Spacing.xxl },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 28,
    paddingVertical: Spacing.lg, alignItems: 'center', minHeight: 56,
    justifyContent: 'center', ...Shadow.fab,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  secondaryBtn: {
    backgroundColor: Colors.surface, borderRadius: 28,
    paddingVertical: Spacing.lg, alignItems: 'center', minHeight: 56,
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

  // Title row: icon inline-left of title text
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary },
  sub: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 20 },

  apiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.dangerBg, borderRadius: Radius.button,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.danger,
  },
  apiError: { flex: 1, fontSize: FontSize.small, color: Colors.danger, fontWeight: '500' },

  label: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md,
    // No background color change on focus — only border changes
  },
  inputError: { borderColor: Colors.danger },
  inputFocused: { borderColor: Colors.primary },  // border-only, bg unchanged
  inputIcon: { marginRight: Spacing.xs },
  inputInner: {
    flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    // backgroundColor transparent so placeholder remains visible
    backgroundColor: 'transparent',
  },
  eyeBtn: { padding: Spacing.xs },
  fieldError: { fontSize: FontSize.small, color: Colors.danger, fontWeight: '600', marginTop: 3, marginLeft: 2 },

  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.base },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
    flexShrink: 0,
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
  divText: { fontSize: FontSize.small, color: Colors.textMuted, whiteSpace: 'nowrap' } as any,

  socialHint: {
    fontSize: FontSize.tiny, color: Colors.textMuted, textAlign: 'center',
    marginTop: -Spacing.xs, marginBottom: Spacing.sm,
  },

  // Apple — black
  appleBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 28,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52,
    justifyContent: 'center', marginBottom: 2,
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
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  googleGText: {
    fontSize: 14, fontWeight: '800',
    color: '#4285F4',
  },
});
