import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../components/tokens';

type AuthScreen = 'splash' | 'login' | 'register';

export function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const { setLoggedIn, uiMode } = useAppStore();
  const [screen, setScreen] = useState<AuthScreen>('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleAuth = () => {
    setLoggedIn(true);
    onAuth();
  };

  // ── Splash ─────────────────────────────────────────────────────
  if (screen === 'splash') {
    return (
      <SafeAreaView style={[styles.container, styles.splashContainer]}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.cairnStack}>
            {[40, 52, 36, 48].map((w, i) => (
              <View key={i} style={[styles.cairnStone, { width: w, backgroundColor: i % 2 === 0 ? Colors.primary : '#7a9e5a' }]} />
            ))}
          </View>
          <Text style={styles.appName}>Cairn</Text>
          <Text style={styles.tagline}>Leave a mark.{'\n'}Guide the next.</Text>
        </View>

        {/* Buttons */}
        <View style={styles.splashActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('register')}>
            <Text style={styles.primaryBtnText}>创建账号</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScreen('login')}>
            <Text style={styles.secondaryBtnText}>已有账号，登录</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Login ──────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('splash')}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>登录</Text>

          <Text style={styles.fieldLabel}>邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={Colors.textMuted}
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>密码</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            value={password} onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={[styles.primaryBtn, { marginTop: Spacing.lg }]} onPress={handleAuth}>
            <Text style={styles.primaryBtnText}>登录</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.oauthBtn} onPress={handleAuth}>
            <Text style={styles.oauthBtnText}>🍎  Apple登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.oauthBtn} onPress={handleAuth}>
            <Text style={styles.oauthBtnText}>🔵  Google登录</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Register ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('splash')}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>创建账号</Text>
        <Text style={styles.formSubtitle}>注册后默认开启说明模式，随时可在设置中切换</Text>

        <Text style={styles.fieldLabel}>邮箱</Text>
        <TextInput
          style={styles.input}
          placeholder="你的邮箱地址，用于找回账号"
          placeholderTextColor={Colors.textMuted}
          value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>密码</Text>
        <TextInput
          style={styles.input}
          placeholder="至少8位，建议包含字母和数字"
          placeholderTextColor={Colors.textMuted}
          value={password} onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>确认密码</Text>
        <TextInput
          style={styles.input}
          placeholder="再次输入密码"
          placeholderTextColor={Colors.textMuted}
          value={confirm} onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: Spacing.lg }]} onPress={handleAuth}>
          <Text style={styles.primaryBtnText}>创建账号</Text>
        </TouchableOpacity>

        <Text style={styles.policyNote}>
          注册即同意我们的隐私政策。我们不收集位置以外的个人数据，不做任何社交推荐。
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  splashContainer: { justifyContent: 'space-between', padding: Spacing.xl },
  logoArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cairnStack: { alignItems: 'center', gap: 3, marginBottom: Spacing.xl },
  cairnStone: { height: 10, borderRadius: 5 },
  appName: { fontSize: 42, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -2 },
  tagline: { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginTop: Spacing.sm },
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

  form: { flex: 1, padding: Spacing.xl },
  backBtn: { marginBottom: Spacing.lg },
  backBtnText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: '600' },
  formTitle: { fontSize: FontSize.h1, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  formSubtitle: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 20 },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    padding: Spacing.md, fontSize: FontSize.body, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.base },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.caption, color: Colors.textMuted },
  oauthBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.button,
    paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  oauthBtnText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textPrimary },
  policyNote: { fontSize: FontSize.small, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg, lineHeight: 18 },
});
