import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    LayoutAnimation,
} from 'react-native';
import { startOfDay, isSameDay, isToday, addDays, startOfWeek, endOfWeek, isAfter, isBefore, addWeeks, isTomorrow, subWeeks, format } from 'date-fns';
import { ReminderCard } from '../../components/ReminderCard';
import { DaySection } from '../../components/DaySection';
import { EmptyState } from '../../components/EmptyState';
import { SortSelector } from '../../components/SortSelector';
import { MainHeader } from '../../components/MainHeader';
import { SearchResults } from '../../components/SearchResults';
import { spacing, typography } from '../../constants/theme';
import { Reminder } from '../../types/reminder';
import { useReminders } from '../../hooks/useReminders';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { useUI } from '../../contexts/UIContext';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from 'react-native-gesture-handler';

export default function ListScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { openEditSheet } = useUI();
    const {
        reminders,
        loading,
        toggleComplete,
        refreshReminders,
        deleteReminder,
        hasFetched,
        searchReminders,
        updateReminder
    } = useReminders();

    const {
        tags,
        priorities,
        lastSortMode: sortMode,
        setLastSortMode: setSortMode
    } = useSettings();

    // Search State
    const [isSearching, setIsSearching] = useState(false);
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Reminder[]>([]);
    const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const [showRetry, setShowRetry] = useState(false);
    const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set());
    const [historyWeeks, setHistoryWeeks] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

    // Show retry button if loading takes more than 5 seconds
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (loading) {
            timer = setTimeout(() => setShowRetry(true), 5000);
        } else {
            setShowRetry(false);
        }
        return () => clearTimeout(timer);
    }, [loading]);

    // Clear recently completed reminders when sort mode changes
    useEffect(() => {
        setRecentlyCompletedIds(new Set());
    }, [sortMode]);

    const activeReminders = useMemo(() => {
        return reminders.filter(r => {
            if (!r.completed) {
                const isBirthday = r.title.toLowerCase().includes('birthday');
                if (isBirthday && r.date) {
                    const reminderDate = new Date(r.date + 'T00:00:00');
                    const today = startOfDay(new Date());
                    const nextWeek = addDays(today, 7);
                    if (isAfter(reminderDate, nextWeek)) return false;
                }
                return true;
            }
            if (recentlyCompletedIds.has(r.id)) return true;
            if (historyWeeks > 0 && r.date) {
                const reminderDate = new Date(r.date + 'T00:00:00');
                const today = startOfDay(new Date());
                const historyStart = subWeeks(today, historyWeeks);
                if (reminderDate >= historyStart && reminderDate < today) return true;
            }
            return false;
        });
    }, [reminders, recentlyCompletedIds, historyWeeks]);

    const groupedReminders = useMemo(() => {
        interface Group {
            id: string;
            title?: string;
            headerColor?: string;
            date?: Date;
            reminders: Reminder[];
        }

        if (sortMode === 'tag') {
            const tagGroups: Map<string, Group> = new Map();
            activeReminders.forEach(reminder => {
                const tag = tags.find(t => t.id === reminder.tag_id);
                const tagId = tag?.id || 'none';
                if (!tagGroups.has(tagId)) {
                    tagGroups.set(tagId, {
                        id: tagId,
                        title: tag?.name || 'Untagged',
                        headerColor: tag?.color || colors.mutedForeground,
                        reminders: []
                    });
                }
                tagGroups.get(tagId)!.reminders.push(reminder);
            });

            return Array.from(tagGroups.values())
                .sort((a, b) => {
                    if (a.id === 'none') return 1;
                    if (b.id === 'none') return -1;
                    return (a.title || '').localeCompare(b.title || '');
                })
                .map(group => ({
                    ...group,
                    reminders: [...group.reminders].sort((a, b) => {
                        const dateA = a.date ? new Date(a.date + 'T00:00:00').getTime() : Infinity;
                        const dateB = b.date ? new Date(b.date + 'T00:00:00').getTime() : Infinity;
                        if (dateA !== dateB) return dateA - dateB;
                        if (a.time && b.time) return a.time.localeCompare(b.time);
                        return a.time ? -1 : (b.time ? 1 : 0);
                    })
                }));
        }

        if (sortMode === 'priority') {
            const priorityGroups: Map<string, Group> = new Map();

            activeReminders.forEach(reminder => {
                const priority = priorities.find(p => p.id === reminder.priority_id);
                const priorityId = priority?.id || 'none';

                if (!priorityGroups.has(priorityId)) {
                    priorityGroups.set(priorityId, {
                        id: priorityId,
                        title: priority?.name || 'No Priority',
                        headerColor: priority?.color || colors.mutedForeground,
                        reminders: []
                    });
                }
                priorityGroups.get(priorityId)!.reminders.push(reminder);
            });

            return Array.from(priorityGroups.values())
                .sort((a, b) => {
                    if (a.id === 'none') return 1;
                    if (b.id === 'none') return -1;
                    const pA = priorities.find(p => p.id === a.id);
                    const pB = priorities.find(p => p.id === b.id);
                    return (pA?.rank || 0) - (pB?.rank || 0);
                })
                .map(group => ({
                    ...group,
                    reminders: [...group.reminders].sort((a, b) => {
                        const dateA = a.date ? new Date(a.date + 'T00:00:00').getTime() : Infinity;
                        const dateB = b.date ? new Date(b.date + 'T00:00:00').getTime() : Infinity;
                        if (dateA !== dateB) return dateA - dateB;
                        if (a.time && b.time) return a.time.localeCompare(b.time);
                        return a.time ? -1 : (b.time ? 1 : 0);
                    })
                }));
        }

        const groups: Group[] = [];
        const withDate = activeReminders.filter(r => r.date);
        const withoutDate = activeReminders.filter(r => !r.date);
        const today = startOfDay(new Date());
        const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
        const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

        const sortedWithDate = [...withDate].sort((a, b) => {
            const dateA = new Date(a.date! + 'T00:00:00').getTime();
            const dateB = new Date(b.date! + 'T00:00:00').getTime();
            if (dateA !== dateB) return dateA - dateB;
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });

        sortedWithDate.forEach(reminder => {
            const reminderDate = startOfDay(new Date(reminder.date! + 'T00:00:00'));
            let groupId: string;
            let groupDate: Date | undefined = reminderDate;
            let groupTitle: string | undefined = undefined;

            if (isBefore(reminderDate, today)) {
                if (isSameDay(reminderDate, addDays(today, -1))) { groupId = 'yesterday'; groupTitle = 'Yesterday'; groupDate = undefined; }
                else if (reminderDate >= lastWeekStart && reminderDate <= lastWeekEnd) { groupId = 'last-week'; groupTitle = 'Last Week'; groupDate = undefined; }
                else { groupId = 'older'; groupTitle = 'Older'; groupDate = undefined; }
            } else if (isToday(reminderDate) || isTomorrow(reminderDate)) {
                groupId = reminderDate.toISOString();
            } else if (isBefore(reminderDate, nextWeekStart)) {
                groupId = 'this-week'; groupDate = undefined; groupTitle = 'This Week';
            } else if (reminderDate >= nextWeekStart && reminderDate <= nextWeekEnd) {
                groupId = 'next-week'; groupDate = undefined; groupTitle = 'Next Week';
            } else {
                groupId = 'future'; groupDate = undefined; groupTitle = 'Future';
            }

            const existingGroup = groups.find(g => g.id === groupId);
            if (existingGroup) existingGroup.reminders.push(reminder);
            else groups.push({ id: groupId, date: groupDate, title: groupTitle, reminders: [reminder] });
        });

        if (withoutDate.length > 0) {
            groups.push({ id: 'anytime', title: 'Anytime', reminders: [...withoutDate].sort((a, b) => (a.time && b.time) ? a.time.localeCompare(b.time) : 0) });
        }
        return groups;
    }, [activeReminders, sortMode, tags, priorities, colors.mutedForeground, colors.primary]);

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

    const handleComplete = (id: string) => {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
            if (!reminder.completed) setRecentlyCompletedIds(prev => new Set(prev).add(id));
            toggleComplete(id, reminder.completed);
        }
    };

    const handleDelete = async (eventOrId: string | Reminder) => {
        if (typeof eventOrId === 'string') {
            await deleteReminder(eventOrId);
        } else {
            const event = eventOrId;
            if (event.isGhost && event.date) {
                const ghostDate = new Date(event.date + 'T00:00:00');
                const dayBefore = new Date(ghostDate.getTime() - 24 * 60 * 60 * 1000);
                // Important: using the internal updateReminder from useReminders
                await updateReminder(event.id, { repeat_until: format(dayBefore, 'yyyy-MM-dd') });
            } else {
                await deleteReminder(event.id);
            }
        }
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
                    onComplete={handleComplete}
                    onEdit={openEditSheet}
                    onDelete={handleDelete as any}
                />
            ) : (
                <View style={{ flex: 1 }}>
                    {activeReminders.length === 0 ? (
                        <View style={{ flex: 1 }}>
                            <EmptyState type="active" />
                            <FlatList
                                data={[]}
                                renderItem={null}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={loading}
                                        onRefresh={async () => {
                                            await refreshReminders();
                                            setHistoryWeeks(prev => prev + 1);
                                        }}
                                        colors={[colors.primary]}
                                    />
                                }
                            />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={groupedReminders}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item, index: groupIndex }) => {
                                const startIndex = groupedReminders
                                    .slice(0, groupIndex)
                                    .reduce((acc, g) => acc + g.reminders.length, 0);

                                if (item.id === 'anytime' && sortMode === 'time') {
                                    return (
                                        <View style={styles.anytimeSection}>
                                            {groupIndex === 0 && (
                                                <View style={styles.headerRow}>
                                                    <SortSelector currentSort={sortMode} onSortChange={setSortMode} />
                                                </View>
                                            )}
                                            <View style={styles.remindersList}>
                                                {item.reminders.map((reminder: Reminder, index: number) => (
                                                    <ReminderCard
                                                        key={reminder.id}
                                                        reminder={reminder}
                                                        onComplete={handleComplete}
                                                        onEdit={openEditSheet}
                                                        onDelete={handleDelete}
                                                        index={startIndex + index}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                    );
                                }

                                return (
                                    <DaySection
                                        date={(item as any).date}
                                        title={(item as any).title}
                                        headerColor={(item as any).headerColor}
                                        reminders={item.reminders}
                                        onComplete={handleComplete}
                                        onEdit={openEditSheet}
                                        onDelete={handleDelete}
                                        startIndex={startIndex}
                                        onSortChange={setSortMode as any}
                                        currentSort={sortMode}
                                        showSort={groupIndex === 0}
                                    />
                                );
                            }}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={loading}
                                    onRefresh={async () => {
                                        await refreshReminders();
                                        setHistoryWeeks(prev => prev + 1);
                                    }}
                                    colors={[colors.primary]}
                                />
                            }
                        />
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
    anytimeSection: { marginBottom: spacing.xl },
    remindersList: { gap: spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});
