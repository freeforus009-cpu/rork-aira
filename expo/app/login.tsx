import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, ArrowRight, GraduationCap, Shield } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginPending } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleLogin = async () => {
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    try {
      const user = await login({ identifier: identifier.trim(), password });
      if (user.role === 'admin' || user.role === 'super_admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(student)/home' as any);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    }
  };

  const onPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/aira-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.appName}>AIRA</Text>
          <Text style={styles.appSubtitle}>Academic Integrated Review & Assessment</Text>
          <Text style={styles.appTagline}>Train Smart. Get Certified!</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.signInText}>Sign in with your email or username</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email or Username"
              placeholderTextColor={Colors.textMuted}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="login-identifier"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              testID="login-password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              testID="toggle-password"
            >
              {showPassword ? (
                <EyeOff size={18} color={Colors.textMuted} />
              ) : (
                <Eye size={18} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/forgot-password' as any)}
            style={styles.forgotLink}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.signInButton, loginPending && styles.buttonDisabled]}
              onPress={handleLogin}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={loginPending}
              activeOpacity={0.8}
              testID="login-button"
            >
              <Text style={styles.signInButtonText}>
                {loginPending ? 'Signing In...' : 'Sign In'}
              </Text>
              {!loginPending && <ArrowRight size={18} color="#000" />}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpLabel}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup' as any)}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.adminSignupRow}
            onPress={() => router.push('/admin-signup' as any)}
          >
            <Shield size={14} color={Colors.accent} />
            <Text style={styles.adminSignupText}>Register as Admin (Teacher)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: `0 8px 32px ${Colors.glowPrimary}` },
      default: {},
    }),
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 20,
  },
  appName: {
    fontSize: 34,
    fontWeight: '900' as const,
    color: Colors.text,
    letterSpacing: 4,
    marginTop: 16,
  },
  appSubtitle: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 4,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  appTagline: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  formSection: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(0,0,0,0.3)' },
      default: {},
    }),
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  signInText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.errorSoft,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
    borderRadius: 8,
  },
  forgotLink: {
    alignSelf: 'flex-end' as const,
    marginBottom: 24,
  },
  forgotText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  signInButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    ...Platform.select({
      web: { boxShadow: `0 4px 16px ${Colors.glowPrimary}` },
      default: { elevation: 3 },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signUpLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  signUpLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  adminSignupRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  adminSignupText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
