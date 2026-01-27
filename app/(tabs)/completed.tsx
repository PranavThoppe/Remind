import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderCard } from '../../components/ReminderCard';
import { EmptyState } from '../../components/EmptyState';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { spacing, typography } from '../../constants/theme';
import { Reminder } from '../../types/reminder';
import { useReminders } from '../../hooks/useReminders';
import { useTheme } from '../../hooks/useTheme';

export default function CompletedScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const { reminders, loading, toggleComplete, refreshReminders, updateReminder, deleteReminder } = useReminders();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const completedReminders = reminders.filter(r => r.completed);

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
    if (editingReminder) {
      await updateReminder(editingReminder.id, data);
    }
    setEditingReminder(null);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingReminder(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Completed</Text>
        <Text style={styles.subtitle}>
          {completedReminders.length} {completedReminders.length === 1 ? 'task' : 'tasks'} done
        </Text>
      </View>

      {/* Content */}
      {loading && reminders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : completedReminders.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState type="completed" />
          <FlatList
            data={[]}
            renderItem={null}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refreshReminders} colors={[colors.primary]} />
            }
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : (
        <FlatList
          data={completedReminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ReminderCard
              reminder={item}
              onComplete={handleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
              index={index}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshReminders} colors={[colors.primary]} />
          }
        />
      )}

      {/* Edit Sheet */}
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
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
});
