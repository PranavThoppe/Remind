import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    parseISO
} from 'date-fns';
import { useRemindersContext } from '../contexts/RemindersContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { ReminderCard } from './ReminderCard';
import { AddReminderSheet } from './AddReminderSheet';
import { typography, spacing, borderRadius } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    FadeInLeft,
    FadeInRight,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const CalendarView: React.FC = () => {
    const { reminders, toggleComplete, deleteReminder, updateReminder, addReminder } = useRemindersContext();
    const { priorities, tags } = useSettings();
    const { colors, isDark } = useTheme();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<any>(null);

    // Group reminders by date
    const eventsByDate = useMemo(() => {
        const map: Record<string, any[]> = {};
        reminders.forEach(reminder => {
            if (reminder.date) {
                if (!map[reminder.date]) map[reminder.date] = [];
                map[reminder.date].push(reminder);
            }
        });
        return map;
    }, [reminders]);

    const selectedEvents = useMemo(() => {
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        return eventsByDate[dateKey] || [];
    }, [selectedDate, eventsByDate]);

    const days = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const totalCells = selectedEvents.length > 3 ? 35 : 42;

        return allDays.slice(0, Math.max(allDays.length, totalCells));
    }, [currentDate, selectedEvents.length]);

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleComplete = (id: string) => {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
            toggleComplete(id, reminder.completed);
        }
    };

    const handleEdit = (reminder: any) => {
        setEditingReminder(reminder);
        setIsSheetOpen(true);
    };

    const handleCloseSheet = () => {
        setIsSheetOpen(false);
        setEditingReminder(null);
    };

    const handleSave = async (data: any) => {
        let result;
        if (editingReminder) {
            result = await updateReminder(editingReminder.id, data);
        } else {
            result = await addReminder(data);
        }
        setEditingReminder(null);
        return result;
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
            <View style={{ height: spacing.xl }} />

            {/* Calendar Card */}
            <Animated.View
                entering={FadeInDown.duration(600)}
                style={[
                    styles.calendarCard,
                    {
                        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                        borderColor: colors.border,
                    }
                ]}
            >
                <View style={styles.calendarHeader}>
                    <Text style={[styles.calendarTitle, { color: colors.foreground }]}>
                        {format(currentDate, 'MMM yyyy')}
                    </Text>
                    <View style={styles.monthNav}>
                        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthBtn}>
                            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleNextMonth} style={styles.monthBtn}>
                            <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Weekdays */}
                <View style={styles.weekdays}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <Text key={idx} style={[styles.weekday, { color: colors.mutedForeground }]}>{day}</Text>
                    ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                    {days.map((date, idx) => {
                        const isCurrMonth = isSameMonth(date, currentDate);
                        const isToday = isSameDay(date, new Date());
                        const isSelected = isSameDay(date, selectedDate);
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const hasEvents = eventsByDate[dateKey] && eventsByDate[dateKey].length > 0;

                        return (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => setSelectedDate(date)}
                                style={[
                                    styles.dayContainer,
                                    isSelected && styles.selectedDay,
                                    isSelected && { backgroundColor: colors.primary },
                                    isToday && !isSelected && styles.todayDay,
                                    isToday && !isSelected && { borderColor: colors.primary }
                                ]}
                            >
                                <Text style={[
                                    styles.dayText,
                                    { color: isCurrMonth ? colors.foreground : colors.mutedForeground },
                                    isSelected && { color: colors.primaryForeground },
                                    isToday && !isSelected && { color: colors.primary }
                                ]}>
                                    {format(date, 'd')}
                                </Text>
                                {hasEvents && !isSelected && (
                                    <View style={[styles.eventDot, { backgroundColor: colors.primary }]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>

            {/* Agenda Section */}
            <View style={styles.agendaContainer}>
                <Text style={[styles.agendaHeader, { color: colors.foreground }]}>Agenda</Text>

                {selectedEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar" size={48} color={colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No events scheduled</Text>
                    </View>
                ) : (
                    <View style={{ gap: spacing.md }}>
                        {selectedEvents.map((event, idx) => (
                            <ReminderCard
                                key={event.id}
                                reminder={event}
                                onComplete={handleComplete}
                                onEdit={handleEdit}
                                onDelete={deleteReminder}
                                index={idx}
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* Add/Edit Sheet */}
            <AddReminderSheet
                isOpen={isSheetOpen}
                onClose={handleCloseSheet}
                onSave={handleSave}
                editReminder={editingReminder}
            />

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    header: {
        paddingVertical: spacing.xl,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    time: {
        fontSize: 18,
        fontFamily: typography.fontFamily.semibold,
    },
    calendarCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        // Glass effect shadow/blur handled by rgba and translucent backgrounds
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    calendarTitle: {
        fontSize: 18,
        fontFamily: typography.fontFamily.bold,
    },
    monthNav: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    monthBtn: {
        padding: spacing.xs,
    },
    weekdays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    weekday: {
        width: (width - 64) / 7,
        textAlign: 'center',
        fontSize: 12,
        fontFamily: typography.fontFamily.medium,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayContainer: {
        width: (width - 72) / 7,
        height: (width - 72) / 7,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.md,
        marginVertical: 4,
    },
    dayText: {
        fontSize: 14,
        fontFamily: typography.fontFamily.medium,
    },
    selectedDay: {
        borderRadius: borderRadius.md,
    },
    todayDay: {
        borderWidth: 1,
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
    agendaContainer: {
        marginTop: spacing.xl,
        paddingBottom: spacing.xl,
    },
    agendaHeader: {
        fontSize: 20,
        fontFamily: typography.fontFamily.bold,
        marginBottom: spacing.lg,
    },
    agendaItem: {
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    agendaIcon: {
        marginRight: spacing.md,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    agendaDetails: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 15,
        fontFamily: typography.fontFamily.semibold,
    },
    eventTime: {
        fontSize: 13,
        fontFamily: typography.fontFamily.regular,
        marginTop: 2,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 15,
        fontFamily: typography.fontFamily.medium,
    },
});

export default CalendarView;
