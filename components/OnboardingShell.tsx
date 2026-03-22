import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { ProgressBar } from './ProgressBar';

export interface OnboardingShellProps {
    children: React.ReactNode;
    currentStep: number;
    totalSteps: number;
    onNext?: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    showBack?: boolean;
    showSkip?: boolean;
    showNext?: boolean;
    nextLabel?: string;
    hideActionBar?: boolean;
}

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
    children,
    currentStep,
    totalSteps,
    onNext,
    onBack,
    onSkip,
    showBack = true,
    showSkip = true,
    showNext = true,
    nextLabel = 'Next',
    hideActionBar = false,
}) => {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
            <View style={styles.header}>
                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
            </View>

            <Animated.View
                style={styles.content}
                entering={FadeIn.delay(150).duration(400)}
            >
                {children}
            </Animated.View>

            {!hideActionBar && (
                <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                    <View style={styles.leftActions}>
                        {showBack && (
                            <TouchableOpacity onPress={onBack} style={styles.iconButton}>
                                <Ionicons name="chevron-back" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.rightActions}>
                        {showSkip && (
                            <TouchableOpacity onPress={onSkip} style={styles.textButton}>
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>
                        )}

                        {showNext && (
                            <TouchableOpacity onPress={onNext} style={styles.primaryButton}>
                                <Text style={styles.primaryButtonText}>{nextLabel}</Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.primaryForeground} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    content: {
        flex: 1,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    leftActions: {
        flex: 1,
        alignItems: 'flex-start',
    },
    rightActions: {
        flex: 2,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing.lg,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.muted,
    },
    textButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    skipText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
    },
    primaryButtonText: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.base,
        color: colors.primaryForeground,
    },
});
