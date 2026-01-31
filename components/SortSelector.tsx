import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';

interface SortSelectorProps {
    currentSort: 'time' | 'tag' | 'priority';
    onSortChange: (mode: 'time' | 'tag' | 'priority') => void;
}

export const SortSelector = ({ currentSort, onSortChange }: SortSelectorProps) => {
    const { colors } = useTheme();
    const { isSortExpanded, setIsSortExpanded } = useSettings();
    const animation = useRef(new Animated.Value(isSortExpanded ? 1 : 0)).current;

    // Animate when the global expansion state changes
    useEffect(() => {
        Animated.spring(animation, {
            toValue: isSortExpanded ? 1 : 0,
            useNativeDriver: false,
            friction: 8,
            tension: 45,
        }).start();
    }, [isSortExpanded]);

    const toggleExpand = () => {
        setIsSortExpanded(!isSortExpanded);
    };

    const handleSortPress = (mode: 'time' | 'tag' | 'priority') => {
        onSortChange(mode);
        // Note: We intentionally don't call toggleExpand() here as per user request
    };

    const width = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [32, 140],
    });

    const contentOpacity = animation.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [0, 0, 1],
    });

    const dotsOpacity = animation.interpolate({
        inputRange: [0, 0.3],
        outputRange: [1, 0],
    });

    const rotate = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '90deg'],
    });

    return (
        <View style={styles.outerContainer}>
            <Animated.View
                style={[
                    styles.container,
                    {
                        width,
                        backgroundColor: isSortExpanded ? colors.muted : 'transparent',
                    }
                ]}
            >
                {!isSortExpanded ? (
                    <Animated.View style={{ opacity: dotsOpacity, transform: [{ rotate }] }}>
                        <TouchableOpacity
                            onPress={toggleExpand}
                            style={styles.dotsButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View style={[styles.optionsContainer, { opacity: contentOpacity }]}>
                        <TouchableOpacity
                            onPress={() => handleSortPress('time')}
                            style={[
                                styles.sortOption,
                                currentSort === 'time' && { backgroundColor: colors.card, ...styles.shadow }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'time' ? "time" : "time-outline"}
                                size={16}
                                color={currentSort === 'time' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSortPress('tag')}
                            style={[
                                styles.sortOption,
                                currentSort === 'tag' && { backgroundColor: colors.card, ...styles.shadow }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'tag' ? "pricetag" : "pricetag-outline"}
                                size={16}
                                color={currentSort === 'tag' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSortPress('priority')}
                            style={[
                                styles.sortOption,
                                currentSort === 'priority' && { backgroundColor: colors.card, ...styles.shadow }
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={currentSort === 'priority' ? "flag" : "flag-outline"}
                                size={16}
                                color={currentSort === 'priority' ? colors.primary : colors.mutedForeground}
                            />
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            onPress={toggleExpand}
                            style={styles.closeButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        height: 32,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    container: {
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotsButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        width: 140,
        justifyContent: 'space-between',
    },
    sortOption: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shadow: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginHorizontal: 2,
    },
    closeButton: {
        width: 20,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
