import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';

export default function CompleteScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { totalSteps } = useOnboarding();
    const { updateProfile } = useAuth();
    const router = useRouter();

    // Checkmark circle scale animation
    const scaleAnim = useRef(new Animated.Value(0)).current;
    // Checkmark draw animation
    const checkAnim = useRef(new Animated.Value(0)).current;
    // Confetti dots
    const dots = useRef(
        Array.from({ length: 10 }, () => ({
            x: new Animated.Value(0),
            y: new Animated.Value(0),
            opacity: new Animated.Value(0),
            rotate: new Animated.Value(0),
        }))
    ).current;

    useEffect(() => {
        // Pop in the circle
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 60,
            friction: 7,
            useNativeDriver: true,
        }).start();

        // Draw the checkmark stroke after circle appears
        Animated.timing(checkAnim, {
            toValue: 1,
            duration: 500,
            delay: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();

        // Burst confetti dots outward
        const confettiAnims = dots.map((dot, i) => {
            const angle = (i / dots.length) * 2 * Math.PI;
            const distance = 80 + Math.random() * 40;
            return Animated.parallel([
                Animated.timing(dot.opacity, {
                    toValue: 1,
                    duration: 150,
                    delay: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(dot.x, {
                    toValue: Math.cos(angle) * distance,
                    duration: 600,
                    delay: 200,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(dot.y, {
                    toValue: Math.sin(angle) * distance,
                    duration: 600,
                    delay: 200,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(dot.rotate, {
                    toValue: 1,
                    duration: 600,
                    delay: 200,
                    useNativeDriver: true,
                }),
                // Fade out
                Animated.timing(dot.opacity, {
                    toValue: 0,
                    duration: 400,
                    delay: 600,
                    useNativeDriver: true,
                }),
            ]);
        });
        Animated.parallel(confettiAnims).start();
    }, []);

    const handleGoToHome = async () => {
        await updateProfile({ has_onboarded: true });
        router.replace('/(tabs)');
    };

    const DOT_COLORS = [
        colors.primary,
        '#F59E0B',
        '#10B981',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#F97316',
        '#84CC16',
        '#6366F1',
    ];

    const checkOpacity = checkAnim.interpolate({
        inputRange: [0, 0.01, 1],
        outputRange: [0, 1, 1],
    });

    return (
        <OnboardingShell
            currentStep={8}
            totalSteps={totalSteps}
            showNext={false}
            hideActionBar
        >
            <View style={styles.container}>
                {/* Confetti burst */}
                <View style={styles.confettiContainer} pointerEvents="none">
                    {dots.map((dot, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: DOT_COLORS[i % DOT_COLORS.length],
                                    opacity: dot.opacity,
                                    transform: [
                                        { translateX: dot.x },
                                        { translateY: dot.y },
                                        {
                                            rotate: dot.rotate.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Animated checkmark circle */}
                <Animated.View
                    style={[
                        styles.checkCircle,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <Animated.View style={{ opacity: checkOpacity }}>
                        <Ionicons name="checkmark" size={64} color="#FFFFFF" />
                    </Animated.View>
                </Animated.View>

                <Text style={styles.title}>You're all set!</Text>
                <Text style={styles.subtitle}>
                    Your preferences have been saved. Re-Mind is ready to help you stay on top of what matters.
                </Text>

                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={handleGoToHome}
                    activeOpacity={0.85}
                >
                    <Text style={styles.ctaText}>Go to Home</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing['2xl'],
        },
        confettiContainer: {
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
        },
        dot: {
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        checkCircle: {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['3xl'],
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 10,
        },
        title: {
            fontFamily: typography.fontFamily.title,
            fontSize: typography.fontSize['3xl'] || 30,
            color: colors.foreground,
            textAlign: 'center',
            marginBottom: spacing.md,
        },
        subtitle: {
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.fontSize.base,
            color: colors.mutedForeground,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: spacing['3xl'],
            maxWidth: 320,
        },
        ctaButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: colors.primary,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing['3xl'],
            borderRadius: borderRadius.full,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
        },
        ctaText: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.lg,
            color: '#FFFFFF',
        },
    });
