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
import { colors, shadows, spacing, borderRadius, typography } from '../constants/theme';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
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

    // Check for existing session and listen for auth changes
    const checkSession = async () => {
      console.log('Checking for existing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      }
      if (session) {
        console.log('Session found, redirecting to home');
        router.replace('/(tabs)/home');
      } else {
        console.log('No active session found');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      if (session) {
        console.log('Session detected in onAuthStateChange, redirecting...');
        router.replace('/(tabs)/home');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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

  const handleLogin = () => {
    router.replace('/(tabs)/home');
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
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) throw sessionError;
            console.log('Session successfully set!');
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
              {loading ? 'Connecting...' : 'Continue with Google'}
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
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  !isValidEmail && styles.continueButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={!isValidEmail}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
              </TouchableOpacity>
            </Animated.View>
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

const styles = StyleSheet.create({
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
});

function extractParam(url: string, param: string) {
  const match = url.match(new RegExp(`${param}=([^&]+)`));
  return match ? match[1] : null;
}
