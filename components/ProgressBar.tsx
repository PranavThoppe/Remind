import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { borderRadius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface ProgressBarProps {
    currentStep: number;
    totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
    const { colors } = useTheme();
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withSpring(currentStep / totalSteps, {
            damping: 20,
            stiffness: 90,
        });
    }, [currentStep, totalSteps]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value * 100}%`,
        };
    });

    const styles = createStyles(colors);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.fill, animatedStyle]} />
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        height: 8,
        backgroundColor: colors.muted,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
        width: '100%',
        marginVertical: spacing.md,
    },
    fill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
    },
});
