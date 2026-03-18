import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import {
    View,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Animated,
    LayoutAnimation,
} from 'react-native';
import { useReminders } from '../../hooks/useReminders';
import { useTheme } from '../../hooks/useTheme';
import { useUI } from '../../contexts/UIContext';
import { WeekForecast } from '../../components/WeekForecast';
import { MainHeader } from '../../components/MainHeader';
import { spacing } from '../../constants/theme';

export default function WeekScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { openEditSheet } = useUI();
    const { reminders, loading, refreshReminders, hasFetched, searchReminders, toggleComplete, deleteReminder } = useReminders();

    // Search State (Same as index.tsx for consistency)
    const [isSearching, setIsSearching] = useState(false);
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const activeReminders = useMemo(() => {
        if (isSearching && searchQuery.trim().length > 0) {
            return searchResults;
        }
        return reminders;
    }, [reminders, isSearching, searchQuery, searchResults]);

    const toggleSearch = () => {
        if (isSearching) {
            Animated.timing(searchExpandAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
                setIsSearching(false);
                setSearchQuery('');
                setSearchResults([]);
                setSearchAnswer(null);
            });
        } else {
            setIsSearching(true);
            Animated.timing(searchExpandAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
        }
    };

    const handleSearchTextChange = (text: string) => {
        setSearchQuery(text);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!text.trim()) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSearchResults([]);
            setSearchAnswer(null);
            return;
        }
        setIsSearchLoading(true);
        searchDebounceRef.current = setTimeout(async () => {
            const response = await searchReminders(text);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            if (!response.error) {
                setSearchResults(response.evidence || []);
                setSearchAnswer(response.answer || null);
            }
            setIsSearchLoading(false);
        }, 600);
    };

    return (
        <View style={styles.container}>
            <MainHeader
                isSearching={isSearching}
                searchQuery={searchQuery}
                onSearchChange={handleSearchTextChange}
                onToggleSearch={toggleSearch}
                isSearchLoading={isSearchLoading}
                searchAnswer={searchAnswer}
                searchExpandAnim={searchExpandAnim}
            />

            {!hasFetched ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={refreshReminders}
                            colors={[colors.primary]}
                        />
                    }
                >
                    <WeekForecast
                        reminders={activeReminders}
                        onReminderClick={openEditSheet}
                        onComplete={(id) => {
                            const r = reminders.find(rem => rem.id === id);
                            if (r) toggleComplete(id, r.completed);
                        }}
                        onDelete={deleteReminder}
                    />
                </ScrollView>
            )}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
});
