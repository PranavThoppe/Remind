import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { shadows, spacing, borderRadius, typography } from '../constants/theme';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { createProfile } = useAuth();
  const styles = createStyles(colors);

  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignInMode, setIsSignInMode] = useState(false); // Toggle between sign-up and sign-in

  const [emailSent, setEmailSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const emailFadeAnim = useRef(new Animated.Value(0)).current;
  const emailScaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (showEmailLogin) {
      Animated.parallel([
        Animated.timing(emailFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(emailScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showEmailLogin]);

  const handleLogin = async () => {
    if (cooldown > 0) return;

    console.log('Email login attempt for:', email);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (error) {
        console.error('Supabase Email OTP error:', error);

        // Handle rate limit specifically
        if (error.message.includes('rate limit')) {
          alert('Too many attempts. Please wait 60 seconds before trying again.');
          setCooldown(60);
          return;
        }

        alert(error.message);
        return;
      }

      console.log('Email OTP link/code sent successfully');
      setEmailSent(true);
      setCooldown(60); // Start cooldown after successful send
    } catch (error: any) {
      console.error('Error signing in with email:', error.message);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    console.log('Password sign-in attempt for:', email);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error('Supabase Password Sign-In error:', error);
        alert(error.message);
        return;
      }

      console.log('Password sign-in successful!');
      if (data?.user) {
        await createProfile(data.user);
      }
    } catch (error: any) {
      console.error('Error signing in with password:', error.message);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    console.log('Verifying OTP for:', email);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'email',
      });

      if (error) {
        console.error('OTP Verification error:', error);
        alert('Invalid or expired code. Please try again.');
        return;
      }

      console.log('OTP verified successfully!');
      if (data?.user) {
        await createProfile(data.user);
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error.message);
      alert('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log('Google login button pressed');
    setLoading(true);
    try {
      // Automatically generate the correct redirect URI for the environment
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'remind',
      });
      console.log('Generated Redirect URI:', redirectUri);

      console.log('Starting Supabase OAuth flow...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Supabase OAuth error:', error);
        throw error;
      }

      console.log('OAuth URL received:', data?.url);

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        );
        console.log('WebBrowser result:', result);

        if (result.type === 'success' && result.url) {
          const access_token = extractParam(result.url, 'access_token');
          const refresh_token = extractParam(result.url, 'refresh_token');

          if (access_token && refresh_token) {
            console.log('Tokens extracted, setting session...');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) throw sessionError;
            console.log('Session successfully set!');

            if (sessionData?.user) {
              await createProfile(sessionData.user);
            }
          } else {
            console.error('Failed to extract tokens from URL');
          }
        }
      }
    } catch (error: any) {
      console.error('Error signing in:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = email.includes('@');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo & Brand */}
        <Animated.View
          style={[
            styles.brandContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>✨</Text>
          </View>
          <Text style={styles.title}>Remind</Text>
          <Text style={styles.subtitle}>
            Simple reminders for a clearer mind
          </Text>
        </Animated.View>

        {/* Auth Buttons */}
        <Animated.View
          style={[
            styles.authContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {emailSent ? (
            <View style={styles.emailSentContainer}>
              <View style={styles.emailSentIcon}>
                <Ionicons name="mail-open-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emailSentTitle}>Enter verification code</Text>
              <Text style={styles.emailSentText}>
                We've sent a 6-digit code to <Text style={styles.emailSentHighlight}>{email}</Text>.
              </Text>

              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                value={otp}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtp(cleaned);
                  if (cleaned.length === 6) {
                    // Logic to auto-submit could go here, but manual is safer for first iteration
                  }
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (otp.length !== 6 || loading) && styles.continueButtonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6 || loading}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
                {!loading && <Ionicons name="checkmark-circle" size={18} color={colors.primaryForeground} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendButton, cooldown > 0 && styles.resendButtonDisabled]}
                onPress={handleLogin}
                disabled={loading || cooldown > 0}
              >
                <Text style={styles.resendButtonText}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setEmailSent(false);
                  setOtp('');
                }}
              >
                <Text style={styles.backButtonText}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Google Sign In */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                activeOpacity={0.8}
                disabled={loading}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>
                  {loading && !showEmailLogin ? 'Connecting...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email Login */}
              {!showEmailLogin ? (
                <TouchableOpacity
                  style={styles.emailButton}
                  onPress={() => setShowEmailLogin(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mail-outline" size={20} color={colors.secondaryForeground} />
                  <Text style={styles.emailButtonText}>Continue with Email</Text>
                </TouchableOpacity>
              ) : (
                <Animated.View
                  style={[
                    styles.emailInputContainer,
                    {
                      opacity: emailFadeAnim,
                      transform: [{ scale: emailScaleAnim }],
                    },
                  ]}
                >
                  {/* Sign In / Sign Up Toggle */}
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        !isSignInMode && styles.toggleButtonActive,
                      ]}
                      onPress={() => {
                        setIsSignInMode(false);
                        setPassword('');
                      }}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          !isSignInMode && styles.toggleButtonTextActive,
                        ]}
                      >
                        Sign Up
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        isSignInMode && styles.toggleButtonActive,
                      ]}
                      onPress={() => setIsSignInMode(true)}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          isSignInMode && styles.toggleButtonTextActive,
                        ]}
                      >
                        Sign In
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.mutedForeground}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />

                  {/* Password field - only show in sign-in mode */}
                  {isSignInMode && (
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.mutedForeground}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.continueButton,
                      (isSignInMode
                        ? (!isValidEmail || !password || loading)
                        : (!isValidEmail || loading || cooldown > 0)
                      ) && styles.continueButtonDisabled,
                    ]}
                    onPress={isSignInMode ? handlePasswordSignIn : handleLogin}
                    disabled={
                      isSignInMode
                        ? (!isValidEmail || !password || loading)
                        : (!isValidEmail || loading || cooldown > 0)
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.continueButtonText}>
                      {loading
                        ? (isSignInMode ? 'Signing in...' : 'Sending link...')
                        : (isSignInMode
                          ? 'Sign In'
                          : (cooldown > 0 ? `Wait ${cooldown}s` : 'Continue')
                        )
                      }
                    </Text>
                    {!loading && (isSignInMode || cooldown === 0) && (
                      <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
                    )}
                  </TouchableOpacity>

                  {/* Back button */}
                  <TouchableOpacity
                    style={styles.backToOptionsButton}
                    onPress={() => {
                      setShowEmailLogin(false);
                      setEmail('');
                      setPassword('');
                      setIsSignInMode(false);
                    }}
                  >
                    <Text style={styles.backButtonText}>← Back to options</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>

        {/* Terms */}
        <Animated.Text
          style={[
            styles.terms,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Animated.Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['3xl'],
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 240,
  },
  authContainer: {
    width: '100%',
    maxWidth: 320,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  googleIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  googleButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginHorizontal: spacing.md,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondary,
    gap: spacing.md,
  },
  emailButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.secondaryForeground,
  },
  emailInputContainer: {
    gap: spacing.md,
  },
  input: {
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    gap: spacing.sm,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.primaryForeground,
  },
  terms: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 32,
  },
  emailSentContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: `${colors.primary}05`,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
    paddingHorizontal: spacing.lg,
  },
  emailSentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emailSentTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emailSentText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emailSentHighlight: {
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.lg,
    width: '100%',
  },
  resendButton: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondary,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.background,
    ...shadows.soft,
  },
  toggleButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  toggleButtonTextActive: {
    color: colors.foreground,
  },
  backToOptionsButton: {
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});

function extractParam(url: string, param: string) {
  const match = url.match(new RegExp(`${param}=([^&]+)`));
  return match ? match[1] : null;
}
