import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, startOfDay, addDays, isSameDay, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { Reminder } from '../types/reminder';

interface WeekForecastProps {
  reminders: Reminder[];
  onReminderClick?: (reminder: Reminder) => void;
  onComplete?: (id: string) => void;
}

export const WeekForecast = ({ reminders, onReminderClick, onComplete }: WeekForecastProps) => {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const getRemindersForDay = (date: Date) => {
    return reminders
      .filter(r => {
        if (!r.date) return false;
        try {
          // Assuming r.date is 'YYYY-MM-DD'
          return isSameDay(parseISO(r.date), date);
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });
  };

  const getDayLabel = (date: Date, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return format(date, 'EEEE');
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <View style={styles.container}>
      {days.map((date, index) => {
        const dayReminders = getRemindersForDay(date);
        const isToday = index === 0;

        return (
          <View
            key={date.toISOString()}
            style={[
              styles.dayCard,
              isToday ? styles.todayCard : styles.otherDayCard
            ]}
          >
            {/* Day Header */}
            <View style={styles.header}>
              <View style={styles.dayInfo}>
                <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                  {getDayLabel(date, index)}
                </Text>
                <Text style={styles.dateLabel}>
                  {format(date, 'MMM d')}
                </Text>
              </View>
              {dayReminders.length > 0 && (
                <View style={[styles.badge, isToday ? styles.todayBadge : styles.otherBadge]}>
                  <Text style={[styles.badgeText, isToday ? styles.todayBadgeText : styles.otherBadgeText]}>
                    {dayReminders.length} {dayReminders.length === 1 ? 'reminder' : 'reminders'}
                  </Text>
                </View>
              )}
            </View>

            {/* Reminders List */}
            {dayReminders.length > 0 ? (
              <View style={styles.remindersList}>
                {dayReminders.map((reminder) => (
                  <TouchableOpacity
                    key={reminder.id}
                    onPress={() => onReminderClick?.(reminder)}
                    style={styles.reminderItem}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <TouchableOpacity
                      onPress={() => onComplete?.(reminder.id)}
                      style={[styles.checkbox, reminder.completed && styles.checkboxCompleted]}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {reminder.completed && (
                        <Ionicons name="checkmark" size={12} color={colors.successForeground} strokeWidth={3} />
                      )}
                    </TouchableOpacity>
                    
                    <View style={styles.reminderContent}>
                      <Text style={[styles.reminderTitle, reminder.completed && styles.completedText]} numberOfLines={1}>
                        {reminder.title}
                      </Text>
                      {reminder.time && (
                        <View style={styles.timeContainer}>
                          <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                          <Text style={styles.timeText}>{formatTime(reminder.time)}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No reminders</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  dayCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.soft,
  },
  todayCard: {
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  otherDayCard: {
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
  },
  todayLabel: {
    color: colors.primary,
  },
  dateLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  todayBadge: {
    backgroundColor: `${colors.primary}20`,
  },
  otherBadge: {
    backgroundColor: colors.muted,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  todayBadgeText: {
    color: colors.primary,
  },
  otherBadgeText: {
    color: colors.mutedForeground,
  },
  remindersList: {
    gap: spacing.sm,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.background}80`,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${colors.primary}40`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.mutedForeground,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: `${colors.mutedForeground}60`,
    fontStyle: 'italic',
  }
});
