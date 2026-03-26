import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, shadows, spacing, typography } from '../../constants/theme';
import { ThemeType, useOnboarding } from '../../contexts/OnboardingContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';

export default function AppearanceScreen() {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);
    const { draft, updateDraft, saveStep } = useOnboarding();
    const { setTheme } = useSettings();

    useEffect(() => {
        // Keep the live app theme aligned with any previously saved onboarding choice.
        setTheme(draft.theme).catch((error) => {
            console.error('Failed to sync onboarding theme:', error);
        });
    }, [draft.theme, setTheme]);

    const handleNext = async () => {
        await saveStep(4);
        router.push('/(onboarding)/common-times');
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)/notifications');
        }
    };

    const handleSkip = () => {
        router.push('/(onboarding)/common-times');
    };

    const handleSelectTheme = async (selectedTheme: ThemeType) => {
        updateDraft({ theme: selectedTheme });
        try {
            await setTheme(selectedTheme);
        } catch (error) {
            console.error('Failed to apply theme from onboarding:', error);
        }
    };

    const options: { label: string; value: ThemeType; icon: keyof typeof Ionicons.glyphMap }[] = [
        { label: 'Light', value: 'light', icon: 'sunny-outline' },
        { label: 'Dark', value: 'dark', icon: 'moon-outline' },
        { label: 'System', value: 'system', icon: 'settings-outline' },
    ];

    return (
        <OnboardingShell
            currentStep={4}
            totalSteps={8}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            nextLabel="Next"
        >
            <View style={styles.container}>
                <Text style={styles.title}>Choose Your Theme</Text>
                <Text style={styles.subtitle}>
                    How would you like Re-Mind to look?
                </Text>

                <View style={styles.cardsContainer}>
                    {options.map((option) => {
                        const isActive = draft.theme === option.value;
                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.card,
                                    isActive && styles.cardActive,
                                ]}
                                onPress={() => handleSelectTheme(option.value)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                                    <Ionicons
                                        name={option.icon}
                                        size={32}
                                        color={isActive ? colors.primary : colors.mutedForeground}
                                    />
                                </View>
                                <Text style={[styles.cardTitle, isActive && styles.cardTitleActive]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Preview Area */}
                <View style={styles.previewContainer}>
                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <View style={styles.previewAvatar} />
                            <View style={styles.previewLines}>
                                <View style={styles.previewLineShort} />
                                <View style={styles.previewLineLong} />
                            </View>
                        </View>
                        <View style={styles.previewContent}>
                            <View style={styles.previewBox} />
                        </View>
                    </View>
                </View>
            </View>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.lg,
        color: colors.mutedForeground,
        marginBottom: spacing['2xl'],
    },
    cardsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing['3xl'],
    },
    card: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        ...shadows.soft,
    },
    cardActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10', // 10% opacity primary
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.muted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconContainerActive: {
        backgroundColor: colors.background, // white in light, dark in dark
    },
    cardTitle: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
    },
    cardTitleActive: {
        color: colors.primary,
        fontFamily: typography.fontFamily.semibold,
    },
    previewContainer: {
        alignItems: 'center',
        marginTop: spacing.xl,
        paddingHorizontal: spacing.xl,
    },
    previewCard: {
        width: '100%',
        maxWidth: 280,
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    previewAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.muted,
    },
    previewLines: {
        flex: 1,
        gap: spacing.xs,
    },
    previewLineShort: {
        height: 12,
        width: '40%',
        backgroundColor: colors.mutedForeground,
        borderRadius: borderRadius.sm,
        opacity: 0.5,
    },
    previewLineLong: {
        height: 12,
        width: '70%',
        backgroundColor: colors.muted,
        borderRadius: borderRadius.sm,
    },
    previewContent: {
        marginTop: spacing.xs,
    },
    previewBox: {
        height: 60,
        width: '100%',
        backgroundColor: colors.primary + '20',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary + '40',
    },
});
