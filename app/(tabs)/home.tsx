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
import { startOfDay, isSameDay } from 'date-fns';
import { ReminderCard } from '../../components/ReminderCard';
import { DaySection } from '../../components/DaySection';
import { EmptyState } from '../../components/EmptyState';
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { WeekForecast } from '../../components/WeekForecast';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { Reminder } from '../../types/reminder';
import { useReminders } from '../../hooks/useReminders';
import { useTheme } from '../../hooks/useTheme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const { reminders, loading, addReminder, toggleComplete, refreshReminders, updateReminder, deleteReminder } = useReminders();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');

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

  // Group active reminders by day in chronological order
  const groupedReminders = useMemo(() => {
    const groups: { date: Date; reminders: Reminder[] }[] = [];
    
    // Separate reminders with and without dates
    const withDate = activeReminders.filter(r => r.date);
    const withoutDate = activeReminders.filter(r => !r.date);
    
    // Sort reminders with dates chronologically
    const sortedWithDate = [...withDate].sort((a, b) => {
      const dateA = a.date ? new Date(a.date + 'T00:00:00').getTime() : 0;
      const dateB = b.date ? new Date(b.date + 'T00:00:00').getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      // If same date, sort by time
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });

    // Group by day
    sortedWithDate.forEach(reminder => {
      const reminderDate = startOfDay(new Date(reminder.date! + 'T00:00:00'));
      const existingGroup = groups.find(g => isSameDay(g.date, reminderDate));
      if (existingGroup) {
        existingGroup.reminders.push(reminder);
      } else {
        groups.push({ date: reminderDate, reminders: [reminder] });
      }
    });

    // Add reminders without dates to "Anytime" group at the end
    if (withoutDate.length > 0) {
      // Sort by time if available
      const sortedWithoutDate = [...withoutDate].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });
      groups.push({ date: new Date(9999, 0, 1), reminders: sortedWithoutDate }); // Far future date for "Anytime"
    }

    return groups;
  }, [activeReminders]);

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
      ) : (
        <FlatList
          data={groupedReminders}
          keyExtractor={(item) => item.date.toISOString()}
          renderItem={({ item, index: groupIndex }) => {
            const startIndex = groupedReminders
              .slice(0, groupIndex)
              .reduce((acc, g) => acc + g.reminders.length, 0);
            
            const isAnytime = item.date.getFullYear() === 9999;
            
            if (isAnytime) {
              return (
                <View style={styles.anytimeSection}>
                  <Text style={styles.sectionHeader}>Anytime</Text>
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
                date={item.date}
                reminders={item.reminders}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                startIndex={startIndex}
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
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
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
});
