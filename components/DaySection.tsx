import React from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { View, Text, StyleSheet } from 'react-native';
import { ReminderCard } from './ReminderCard';
import { SortSelector } from './SortSelector';
import { Reminder } from '../types/reminder';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface DaySectionProps {
  date?: Date;
  title?: string;
  headerColor?: string;
  reminders: Reminder[];
  onComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete?: (id: string) => void;
  startIndex: number;
  onSortChange?: (mode: 'time' | 'tag' | 'priority') => void;
  currentSort?: 'time' | 'tag' | 'priority';
  showSort?: boolean;
}

export const DaySection = ({
  date,
  title,
  headerColor,
  reminders,
  onComplete,
  onEdit,
  onDelete,
  startIndex,
  onSortChange,
  currentSort,
  showSort
}: DaySectionProps) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };


  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionHeader, headerColor ? { color: headerColor } : null]}>
          {title || (date ? getDateLabel(date) : '')}
        </Text>
        {showSort && onSortChange && currentSort && (
          <SortSelector
            currentSort={currentSort}
            onSortChange={onSortChange}
          />
        )}
      </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingVertical: spacing.xs,
  },
  remindersList: {
    gap: spacing.md,
  },
});
