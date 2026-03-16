import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useReminders } from '../hooks/useReminders';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, borderRadius } from '../constants/theme';
import { ReminderCard } from './ReminderCard';

interface DayOverviewModalProps {
    date: string; // YYYY-MM-DD
}

export function DayOverviewModal({ date }: DayOverviewModalProps) {
    const { colors } = useTheme();
    const { reminders } = useReminders();

    // Filter reminders for the specific date, sorted by time
    const dayReminders = reminders
        .filter(r => r.date === date)
        .sort((a, b) => {
            if (!a.time) return -1;
            if (!b.time) return 1;
            return a.time.localeCompare(b.time);
        });

    // Format date for display
    const dateObj = new Date(date + 'T12:00:00Z');
    const displayDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC'
    });

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={styles.headerIcon} />
                <Text style={[styles.headerText, { color: colors.foreground }]}>{displayDate}</Text>
                <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>{dayReminders.length}</Text>
                </View>
            </View>

            {dayReminders.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Nothing else scheduled today!
                </Text>
            ) : (
                <ScrollView
                    style={styles.list}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                >
                    {dayReminders.map((reminder, index) => (
                        <View key={reminder.id} style={styles.cardWrapper}>
                            <ReminderCard
                                reminder={reminder}
                                index={index}
                                onComplete={() => { }} // read-only
                                onEdit={() => { }}     // read-only
                            />
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    headerIcon: {
        marginRight: spacing.xs,
    },
    headerText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.lg,
        flex: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    badgeText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
    },
    emptyText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    list: {
        marginTop: spacing.xs,
    },
    cardWrapper: {
        marginBottom: spacing.sm,
    },
});
