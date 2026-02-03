import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, ImageSourcePropType, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography, borderRadius } from '../constants/theme';

type ViewMode = 'list' | 'week' | 'calendar';

interface AnimatedViewSelectorProps {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
}

interface ViewOption {
    mode: ViewMode;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
    image: ImageSourcePropType;
}

const viewOptions: ViewOption[] = [
    {
        mode: 'list',
        label: 'List',
        icon: 'list',
        description: 'Organized by date',
        image: require('../assets/List.jpeg'),
    },
    {
        mode: 'week',
        label: 'Week',
        icon: 'calendar-outline',
        description: '7-day forecast',
        image: require('../assets/Week.jpeg'),
    },
    {
        mode: 'calendar',
        label: 'Calendar',
        icon: 'calendar',
        description: 'Monthly view',
        image: require('../assets/Cal.jpeg'),
    },
];

export const AnimatedViewSelector: React.FC<AnimatedViewSelectorProps> = ({
    currentView,
    onViewChange,
}) => {
    const { colors } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const expandProgress = useSharedValue(0);

    const toggleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        expandProgress.value = withSpring(newState ? 1 : 0, {
            damping: 15,
            stiffness: 150,
        });
    };

    const handleSelectView = (mode: ViewMode) => {
        onViewChange(mode);
        // Delay collapse slightly to show selection
        setTimeout(() => {
            setIsExpanded(false);
            expandProgress.value = withSpring(0, {
                damping: 15,
                stiffness: 150,
            });
        }, 200);
    };

    // Animated styles for the main button
    const mainButtonStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            expandProgress.value,
            [0, 1],
            [1, 0.9],
            Extrapolate.CLAMP
        );
        const rotate = interpolate(
            expandProgress.value,
            [0, 1],
            [0, 180],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ scale }, { rotate: `${rotate}deg` }],
        };
    });

    // Animated styles for the options container
    const optionsContainerStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            expandProgress.value,
            [0, 0.3, 1],
            [0, 0, 1],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            expandProgress.value,
            [0, 1],
            [-20, 0],
            Extrapolate.CLAMP
        );

        return {
            opacity,
            transform: [{ translateY }],
            pointerEvents: expandProgress.value > 0.5 ? 'auto' : 'none',
        };
    });

    return (
        <>
            <View style={styles.container}>
                {/* Main Toggle Button */}
                <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7}>
                    <Animated.View
                        style={[
                            styles.mainButton,
                            { backgroundColor: colors.muted },
                            mainButtonStyle,
                        ]}
                    >
                        <Ionicons
                            name={isExpanded ? 'close' : 'apps'}
                            size={20}
                            color={colors.foreground}
                        />
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {/* Modal Backdrop - Covers entire screen when expanded */}
            <Modal
                visible={isExpanded}
                transparent={true}
                animationType="none"
                statusBarTranslucent={true}
                onRequestClose={toggleExpand}
            >
                <View style={styles.modalWrapper}>
                    {/* Backdrop that closes on tap */}
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={toggleExpand}
                    />

                    {/* Options Container - positioned absolutely, rendered above backdrop */}
                    <View style={styles.modalContent} pointerEvents="box-none">
                        <Animated.View
                            style={[
                                styles.optionsContainer,
                                { backgroundColor: colors.card },
                                optionsContainerStyle,
                            ]}
                        >
                            {viewOptions.map((option, index) => {
                                const isSelected = currentView === option.mode;

                                // Individual card animation
                                const cardAnimatedStyle = useAnimatedStyle(() => {
                                    const delay = index * 0.1;
                                    const cardProgress = interpolate(
                                        expandProgress.value,
                                        [0, 0.5 + delay, 1],
                                        [0, 0, 1],
                                        Extrapolate.CLAMP
                                    );
                                    const scale = interpolate(
                                        cardProgress,
                                        [0, 1],
                                        [0.8, 1],
                                        Extrapolate.CLAMP
                                    );

                                    return {
                                        opacity: cardProgress,
                                        transform: [{ scale }],
                                    };
                                });

                                return (
                                    <Animated.View key={option.mode} style={cardAnimatedStyle}>
                                        <TouchableOpacity
                                            onPress={() => handleSelectView(option.mode)}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.optionCard,
                                                {
                                                    backgroundColor: isSelected
                                                        ? colors.primary
                                                        : colors.muted,
                                                    borderColor: isSelected
                                                        ? colors.primary
                                                        : colors.border,
                                                },
                                            ]}
                                        >
                                            <View style={styles.imageContainer}>
                                                <Image
                                                    source={option.image}
                                                    style={styles.previewImage}
                                                    resizeMode="cover"
                                                />
                                            </View>
                                            <View style={styles.labelContainer}>
                                                <Text
                                                    style={[
                                                        styles.optionLabel,
                                                        {
                                                            color: isSelected
                                                                ? colors.primaryForeground
                                                                : colors.foreground,
                                                        },
                                                    ]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    </Animated.View>
                                );
                            })}
                        </Animated.View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 1000,
    },
    mainButton: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalWrapper: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    modalContent: {
        position: 'absolute',
        top: 50,
        right: spacing.xl,
    },
    optionsContainer: {
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        flexDirection: 'row',
        gap: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    optionCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    imageContainer: {
        width: 60,
        height: 60,
    },
    labelContainer: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    optionLabel: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.xs,
    },
    optionDescription: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
    },
});
