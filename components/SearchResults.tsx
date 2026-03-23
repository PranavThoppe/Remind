import * as React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReminderCard } from './ReminderCard';
import { spacing, typography } from '../constants/theme';
import { Reminder } from '../types/reminder';
import { useTheme } from '../hooks/useTheme';

interface SearchResultsProps {
    isSearching: boolean;
    searchQuery: string;
    searchResults: Reminder[];
    searchAnswer: string | null;
    onComplete: (id: string) => void;
    onEdit: (reminder: Reminder, layout?: any) => void;
    onDelete: (id: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    isSearching,
    searchQuery,
    searchResults,
    searchAnswer,
    onComplete,
    onEdit,
    onDelete,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    if (!isSearching || !searchQuery.trim()) return null;

    const renderAnswer = () => {
        if (!searchAnswer) return null;
        return (
            <View style={styles.answerContainer}>
                <View style={styles.answerHeader}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                    <Text style={styles.answerTitle}>AI Answer</Text>
                </View>
                <Text style={styles.answerText}>{searchAnswer}</Text>
            </View>
        );
    };

    if (searchResults.length === 0) {
        return (
            <ScrollView contentContainerStyle={styles.emptySearchContainer}>
                {renderAnswer()}
                <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
                    <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyText}>No results found</Text>
                    <Text style={styles.emptySubtext}>Try searching for something else</Text>
                </View>
            </ScrollView>
        );
    }

    return (
        <FlatList
            ListHeaderComponent={renderAnswer()}
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
                <View style={styles.cardWrapper}>
                    <ReminderCard
                        key={item.id}
                        reminder={item}
                        onComplete={onComplete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        index={index}
                    />
                </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    answerContainer: {
        backgroundColor: `${colors.primary}15`,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: `${colors.primary}30`
    },
    answerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
        gap: spacing.xs
    },
    answerTitle: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: 12,
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    answerText: {
        fontFamily: typography.fontFamily.title,
        fontSize: 18,
        color: colors.foreground,
        lineHeight: 24
    },
    emptySearchContainer: {
        padding: spacing.xl,
        alignItems: 'stretch'
    },
    emptyText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 18,
        color: colors.foreground,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        textAlign: 'center'
    },
    emptySubtext: {
        fontFamily: typography.fontFamily.regular,
        fontSize: 16,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 22
    },
    listContent: {
        paddingHorizontal: spacing.xl,
        paddingBottom: 100
    },
    cardWrapper: {
        marginBottom: spacing.md
    }
});
