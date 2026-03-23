import * as React from 'react';
import { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Animated,
    LayoutAnimation,
} from 'react-native';
import { useReminders } from '../../hooks/useReminders';
import { useTheme } from '../../hooks/useTheme';
import { useUI } from '../../contexts/UIContext';
import CalendarView from '../../components/CalendarView';
import { MainHeader } from '../../components/MainHeader';
import { SearchResults } from '../../components/SearchResults';
import { spacing } from '../../constants/theme';

export default function CalendarScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { openEditSheet } = useUI();
    const { reminders, toggleComplete, deleteReminder, hasFetched, searchReminders } = useReminders();

    // Search State (Consistency across tabs)
    const [isSearching, setIsSearching] = useState(false);
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

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
            ) : isSearching && searchQuery.trim().length > 0 ? (
                <SearchResults
                    isSearching={isSearching}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    searchAnswer={searchAnswer}
                    onComplete={(id) => {
                        const r = reminders.find(rem => rem.id === id);
                        if (r) toggleComplete(id, r.completed);
                    }}
                    onEdit={openEditSheet}
                    onDelete={deleteReminder}
                />
            ) : (
                <View style={styles.content}>
                    <CalendarView onEdit={openEditSheet} />
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, paddingBottom: 60 }, // Extra padding for the tab bar
});
