import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface SuggestionChipsProps {
    suggestions: string[];
    onSelectSuggestion: (suggestion: string) => void;
    isGenerating?: boolean;
    colors?: any; // Pass theme colors down from parent
}

export function SuggestionChips({ suggestions, onSelectSuggestion, isGenerating, colors }: SuggestionChipsProps) {
    if (suggestions.length === 0) {
        return null;
    }

    // Base styles using theme colors if available, otherwise fallbacks
    const bgColor = colors?.card || '#ffffff';
    const borderColor = colors?.primary || '#8a2be2'; // Purple fallback
    const textColor = colors?.foreground || '#444444';

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={styles.container}
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                        key={`${suggestion}-${index}`}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                            }
                        ]}
                        onPress={() => onSelectSuggestion(suggestion)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.chipText, { color: textColor }]}>{suggestion}</Text>
                    </TouchableOpacity>
                ))}

            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'flex-end',
    },
    scrollContent: {
        paddingHorizontal: 20, // Match PILL_HORIZONTAL_MARGIN from parents
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10, // Match pill feel more closely
        borderRadius: 20, // Match PILL_HEIGHT / 2 somewhat
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5, // Thicker border for the "purple border" request
    },
    loadingChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
    }
});
