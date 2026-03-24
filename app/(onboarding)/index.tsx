import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, shadows, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignInMode, setIsSignInMode] = useState(false);
    const [loading, setLoading] = useState(false);

    const waveAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Wave once on mount with a slight delay
        setTimeout(() => {
            Animated.sequence([
                Animated.timing(waveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(waveAnim, { toValue: -1, duration: 200, useNativeDriver: true }),
                Animated.timing(waveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(waveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        }, 500);
    }, [waveAnim]);

    const waveInterpolate = waveAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-20deg', '0deg', '20deg'],
    });

    const { updateDraft, savedSteps, saveStep, draft } = useOnboarding();
    const { createProfile, session, user } = useAuth();

    // Auto-resume: if there is a valid session, bypass the Welcome screen.
    // We check savedSteps to jump to their last step, or default to Step 2 (Profile).
    // We use a ref to ensure this only fires once per mount for pre-existing sessions,
    // and doesn't interrupt an active login flow.
    const hasAutoRouted = useRef(false);
    useEffect(() => {
        if (session?.user && !loading && !hasAutoRouted.current) {
            hasAutoRouted.current = true;
            let nextStep = 2; // Default to profile

            if (savedSteps.size > 0) {
                nextStep = Math.max(...Array.from(savedSteps)) + 1;
            }

            // Pre-populate draft with Google metadata if it's empty (e.g. fresh reload)
            if (!draft.fullName && session.user.user_metadata?.full_name) {
                updateDraft({
                    fullName: session.user.user_metadata.full_name,
                    avatarUrl: session.user.user_metadata.avatar_url || null,
                });
            }

            setTimeout(() => {
                switch (nextStep) {
                    case 2: router.replace('/(onboarding)/profile'); break;
                    case 3: router.replace('/(onboarding)/notifications'); break;
                    case 4: router.replace('/(onboarding)/appearance'); break;
                    case 5: router.replace('/(onboarding)/common-times'); break;
                    case 6: router.replace('/(onboarding)/tags'); break;
                    case 7: router.replace('/(onboarding)/priorities'); break;
                    case 8: router.replace('/(onboarding)/complete'); break;
                    default: router.replace('/(onboarding)/profile'); break;
                }
            }, 50);
        }
    }, [session, savedSteps, loading, draft.fullName]);

    // Helper: extract a URL param from the OAuth callback URL
    const extractParam = (url: string, param: string): string | null => {
        // Params can appear after # (fragment) or ? (query)
        const fragment = url.includes('#') ? url.split('#')[1] : '';
        const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
        const search = new URLSearchParams(fragment || query);
        return search.get(param);
    };

    // Called after any successful auth to mark step 1 done and navigate
    const onAuthSuccess = async (authUser: any) => {
        await createProfile(authUser);
        updateDraft({
            fullName: authUser.user_metadata?.full_name || '',
            avatarUrl: authUser.user_metadata?.avatar_url || null,
        });
        await saveStep(1);
        router.push('/(onboarding)/profile');
    };

    // ─── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            // Sign out any stale session first so we always start fresh.
            await supabase.auth.signOut();

            const redirectUri = AuthSession.makeRedirectUri({ scheme: 'remindonboarding' });
            console.log('[Auth] Google OAuth redirect URI:', redirectUri);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUri,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
                console.log('[Auth] Browser result type:', result.type);

                if (result.type === 'success' && result.url) {
                    const access_token = extractParam(result.url, 'access_token');
                    const refresh_token = extractParam(result.url, 'refresh_token');

                    if (access_token && refresh_token) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        });

                        if (sessionError) throw sessionError;

                        if (sessionData?.user) {
                            await onAuthSuccess(sessionData.user);
                        }
                    } else {
                        console.error('[Auth] Missing tokens in redirect URL');
                        setLoading(false);
                    }
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        } catch (err: any) {
            console.error('[Auth] Google sign-in error:', err.message);
            Alert.alert('Error', err.message || 'Google sign-in failed.');
            setLoading(false);
        }
    };

    // ─── Apple Sign-In ─────────────────────────────────────────────────────────
    const handleAppleLogin = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (credential.identityToken) {
                setLoading(true);
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: credential.identityToken,
                });

                if (error) throw error;

                if (data?.user) {
                    // Apple only provides fullName on the very first sign-in -- persist it immediately.
                    const givenName = credential.fullName?.givenName;
                    const familyName = credential.fullName?.familyName;
                    const fullName = [givenName, familyName].filter(Boolean).join(' ');
                    if (fullName) {
                        await supabase.auth.updateUser({ data: { full_name: fullName } });
                        data.user.user_metadata = { ...data.user.user_metadata, full_name: fullName };
                    }
                    await onAuthSuccess(data.user);
                }
            }
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                // User dismissed -- no action needed
            } else {
                console.error('[Auth] Apple sign-in error:', error.message);
                Alert.alert('Error', 'Failed to sign in with Apple. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ─── Email Sign-Up ─────────────────────────────────────────────────────────
    const handleSignUp = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });
            if (error) { Alert.alert('Error', error.message); return; }

            if (data?.user) {
                if (!data.session) {
                    // Email confirmation required
                    Alert.alert(
                        'Check your email',
                        'We sent a confirmation link to ' + email.trim() + '. Verify it, then come back and Sign In.',
                    );
                    setIsSignInMode(true);
                    return;
                }
                await onAuthSuccess(data.user);
            }
        } catch (err: any) {
            console.error('[Auth] Sign-up error:', err);
            Alert.alert('Error', 'Sign-up failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Email Sign-In ─────────────────────────────────────────────────────────
    const handleSignIn = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) { Alert.alert('Error', error.message); return; }

            if (data?.user) {
                await onAuthSuccess(data.user);
            }
        } catch (err: any) {
            console.error('[Auth] Sign-in error:', err);
            Alert.alert('Error', 'Sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isValidEmail = email.includes('@');
    const isValidPassword = password.length >= 6;

    return (
        <OnboardingShell
            currentStep={1}
            totalSteps={8}
            hideActionBar={true}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Animated.Text style={[styles.waveEmoji, { transform: [{ rotate: waveInterpolate }] }]}>
                            👋
                        </Animated.Text>
                    </View>

                    <Text style={styles.title}>Welcome to Re-Mind</Text>
                    <Text style={styles.subtitle}>
                        Your AI enhanced reminder app. Let's set up your profile!
                    </Text>

                    <View style={styles.spacer} />

                    <View style={styles.authContainer}>
                        {!showEmailLogin ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.googleButton, loading && styles.disabledButton]}
                                    onPress={handleGoogleLogin}
                                    activeOpacity={0.8}
                                    disabled={loading}
                                >
                                    <Image
                                        source={require('../../assets/google-g.png')}
                                        style={styles.googleIconImage}
                                    />
                                    <Text style={styles.googleButtonText}>
                                        {loading ? 'Signing in…' : 'Continue with Google'}
                                    </Text>
                                </TouchableOpacity>

                                {Platform.OS === 'ios' && (
                                    <AppleAuthentication.AppleAuthenticationButton
                                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                                        buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                                        cornerRadius={borderRadius.lg}
                                        style={styles.appleButton}
                                        onPress={handleAppleLogin}
                                    />
                                )}

                                <View style={styles.divider}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>or</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                <TouchableOpacity
                                    style={styles.emailButton}
                                    onPress={() => setShowEmailLogin(true)}
                                    activeOpacity={0.8}
                                    disabled={loading}
                                >
                                    <Ionicons name="mail-outline" size={20} color={colors.secondaryForeground} />
                                    <Text style={styles.emailButtonText}>Continue with Email</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.emailInputContainer}>
                                <View style={styles.toggleContainer}>
                                    <TouchableOpacity
                                        style={[styles.toggleButton, !isSignInMode && styles.toggleButtonActive]}
                                        onPress={() => setIsSignInMode(false)}
                                    >
                                        <Text style={[styles.toggleButtonText, !isSignInMode && styles.toggleButtonTextActive]}>
                                            Sign Up
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.toggleButton, isSignInMode && styles.toggleButtonActive]}
                                        onPress={() => setIsSignInMode(true)}
                                    >
                                        <Text style={[styles.toggleButtonText, isSignInMode && styles.toggleButtonTextActive]}>
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
                                    editable={!loading}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder={isSignInMode ? 'Enter your password' : 'Create a password (min 6 chars)'}
                                    placeholderTextColor={colors.mutedForeground}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    editable={!loading}
                                />

                                <TouchableOpacity
                                    style={[
                                        styles.continueButton,
                                        (!isValidEmail || !isValidPassword || loading) && styles.continueButtonDisabled,
                                    ]}
                                    onPress={isSignInMode ? handleSignIn : handleSignUp}
                                    disabled={!isValidEmail || !isValidPassword || loading}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.continueButtonText}>
                                        {loading ? 'Please wait…' : isSignInMode ? 'Sign In' : 'Sign Up'}
                                    </Text>
                                    {!loading && <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.backToOptionsButton}
                                    onPress={() => setShowEmailLogin(false)}
                                    disabled={loading}
                                >
                                    <Text style={styles.backButtonText}>← Back to options</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: spacing.xl,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primaryLight + '40', // transparent primary
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing['3xl'],
    },
    waveEmoji: {
        fontSize: 64,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.lg,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 24,
    },
    spacer: {
        height: 60,
    },
    authContainer: {
        width: '100%',
        maxWidth: 320,
        marginBottom: spacing.xl,
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
    googleIconImage: {
        width: 20,
        height: 20,
        marginRight: spacing.md,
    },
    appleButton: {
        width: '100%',
        height: 48,
        marginTop: spacing.md,
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
    backButtonText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
        color: colors.primary,
    },
    disabledButton: {
        opacity: 0.6,
    },
});
