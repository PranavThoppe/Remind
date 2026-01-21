import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderCard } from '../../components/ReminderCard';
import { EmptyState } from '../../components/EmptyState';
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { Reminder } from '../../types/reminder';
import { useReminders } from '../../hooks/useReminders';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { reminders, loading, addReminder, toggleComplete, refreshReminders, updateReminder } = useReminders();
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

  const handleSave = async (data: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => {
    if (editingReminder) {
      await updateReminder(editingReminder.id, data);
    } else {
      await addReminder(data);
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
});
