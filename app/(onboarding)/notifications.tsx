import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, spacing, typography } from '../../constants/theme';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { updateDraft, saveStep } = useOnboarding();

    const handleNext = async () => {
        await saveStep(3);
        router.push('/(onboarding)/appearance');
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)/profile');
        }
    };

    const handleSkip = () => {
        router.push('/(onboarding)/appearance');
    };

    const handleEnableNotifications = async () => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus === 'granted') {
                updateDraft({ notificationsEnabled: true });
                await saveStep(3);
                router.push('/(onboarding)/appearance');
            } else {
                updateDraft({ notificationsEnabled: false });
                Alert.alert(
                    "Notifications Disabled",
                    "You can enable them in your device settings to receive timely reminders.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => Linking.openSettings() }
                    ]
                );
            }
        } catch (error) {
            console.error("Failed to request notification permission:", error);
        }
    };

    return (
        <OnboardingShell
            currentStep={3}
            totalSteps={8}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="notifications-outline" size={64} color={colors.primary} />
                </View>

                <Text style={styles.title}>Stay on Track</Text>

                <Text style={styles.subtitle}>
                    Re-Mind uses notifications to send you timely reminders for your tasks.
                </Text>

                <TouchableOpacity
                    style={styles.enableButton}
                    onPress={handleEnableNotifications}
                    activeOpacity={0.8}
                >
                    <Ionicons name="notifications" size={20} color={colors.primaryForeground} />
                    <Text style={styles.enableButtonText}>Enable Notifications</Text>
                </TouchableOpacity>
            </View>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primary + '1A', // 10% opacity primary
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: spacing['3xl'],
        paddingHorizontal: spacing.md,
        lineHeight: 24,
    },
    enableButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing['2xl'],
        borderRadius: borderRadius.full,
        width: '100%',
        maxWidth: 320,
        gap: spacing.sm,
    },
    enableButtonText: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.lg,
        color: colors.primaryForeground,
    },
});
