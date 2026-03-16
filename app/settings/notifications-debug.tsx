import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import { rrulestr } from 'rrule';

import { useTheme } from '../../hooks/useTheme';
import { typography, spacing, borderRadius, shadows } from '../../constants/theme';
import { useRemindersContext } from '../../contexts/RemindersContext';
import { useSettings } from '../../contexts/SettingsContext';
import { syncNotifications, cancelAllNotifications } from '../../lib/notifications';

export default function NotificationsDebugScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const { reminders } = useRemindersContext();
    const { commonTimes } = useSettings();

    const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            // Sort by trigger date if possible
            scheduled.sort((a, b) => {
                const triggerA = a.trigger as any;
                const triggerb = b.trigger as any;

                const dateA = triggerA?.date ? new Date(triggerA.date).getTime() : 0;
                const dateb = triggerb?.date ? new Date(triggerb.date).getTime() : 0;
                return dateA - dateb;
            });
            setScheduledNotifications(scheduled);
        } catch (error) {
            console.error('Failed to fetch scheduled notifications', error);
            Alert.alert('Error', 'Could not fetch scheduled notifications');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleCancelAll = () => {
        Alert.alert(
            'Cancel All',
            'Are you sure you want to cancel all scheduled notifications? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSyncing(true);
                            await cancelAllNotifications();
                            await fetchNotifications();
                            Alert.alert('Success', 'All notifications cancelled.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to cancel notifications.');
                        } finally {
                            setSyncing(false);
                        }
                    },
                },
            ]
        );
    };

    const handleRescheduleAll = () => {
        Alert.alert(
            'Reschedule All',
            'This will cancel all current notifications and recreate them based on your active reminders. Proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sync',
                    onPress: async () => {
                        try {
                            setSyncing(true);
                            const count = await syncNotifications(reminders, commonTimes);
                            await fetchNotifications();
                            Alert.alert('Success', `Rescheduled ${count} notifications.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to sync notifications.');
                        } finally {
                            setSyncing(false);
                        }
                    },
                },
            ]
        );
    };

    const renderTriggerInfo = (trigger: any) => {
        if (!trigger) return 'Unknown Trigger';
        switch (trigger.type) {
            case 'date':
            case Notifications.SchedulableTriggerInputTypes.DATE:
                return `Date: ${format(new Date(trigger.date || trigger.value), 'MMM d, yyyy h:mm a')}`;
            case 'calendar':
            case Notifications.SchedulableTriggerInputTypes.CALENDAR:
                const parts = [];
                if (trigger.year !== undefined) parts.push(`Y:${trigger.year}`);
                if (trigger.month !== undefined) parts.push(`M:${trigger.month}`);
                if (trigger.day !== undefined) parts.push(`D:${trigger.day}`);
                if (trigger.weekday !== undefined) parts.push(`W:${trigger.weekday}`);
                if (trigger.hour !== undefined) parts.push(`${trigger.hour.toString().padStart(2, '0')}:${trigger.minute?.toString().padStart(2, '0') || '00'}`);
                return `Calendar Pattern: ${parts.join(' ')}\nRepeats: ${trigger.repeats ? 'Yes' : 'No'}`;
            case 'timeInterval':
            case Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL:
                return `Interval: ${trigger.seconds}s (repeats: ${trigger.repeats})`;
            default:
                return `Type: ${trigger.type}`;
        }
    };

    const renderHumanRepeat = (repeatData?: string) => {
        if (!repeatData || repeatData === 'none') return null;
        try {
            if (repeatData === 'daily') return 'every day';
            if (repeatData === 'weekly') return 'every week';
            if (repeatData === 'monthly') return 'every month';
            if (repeatData === 'yearly') return 'every year';

            const rule = rrulestr(repeatData);
            return rule.toText();
        } catch (e) {
            return repeatData;
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notification Debug</Text>
                <TouchableOpacity onPress={fetchNotifications} disabled={syncing || loading}>
                    <Ionicons name="refresh" size={24} color={syncing ? colors.muted : colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancelAll}
                    disabled={syncing || scheduledNotifications.length === 0}
                >
                    <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                    <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                        Cancel All
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.syncButton]}
                    onPress={handleRescheduleAll}
                    disabled={syncing}
                >
                    <Ionicons name="sync-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                        Sync ({reminders.filter(r => !r.completed && r.date).length} active)
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>
                        Total Scheduled: <Text style={styles.statsCount}>{scheduledNotifications.length}</Text>
                    </Text>
                </View>

                {loading || syncing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>
                            {syncing ? 'Syncing notifications...' : 'Loading...'}
                        </Text>
                    </View>
                ) : scheduledNotifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off-outline" size={48} color={colors.muted} />
                        <Text style={styles.emptyText}>No notifications scheduled</Text>
                    </View>
                ) : (
                    scheduledNotifications.map((req, index) => (
                        <View key={req.identifier || index} style={styles.notificationCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {req.content.title || 'No Title'}
                                </Text>
                                <TouchableOpacity
                                    onPress={async () => {
                                        await Notifications.cancelScheduledNotificationAsync(req.identifier);
                                        fetchNotifications();
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.cardBody} numberOfLines={2}>
                                {req.content.body || 'No Body'}
                            </Text>

                            <View style={styles.triggerContainer}>
                                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                                <Text style={styles.triggerText}>
                                    {renderTriggerInfo(req.trigger)}
                                </Text>
                            </View>

                            {renderHumanRepeat(req.content.data?.repeat as string | undefined) && (
                                <View style={[styles.triggerContainer, { backgroundColor: `${colors.secondary}15`, marginTop: -spacing.xs }]}>
                                    <Ionicons name="repeat-outline" size={14} color={colors.foreground} />
                                    <Text style={[styles.triggerText, { color: colors.foreground, textTransform: 'capitalize' }]}>
                                        Repeats: {renderHumanRepeat(req.content.data?.repeat as string | undefined)}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.idContainer}>
                                <Text style={styles.idText}>
                                    Rem ID: {(req.content.data?.id as string) || 'none'}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
        marginLeft: -spacing.xs,
    },
    headerTitle: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.xl,
        color: colors.foreground,
    },
    actionsContainer: {
        flexDirection: 'row',
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        backgroundColor: `${colors.border}50`, // Subtle internal background
        ...shadows.soft,
    },
    cancelButton: {
        backgroundColor: `${colors.destructive}15`,
    },
    syncButton: {
        backgroundColor: `${colors.primary}15`,
    },
    actionButtonText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    statsContainer: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    statsText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
    },
    statsCount: {
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    loadingContainer: {
        padding: spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.mutedForeground,
    },
    emptyContainer: {
        padding: spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: spacing.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.mutedForeground,
    },
    notificationCard: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.soft,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    cardTitle: {
        flex: 1,
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
        marginRight: spacing.md,
    },
    cardBody: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        marginBottom: spacing.md,
    },
    triggerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        backgroundColor: `${colors.primary}10`,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    triggerText: {
        flex: 1,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.xs,
        color: colors.primary,
    },
    idContainer: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    idText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.xs,
        color: colors.mutedForeground,
    },
});
