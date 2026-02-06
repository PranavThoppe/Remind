import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfDay, isSameDay, isToday, addDays, startOfWeek, endOfWeek, isAfter, isBefore, addWeeks, isTomorrow, subWeeks } from 'date-fns';
import { ReminderCard } from '../../components/ReminderCard';
import { DaySection } from '../../components/DaySection';
import { EmptyState } from '../../components/EmptyState';
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { WeekForecast } from '../../components/WeekForecast';
import { SortSelector } from '../../components/SortSelector';
import CalendarView from '../../components/CalendarView';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { Reminder } from '../../types/reminder';
import { useReminders } from '../../hooks/useReminders';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { AnimatedViewSelector } from '../../components/AnimatedViewSelector';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const { reminders, loading, addReminder, toggleComplete, refreshReminders, updateReminder, deleteReminder, hasFetched } = useReminders();
  const { tags, priorities, lastViewMode: viewMode, setLastViewMode: setViewMode, lastSortMode: sortMode, setLastSortMode: setSortMode } = useSettings();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set());
  const [historyWeeks, setHistoryWeeks] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  // Show retry button if loading takes more than 5 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setShowRetry(true);
      }, 5000);
    } else {
      setShowRetry(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // Clear recently completed reminders when view mode or sort mode changes
  useEffect(() => {
    setRecentlyCompletedIds(new Set());
  }, [viewMode, sortMode]);

  // Show active reminders + recently completed ones + past history
  const activeReminders = useMemo(() => {
    return reminders.filter(r => {
      // Always show incomplete reminders
      if (!r.completed) {
        // Special logic for birthdays: only show if within 7 days
        const isBirthday = r.title.toLowerCase().includes('birthday');
        if (isBirthday && r.date) {
          const reminderDate = new Date(r.date + 'T00:00:00');
          const today = startOfDay(new Date());
          const nextWeek = addDays(today, 7);

          // If it's a birthday and not within the next 7 days (and not today/past), hide it
          if (isAfter(reminderDate, nextWeek)) {
            return false;
          }
        }
        return true;
      }

      // Show recently completed reminders
      if (recentlyCompletedIds.has(r.id)) return true;

      // Show history if requested
      if (historyWeeks > 0 && r.date) {
        const reminderDate = new Date(r.date + 'T00:00:00');
        const today = startOfDay(new Date());
        const historyStart = subWeeks(today, historyWeeks);
        // Show if in history range and strictly before today (since today is active)
        if (reminderDate >= historyStart && reminderDate < today) {
          return true;
        }
      }

      return false;
    });
  }, [reminders, recentlyCompletedIds, historyWeeks]);

  // Group active reminders by day or tag
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
            // Primary sort by date
            const dateA = a.date ? new Date(a.date + 'T00:00:00').getTime() : Infinity;
            const dateB = b.date ? new Date(b.date + 'T00:00:00').getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;

            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time) return -1;
            if (b.time) return 1;
            return 0;
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
          // Find actual priorities to compare rank
          const pA = priorities.find(p => p.id === a.id);
          const pB = priorities.find(p => p.id === b.id);
          return (pA?.rank || 0) - (pB?.rank || 0);
        })
        .map(group => ({
          ...group,
          reminders: [...group.reminders].sort((a, b) => {
            // Primary sort by date
            const dateA = a.date ? new Date(a.date + 'T00:00:00').getTime() : Infinity;
            const dateB = b.date ? new Date(b.date + 'T00:00:00').getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;

            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time) return -1;
            if (b.time) return 1;
            return 0;
          })
        }));
    }

    // Default: Sort by date (Time Sort)
    const groups: Group[] = [];
    const withDate = activeReminders.filter(r => r.date);
    const withoutDate = activeReminders.filter(r => !r.date);

    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
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

      // Determine which group this belongs to
      let groupId: string;
      let groupDate: Date | undefined = reminderDate;
      let groupTitle: string | undefined = undefined;

      if (isBefore(reminderDate, today)) {
        if (isSameDay(reminderDate, addDays(today, -1))) {
          groupId = 'yesterday';
          groupTitle = 'Yesterday';
          groupDate = undefined;
        } else if (reminderDate >= lastWeekStart && reminderDate <= lastWeekEnd) {
          groupId = 'last-week';
          groupTitle = 'Last Week';
          groupDate = undefined;
        } else {
          groupId = 'older';
          groupTitle = 'Older';
          groupDate = undefined;
        }
      } else if (isToday(reminderDate) || isTomorrow(reminderDate) || isBefore(reminderDate, nextWeekStart)) {
        // Individual days for Today, Tomorrow, and anything else this week
        groupId = reminderDate.toISOString();
      } else if (reminderDate >= nextWeekStart && reminderDate <= nextWeekEnd) {
        // Group everything in next week together
        groupId = 'next-week';
        groupDate = undefined; // Don't use date label logic in DaySection
        groupTitle = 'Next Week';
      } else {
        // Group everything after next week into "Future"
        groupId = 'future';
        groupDate = undefined;
        groupTitle = 'Future';
      }

      const existingGroup = groups.find(g => g.id === groupId);
      if (existingGroup) {
        existingGroup.reminders.push(reminder);
      } else {
        groups.push({
          id: groupId,
          date: groupDate,
          title: groupTitle,
          reminders: [reminder]
        });
      }
    });

    if (withoutDate.length > 0) {
      const sortedWithoutDate = [...withoutDate].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });
      groups.push({ id: 'anytime', title: 'Anytime', reminders: sortedWithoutDate });
    }

    return groups;
  }, [activeReminders, sortMode, tags, colors.mutedForeground]);

  const handleComplete = (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
      // If completing a reminder, add it to recently completed
      if (!reminder.completed) {
        setRecentlyCompletedIds(prev => new Set(prev).add(id));
      }

      toggleComplete(id, reminder.completed);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteReminder(id);
  };

  const handleSave = async (data: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => {
    let result;
    if (editingReminder) {
      result = await updateReminder(editingReminder.id, data);
    } else {
      result = await addReminder(data);
    }
    setEditingReminder(null);
    return result;
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingReminder(null);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Initial scroll to Today (only if we have history loaded)
  useEffect(() => {
    if (!loading && reminders.length > 0 && !hasInitialScrolled && viewMode === 'list' && sortMode === 'time' && historyWeeks > 0) {
      // Find today or the first group that isn't in the past
      const targetGroupIndex = groupedReminders.findIndex(g => {
        if (g.date) {
          return isToday(g.date) || isAfter(g.date, startOfDay(new Date()));
        }
        return g.id === 'anytime' || g.id === 'future' || g.id === 'next-week';
      });

      if (targetGroupIndex !== -1 && targetGroupIndex > 0) {
        const timer = setTimeout(() => {
          if (flatListRef.current) {
            try {
              flatListRef.current.scrollToIndex({
                index: targetGroupIndex,
                animated: false,
              });
              setHasInitialScrolled(true);
            } catch (err) {
              // Fail silently, likely not layouted yet
            }
          }
        }, 250);
        return () => clearTimeout(timer);
      } else {
        setHasInitialScrolled(true);
      }
    } else if (!loading && historyWeeks === 0) {
      setHasInitialScrolled(true);
    }
  }, [loading, reminders.length, viewMode, sortMode, groupedReminders, hasInitialScrolled, historyWeeks]);

  const formatDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.dateText}>{formatDate()}</Text>
            <Text style={styles.greeting}>{greeting()}</Text>
          </View>

          {/* View Mode Selector */}
          <AnimatedViewSelector
            currentView={viewMode}
            onViewChange={setViewMode}
          />
        </View>
      </View>

      {/* Content */}
      {!hasFetched ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          {showRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refreshReminders()}
            >
              <Text style={styles.retryText}>Taking too long? Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : activeReminders.length === 0 ? (
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
      ) : viewMode === 'week' ? (
        <ScrollView
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
        >
          <WeekForecast
            reminders={activeReminders}
            onReminderClick={handleEdit}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        </ScrollView>
      ) : viewMode === 'calendar' ? (
        <CalendarView />
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedReminders}
          keyExtractor={(item) => item.id}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          }}
          renderItem={({ item, index: groupIndex }) => {
            const startIndex = groupedReminders
              .slice(0, groupIndex)
              .reduce((acc, g) => acc + g.reminders.length, 0);

            const isAnytime = item.id === 'anytime';

            if (isAnytime && sortMode === 'time') {
              return (
                <View style={styles.anytimeSection}>
                  {groupIndex === 0 && (
                    <View style={styles.headerRow}>
                      <SortSelector
                        currentSort={sortMode}
                        onSortChange={setSortMode}
                      />
                    </View>
                  )}
                  <View style={styles.remindersList}>
                    {item.reminders.map((reminder: Reminder, index: number) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        onComplete={handleComplete}
                        onEdit={handleEdit}
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
                onEdit={handleEdit}
                onDelete={handleDelete}
                startIndex={startIndex}
                onSortChange={setSortMode as any}
                currentSort={sortMode}
                showSort={
                  groupIndex === 0
                }
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

      {/* Floating Add Button */}
      <FloatingAddButton
        onPress={() => setIsSheetOpen(true)}
      />

      {/* Add/Edit Sheet */}
      <AddReminderSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        onSave={handleSave}
        editReminder={editingReminder}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  greeting: {
    fontFamily: typography.fontFamily.title,
    fontSize: typography.fontSize['3xl'],
    color: colors.foreground,
    marginTop: 2,
    fontWeight: '600' as any,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}10`,
  },
  retryText: {
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  anytimeSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  remindersList: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
