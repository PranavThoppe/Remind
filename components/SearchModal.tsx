import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Keyboard,
    Platform,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reminder } from '../types/reminder';
import { useReminders } from '../hooks/useReminders';
import { useTheme } from '../hooks/useTheme';
import { ReminderCard } from './ReminderCard';
import { spacing, typography, borderRadius } from '../constants/theme';

interface SearchModalProps {
    isVisible: boolean;
    onClose: () => void;
    onEditReminder: (reminder: Reminder) => void;
    onCompleteReminder: (id: string) => void;
    onDeleteReminder: (id: string) => void;
}

export function SearchModal({
    isVisible,
    onClose,
    onEditReminder,
    onCompleteReminder,
    onDeleteReminder
}: SearchModalProps) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
    const insets = useSafeAreaInsets();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Reminder[]>([]);
    const [answer, setAnswer] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const { searchReminders } = useReminders();
    const inputRef = useRef<TextInput>(null);
    const debounceTimerIdx = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isVisible) {
            // Focus after a short delay to allow modal animation
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            setQuery('');
            setResults([]);
            setAnswer(null);
            setHasSearched(false);
        }
    }, [isVisible]);

    const handleSearch = async (text: string) => {
        setQuery(text);

        if (debounceTimerIdx.current) {
            clearTimeout(debounceTimerIdx.current);
        }

        if (!text.trim()) {
            setResults([]);
            setAnswer(null);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        debounceTimerIdx.current = setTimeout(async () => {
            const response = await searchReminders(text);

            if (response.error) {
                // Handle error gracefully
                console.error(response.error);
            } else {
                setResults(response.evidence || []);
                setAnswer(response.answer || null);
                setHasSearched(true);
            }
            setLoading(false);
        }, 600); // 600ms debounce
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.searchBarContainer}>
                        <Ionicons name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
                        <TextInput
                            ref={inputRef}
                            style={styles.searchInput}
                            placeholder="Search reminders..."
                            placeholderTextColor={colors.mutedForeground}
                            value={query}
                            onChangeText={handleSearch}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                        {query.length > 0 && Platform.OS === 'android' && (
                            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearButton}>
                                <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Searching...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={
                            answer ? (
                                <View style={styles.answerContainer}>
                                    <View style={styles.answerHeader}>
                                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                                        <Text style={styles.answerTitle}>AI Answer</Text>
                                    </View>
                                    <Text style={styles.answerText}>{answer}</Text>
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            hasSearched && query.trim().length > 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
                                    <Text style={styles.emptyText}>No reminders found for "{query}"</Text>
                                    <Text style={styles.emptySubtext}>Try searching for a different keyword or date.</Text>
                                </View>
                            ) : (
                                !hasSearched ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="bulb-outline" size={48} color={colors.primary} />
                                        <Text style={styles.emptyText}>Ask Nova anything</Text>
                                        <Text style={styles.emptySubtext}>"What do I have tomorrow?"</Text>
                                        <Text style={styles.emptySubtext}>"Show me my gym reminders"</Text>
                                        <Text style={styles.emptySubtext}>"Any birthdays this month?"</Text>
                                    </View>
                                ) : null
                            )
                        }
                        renderItem={({ item, index }) => (
                            <View style={styles.cardWrapper}>
                                <ReminderCard
                                    reminder={item}
                                    onComplete={onCompleteReminder}
                                    onEdit={(r) => {
                                        onClose(); // Close search modal when navigating to edit
                                        onEditReminder(r);
                                    }}
                                    onDelete={onDeleteReminder}
                                    index={index}
                                />
                            </View>
                        )}
                    />
                )}
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? '#27272a' : '#f4f4f5', // Zinc-800 / Zinc-100
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        height: 40,
        marginRight: spacing.sm,
    },
    searchIcon: {
        marginRight: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
        paddingVertical: 0, // Fix alignment on Android
        height: '100%',
    },
    clearButton: {
        padding: 4,
    },
    cancelButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    cancelText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    loadingText: {
        fontFamily: typography.fontFamily.regular,
        color: colors.mutedForeground,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100, // Safe area
    },
    cardWrapper: {
        marginBottom: spacing.md,
    },
    answerContainer: {
        backgroundColor: `${colors.primary}15`, // Low opacity primary
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: `${colors.primary}30`,
    },
    answerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
        gap: spacing.xs,
    },
    answerTitle: {
        fontFamily: typography.fontFamily.semibold, // Corrected from semiBold to semibold
        fontSize: typography.fontSize.xs,
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    answerText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
        lineHeight: 22,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    emptyText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.lg,
        color: colors.foreground,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    emptySubtext: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 22,
    },
});
