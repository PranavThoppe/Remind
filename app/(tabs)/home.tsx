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
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { colors, spacing, typography } from '../../constants/theme';
import { Reminder } from '../../types/reminder';

// Sample data for demo
const sampleReminders: Reminder[] = [
  {
    id: '1',
    title: 'Buy groceries for the week',
    date: new Date(),
    time: '10:00',
    repeat: 'weekly',
    completed: false,
    createdAt: new Date(),
  },
  {
    id: '2',
    title: 'Call mom',
    date: new Date(Date.now() + 86400000),
    time: '18:00',
    completed: false,
    createdAt: new Date(),
  },
  {
    id: '3',
    title: 'Review project proposal',
    date: new Date(Date.now() + 172800000),
    completed: false,
    createdAt: new Date(),
  },
  {
    id: '4',
    title: 'Morning meditation',
    time: '07:00',
    repeat: 'daily',
    completed: false,
    createdAt: new Date(),
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<Reminder[]>(sampleReminders);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const activeReminders = reminders.filter(r => !r.completed);

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
    } else {
      const newReminder: Reminder = {
        ...data,
        id: Date.now().toString(),
        completed: false,
        createdAt: new Date(),
      };
      setReminders(prev => [newReminder, ...prev]);
    }
    setEditingReminder(null);
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
        <Text style={styles.dateText}>{formatDate()}</Text>
        <Text style={styles.greeting}>{greeting()} ✨</Text>
      </View>

      {/* Content */}
      {activeReminders.length === 0 ? (
        <EmptyState type="active" />
      ) : (
        <FlatList
          data={activeReminders}
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
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
});
