import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface SortSelectorProps {
    currentSort: 'time' | 'tag' | 'priority';
    onSortChange: (mode: 'time' | 'tag' | 'priority') => void;
}

export const SortSelector = ({ currentSort, onSortChange }: SortSelectorProps) => {
    const { colors } = useTheme();

    const handleSortPress = (mode: 'time' | 'tag' | 'priority') => {
        onSortChange(mode);
    };

    return (
        <View style={styles.outerContainer}>
            <View style={[styles.container, { backgroundColor: colors.muted }]}>
                <View style={styles.optionsContainer}>
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
                            size={18}
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
                            size={18}
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
                            size={18}
                            color={currentSort === 'priority' ? colors.primary : colors.mutedForeground}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    container: {
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    optionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sortOption: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
});
