import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface PremiumLockOverlayProps {
    onUnlock: () => void;
}

export function PremiumLockOverlay({ onUnlock }: PremiumLockOverlayProps) {
    const { colors, isDark } = useTheme();

    // Android Fallback: Native blur requires a rebuild. Use a translucent solid color instead.
    if (Platform.OS === 'android') {
        return (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]}>
                <View style={styles.fallbackContainer}>
                    <OverlayContent colors={colors} onUnlock={onUnlock} />
                </View>
            </View>
        );
    }

    return (
        <View style={StyleSheet.absoluteFill}>
            <BlurView
                intensity={20}
                tint={isDark ? 'dark' : 'light'}
                style={styles.blurContainer}
            >
                <OverlayContent colors={colors} onUnlock={onUnlock} />
            </BlurView>
        </View>
    );
}

function OverlayContent({ colors, onUnlock }: { colors: any, onUnlock: () => void }) {
    return (
        <View style={styles.contentContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="lock-closed" size={32} color={colors.gold} />
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
                Unlock Mind
            </Text>

            <Text style={[styles.description, { color: colors.mutedForeground }]}>
                Upgrade to Pro to access Mind's intelligent reminder creation and search functionality.
            </Text>

            <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.gold }]}
                onPress={onUnlock}
                activeOpacity={0.8}
            >
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                    Unlock Mind
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    blurContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    fallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    contentContainer: {
        alignItems: 'center',
        maxWidth: 300,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    description: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    button: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        minWidth: 160,
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.lg,
    },
});
