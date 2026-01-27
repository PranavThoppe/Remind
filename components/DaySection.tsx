import React from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { View, Text, StyleSheet } from 'react-native';
import { ReminderCard } from './ReminderCard';
import { Reminder } from '../types/reminder';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface DaySectionProps {
  date: Date;
  reminders: Reminder[];
  onComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete?: (id: string) => void;
  startIndex: number;
}

export const DaySection = ({ date, reminders, onComplete, onEdit, onDelete, startIndex }: DaySectionProps) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>
        {getDateLabel(date)}
      </Text>
      <View style={styles.remindersList}>
        {reminders.map((reminder, index) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            index={startIndex + index}
          />
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
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
