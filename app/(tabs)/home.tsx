import { useState, useEffect, useMemo } from 'react';
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
import { startOfDay, isSameDay, isToday } from 'date-fns';
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const { reminders, loading, addReminder, toggleComplete, refreshReminders, updateReminder, deleteReminder } = useReminders();
  const { tags, priorities, lastViewMode: viewMode, setLastViewMode: setViewMode, lastSortMode: sortMode, setLastSortMode: setSortMode } = useSettings();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showRetry, setShowRetry] = useState(false);

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

  const activeReminders = reminders.filter(r => !r.completed);

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

    const sortedWithDate = [...withDate].sort((a, b) => {
      const dateA = new Date(a.date! + 'T00:00:00').getTime();
      const dateB = new Date(b.date! + 'T00:00:00').getTime();
      if (dateA !== dateB) return dateA - dateB;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });

    sortedWithDate.forEach(reminder => {
      const reminderDate = startOfDay(new Date(reminder.date! + 'T00:00:00'));
      const existingGroup = groups.find(g => g.date && isSameDay(g.date, reminderDate));
      if (existingGroup) {
        existingGroup.reminders.push(reminder);
      } else {
        groups.push({ id: reminderDate.toISOString(), date: reminderDate, reminders: [reminder] });
      }
    });

    if (withoutDate.length > 0) {
      const sortedWithoutDate = [...withoutDate].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });
      groups.push({ id: 'anytime', date: new Date(9999, 0, 1), reminders: sortedWithoutDate });
    }

    return groups;
  }, [activeReminders, sortMode, tags, colors.mutedForeground]);

  const handleComplete = (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
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
            <Text style={styles.greeting}>{greeting()} ✨</Text>
          </View>

          {/* View Mode Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'week' && styles.toggleButtonActive]}
              onPress={() => setViewMode('week')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
              onPress={() => setViewMode('calendar')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>Calendar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading && reminders.length === 0 ? (
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
              <RefreshControl refreshing={loading} onRefresh={refreshReminders} colors={[colors.primary]} />
            }
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : viewMode === 'week' ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshReminders} colors={[colors.primary]} />
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
          data={groupedReminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index: groupIndex }) => {
            const startIndex = groupedReminders
              .slice(0, groupIndex)
              .reduce((acc, g) => acc + g.reminders.length, 0);

            const isAnytime = item.id === 'anytime';

            if (isAnytime && sortMode === 'time') {
              return (
                <View style={styles.anytimeSection}>
                  <View style={styles.headerRow}>
                    <Text style={styles.sectionHeader}>Anytime</Text>
                    {groupIndex === 0 && (
                      <SortSelector
                        currentSort={sortMode}
                        onSortChange={setSortMode}
                      />
                    )}
                  </View>
                  <View style={styles.remindersList}>
                    {item.reminders.map((reminder, index) => (
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
                  groupIndex === 0 || ((item as any).date && isToday((item as any).date))
                }
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshReminders} colors={[colors.primary]} />
          }
        />
      )}

      {/* Floating Add Button */}
      <FloatingAddButton onPress={() => setIsSheetOpen(true)} />

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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    padding: 4,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.card,
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
  toggleText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
  },
  toggleTextActive: {
    color: colors.foreground,
  },
  dateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  greeting: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.foreground,
    marginTop: 2,
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
