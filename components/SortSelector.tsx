import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
import { shadows } from '../constants/theme';

interface SortSelectorProps {
    currentSort: 'time' | 'tag' | 'priority';
    onSortChange: (mode: 'time' | 'tag' | 'priority') => void;
}

export const SortSelector = ({ currentSort, onSortChange }: SortSelectorProps) => {
    const { colors } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const expandProgress = useSharedValue(0);

    const toggleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        expandProgress.value = withSpring(newState ? 1 : 0, {
            damping: 20,
            stiffness: 250,
        });
    };

    const handleSortPress = (mode: 'time' | 'tag' | 'priority') => {
        onSortChange(mode);
        // Collapse after selection with a slight delay
        setTimeout(() => {
            setIsExpanded(false);
            expandProgress.value = withSpring(0, {
                damping: 20,
                stiffness: 250,
            });
        }, 150);
    };

    // Animated container style (width expansion)
    const containerStyle = useAnimatedStyle(() => {
        const width = interpolate(
            expandProgress.value,
            [0, 1],
            [32, 110], // Reduced from 40/120
            Extrapolate.CLAMP
        );

        return {
            width,
        };
    });

    // Style for the main 3-dots icon (fades out when expanded)
    const mainIconStyle = useAnimatedStyle(() => {
        const opacity = interpolate(expandProgress.value, [0, 0.5], [1, 0]);
        const scale = interpolate(expandProgress.value, [0, 0.5], [1, 0.5]);
        return {
            opacity,
            transform: [{ scale }],
            position: 'absolute',
            zIndex: expandProgress.value < 0.5 ? 1 : 0,
        };
    });

    // Style for the options container (fades in when expanded)
    const optionsStyle = useAnimatedStyle(() => {
        const opacity = interpolate(expandProgress.value, [0.5, 1], [0, 1]);
        const scale = interpolate(expandProgress.value, [0.5, 1], [0.8, 1]);
        return {
            opacity,
            transform: [{ scale }],
            flexDirection: 'row',
            gap: 4, // Reduced gap
            minWidth: 100, // Reduced minWidth
            justifyContent: 'center',
            alignItems: 'center',
        };
    });

    return (
        <View style={styles.outerContainer}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={toggleExpand}
                // Disable outer touch when expanded so inner buttons capture events
                disabled={isExpanded}
                style={{ zIndex: 10 }}
            >
                <Animated.View style={[
                    styles.container,
                    { backgroundColor: colors.muted },
                    containerStyle
                ]}>
                    {/* Collapsed State: 3 Dots */}
                    <Animated.View style={mainIconStyle}>
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={18} // Reduced icon size
                            color={colors.mutedForeground}
                        />
                    </Animated.View>

                    {/* Expanded State: Sort Options */}
                    <Animated.View style={optionsStyle}>
                        <TouchableOpacity
                            onPress={() => handleSortPress('time')}
                            style={[
                                styles.sortOption,
                                currentSort === 'time' && { backgroundColor: colors.card, ...shadows.soft }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'time' ? "time" : "time-outline"}
                                size={16} // Reduced option icon size
                                color={currentSort === 'time' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSortPress('tag')}
                            style={[
                                styles.sortOption,
                                currentSort === 'tag' && { backgroundColor: colors.card, ...shadows.soft }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'tag' ? "pricetag" : "pricetag-outline"}
                                size={16} // Reduced option icon size
                                color={currentSort === 'tag' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSortPress('priority')}
                            style={[
                                styles.sortOption,
                                currentSort === 'priority' && { backgroundColor: colors.card, ...shadows.soft }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'priority' ? "flag" : "flag-outline"}
                                size={16} // Reduced option icon size
                                color={currentSort === 'priority' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Close Area (optional overlay logic if needed, but for now exact tap to open) */}
                </Animated.View>
            </TouchableOpacity>

            {/* Back-drop to close when tapping outside (only when expanded) */}
            {isExpanded && (
                <TouchableOpacity
                    style={StyleSheet.absoluteFill} // This needs a parent relative container with size to work effectively or use Modal
                    onPress={toggleExpand}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        height: 32, // Reduced height
        justifyContent: 'center',
        alignItems: 'flex-end',
        // zIndex is handled by parent usually
    },
    container: {
        height: 32, // Reduced height
        borderRadius: 16, // Adjusted radius
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        paddingHorizontal: 2, // Reduced padding
    },
    sortOption: {
        width: 28, // Reduced option size
        height: 28, // Reduced option size
        borderRadius: 14, // Adjusted radius
        justifyContent: 'center',
        alignItems: 'center',
    },
    shadow: {
        ...shadows.soft
    },
});
