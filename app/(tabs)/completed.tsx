import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderCard } from '../../components/ReminderCard';
import { EmptyState } from '../../components/EmptyState';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { colors, spacing, typography } from '../../constants/theme';
import { Reminder } from '../../types/reminder';

// Sample completed data for demo
const sampleCompletedReminders: Reminder[] = [
  {
    id: '5',
    title: 'Morning meditation',
    time: '07:00',
    repeat: 'daily',
    completed: true,
    createdAt: new Date(),
  },
  {
    id: '6',
    title: 'Submit expense report',
    date: new Date(Date.now() - 86400000),
    completed: true,
    createdAt: new Date(),
  },
];

export default function CompletedScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<Reminder[]>(sampleCompletedReminders);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const handleComplete = (id: string) => {
    setReminders(prev =>
      prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r)
    );
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsSheetOpen(true);
  };

  const handleSave = (data: Omit<Reminder, 'id' | 'createdAt' | 'completed'>) => {
    if (editingReminder) {
      setReminders(prev =>
        prev.map(r => r.id === editingReminder.id ? { ...r, ...data } : r)
      );
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
          {reminders.length} {reminders.length === 1 ? 'task' : 'tasks'} done
        </Text>
      </View>

      {/* Content */}
      {reminders.length === 0 ? (
        <EmptyState type="completed" />
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ReminderCard
              reminder={item}
              onComplete={handleComplete}
              onEdit={handleEdit}
              index={index}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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

const styles = StyleSheet.create({
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
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
});
