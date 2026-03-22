import React, { useState, useRef, useEffect } from 'react';
import {
    Animated,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Keyboard,
    Platform,
    ScrollView,
    Dimensions,
    KeyboardEvent,
    Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useReminders } from '../hooks/useReminders';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Reminder } from '../types/reminder';
import { ReminderCard } from './ReminderCard';
import { InlineEditChips } from './InlineEditChips';
import { InlineNotificationPicker } from './InlineNotificationPicker';
import { InlineRepeatPicker } from './InlineRepeatPicker';
import { InlineSubtaskList } from './InlineSubtaskList';
import { queueReminder, QueuedReminder } from '../utils/offlineQueue';
import * as Crypto from 'expo-crypto';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ManualAddReminderProps {
    visible: boolean;
    onClose: () => void;
    initialTitle?: string;
}

export function ManualAddReminder({ visible, onClose, initialTitle }: ManualAddReminderProps) {
    const { colors, isDark } = useTheme();
    const { tags, priorities } = useSettings();
    const { addReminder, addOfflineReminderToState } = useReminders();
    const { isConnected } = useNetworkStatus();
    const insets = useSafeAreaInsets();

    // Animations
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

    // Field state
    const [title, setTitle] = useState(initialTitle ?? '');
    const [date, setDate] = useState<string | null>(null);
    const [time, setTime] = useState<string | null>(null);
    const [tagId, setTagId] = useState<string | null>(null);
    const [priorityId, setPriorityId] = useState<string | null>(null);
    const [notificationOffsets, setNotificationOffsets] = useState<number[]>([]);
    const [repeat, setRepeat] = useState<string>('none');
    const [subtasks, setSubtasks] = useState<any[]>([]);
    const [notes, setNotes] = useState('');
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Panel states for inline pickers
    const [showNotificationPicker, setShowNotificationPicker] = useState(false);
    const [showRepeatPicker, setShowRepeatPicker] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    const titleRef = useRef<TextInput>(null);

    // Set default date to today and apply initialTitle on open
    useEffect(() => {
        if (visible) {
            if (!date) {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                setDate(`${yyyy}-${mm}-${dd}`);
            }
            if (initialTitle) {
                setTitle(initialTitle);
            }
        }
    }, [visible]);

    // ─── Keyboard handling ───
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
            Animated.timing(keyboardHeightAnim, {
                toValue: e.endCoordinates.height,
                duration: e.duration || 250,
                useNativeDriver: false,
            }).start();
        });

        const hideSub = Keyboard.addListener(hideEvent, (e: KeyboardEvent) => {
            Animated.timing(keyboardHeightAnim, {
                toValue: 0,
                duration: e?.duration || 250,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // ─── Open/Close animation ───
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
                Animated.spring(contentSlide, { toValue: 0, friction: 9, tension: 60, useNativeDriver: false }),
            ]).start(() => {
                titleRef.current?.focus();
            });
        } else {
            Animated.parallel([
                Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
                Animated.timing(contentSlide, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: false }),
            ]).start();
        }
    }, [visible]);

    const resetFields = () => {
        setTitle('');
        setDate(null);
        setTime(null);
        setTagId(null);
        setPriorityId(null);
        setNotificationOffsets([]);
        setRepeat('none');
        setSubtasks([]);
        setNotes('');
        setShowNotificationPicker(false);
        setShowRepeatPicker(false);
    };

    const handleClose = () => {
        Keyboard.dismiss();
        Animated.parallel([
            Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
            Animated.timing(contentSlide, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: false }),
        ]).start(() => {
            resetFields();
            onClose();
        });
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Title required', 'Please enter a title for your reminder.');
            return;
        }

        setIsSaving(true);

        const reminderData = {
            title: title.trim(),
            date,
            time,
            repeat,
            repeat_until: null as string | null,
            tag_id: tagId,
            priority_id: priorityId,
            notes: notes.trim() || null,
            notification_offsets: notificationOffsets,
            subtasks,
        };

        try {
            if (isConnected) {
                // Online: save directly to Supabase
                const result = await addReminder(reminderData);
                if (result?.error) {
                    throw new Error(result.error.message || 'Failed to save reminder');
                }
            } else {
                // Offline: queue locally
                const queued: QueuedReminder = {
                    localId: Crypto.randomUUID(),
                    ...reminderData,
                    subtasks: subtasks.map((s, i) => ({
                        title: s.title || '',
                        is_completed: s.is_completed || false,
                        position: i,
                    })),
                    createdAt: new Date().toISOString(),
                };
                await queueReminder(queued);

                // Add to UI immediately
                const mappedReminder: Reminder = {
                    id: queued.localId,
                    user_id: 'offline-user',
                    title: queued.title,
                    date: queued.date || null,
                    time: queued.time || null,
                    repeat: queued.repeat || 'none',
                    repeat_until: queued.repeat_until || null,
                    completed: false,
                    created_at: queued.createdAt,
                    tag_id: queued.tag_id || null,
                    priority_id: queued.priority_id || null,
                    notes: queued.notes || null,
                    notification_offsets: queued.notification_offsets || [],
                    isOffline: true,
                    subtasks: queued.subtasks ? queued.subtasks.map((s) => ({
                        id: Crypto.randomUUID(),
                        reminder_id: queued.localId,
                        title: s.title,
                        is_completed: s.is_completed,
                        position: s.position,
                    })) : [],
                };
                addOfflineReminderToState(mappedReminder);

                Alert.alert(
                    'Saved Offline',
                    'Your reminder has been saved locally and will sync when you reconnect.',
                );
            }

            handleClose();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Something went wrong while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    // Build preview reminder
    const previewReminder: Reminder = {
        id: 'preview',
        user_id: 'current-user',
        title: title || 'New Reminder',
        date,
        time,
        repeat,
        repeat_until: null,
        completed: false,
        created_at: new Date().toISOString(),
        tag_id: tagId,
        priority_id: priorityId,
        notes,
        notification_offsets: notificationOffsets,
        subtasks,
    };

    if (!visible) return null;

    return (
        <>
            {/* Blur Backdrop */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[localStyles.overlay, { opacity: backdropAnim }]}>
                    <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }]} />
                </Animated.View>
            </TouchableWithoutFeedback>

            {/* Main Content */}
            <Animated.View
                style={[
                    localStyles.container,
                    {
                        top: insets.top + spacing.md,
                        bottom: Animated.add(new Animated.Value(insets.bottom + spacing.md), keyboardHeightAnim) as any,
                        transform: [{ translateY: contentSlide }],
                    },
                ]}
            >
                <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                    <View style={[localStyles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

                        {/* Header */}
                        <View style={localStyles.header}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <Ionicons name="create-outline" size={20} color={colors.primary} />
                                <Text style={[localStyles.headerTitle, { color: colors.foreground }]}>
                                    New Reminder
                                </Text>
                            </View>

                            {/* Offline indicator */}
                            {!isConnected && (
                                <View style={[localStyles.offlineBadge, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }]}>
                                    <Ionicons name="cloud-offline-outline" size={12} color={'#f59e0b'} />
                                    <Text style={[localStyles.offlineBadgeText, { color: '#f59e0b' }]}>Offline</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[localStyles.closeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                                onPress={handleClose}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: spacing.xl }}
                        >
                            {/* Preview Card */}
                            <View style={localStyles.previewContainer}>
                                <ReminderCard
                                    reminder={previewReminder}
                                    index={0}
                                    onComplete={() => { }}
                                    onEdit={() => { }}
                                />
                            </View>

                            {/* Title Input */}
                            <View style={localStyles.fieldContainer}>
                                <Text style={[localStyles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
                                <TextInput
                                    ref={titleRef}
                                    style={[
                                        localStyles.titleInput,
                                        {
                                            color: colors.foreground,
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="What do you need to remember?"
                                    placeholderTextColor={colors.mutedForeground}
                                    value={title}
                                    onChangeText={setTitle}
                                    returnKeyType="done"
                                    maxLength={200}
                                    autoFocus={false}
                                />
                            </View>

                            {/* InlineEditChips */}
                            <View style={localStyles.chipsSection}>
                                <InlineEditChips
                                    date={date}
                                    time={time}
                                    tag_id={tagId}
                                    priority_id={priorityId}
                                    notification_offsets={notificationOffsets}
                                    repeat={repeat}
                                    subtasks={subtasks}
                                    onChange={(fields) => {
                                        if (fields.date !== undefined) setDate(fields.date as string | null);
                                        if (fields.time !== undefined) setTime(fields.time as string | null);
                                        if (fields.tag_id !== undefined) setTagId(fields.tag_id as string | null);
                                        if (fields.priority_id !== undefined) setPriorityId(fields.priority_id as string | null);
                                    }}
                                    onOpenNotifications={() => {
                                        setShowNotificationPicker(true);
                                        setShowRepeatPicker(false);
                                    }}
                                    onOpenRepeat={() => {
                                        setShowRepeatPicker(true);
                                        setShowNotificationPicker(false);
                                    }}
                                    onPickerStateChange={setIsPickerOpen}
                                />
                            </View>

                            {/* Inline Notification Picker */}
                            {showNotificationPicker && (
                                <View style={localStyles.inlinePanel}>
                                    <InlineNotificationPicker
                                        initialOffsets={notificationOffsets}
                                        baseTime={time}
                                        onConfirm={(offsets) => {
                                            setNotificationOffsets(offsets);
                                            setShowNotificationPicker(false);
                                        }}
                                        onCancel={() => setShowNotificationPicker(false)}
                                    />
                                </View>
                            )}

                            {/* Inline Repeat Picker */}
                            {showRepeatPicker && (
                                <View style={localStyles.inlinePanel}>
                                    <InlineRepeatPicker
                                        initialRepeat={repeat}
                                        reminderDate={date}
                                        onConfirm={(rrule) => {
                                            setRepeat(rrule);
                                            setShowRepeatPicker(false);
                                        }}
                                        onCancel={() => setShowRepeatPicker(false)}
                                    />
                                </View>
                            )}

                            {/* Notes Input */}
                            <View style={localStyles.fieldContainer}>
                                <Text style={[localStyles.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
                                <TextInput
                                    style={[
                                        localStyles.notesInput,
                                        {
                                            color: colors.foreground,
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="Add any extra details..."
                                    placeholderTextColor={colors.mutedForeground}
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    numberOfLines={3}
                                    maxLength={500}
                                    textAlignVertical="top"
                                />
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[
                                localStyles.saveButton,
                                {
                                    backgroundColor: title.trim() ? colors.primary : colors.muted || colors.border,
                                },
                            ]}
                            onPress={handleSave}
                            disabled={isSaving || !title.trim()}
                            activeOpacity={0.8}
                        >
                            {isSaving ? (
                                <Text style={[localStyles.saveButtonText, { color: colors.primaryForeground }]}>Saving...</Text>
                            ) : (
                                <>
                                    <Ionicons
                                        name={isConnected ? 'checkmark-circle' : 'cloud-offline-outline'}
                                        size={20}
                                        color={colors.primaryForeground}
                                        style={{ marginRight: spacing.sm }}
                                    />
                                    <Text style={[localStyles.saveButtonText, { color: colors.primaryForeground }]}>
                                        {isConnected ? 'Create Reminder' : 'Save Offline'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </Animated.View>
        </>
    );
}

// ─────────────── Styles ───────────────

const localStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1100,
    },
    container: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        zIndex: 1101,
    },
    contentCard: {
        flex: 1,
        borderRadius: borderRadius.xl || 20,
        borderWidth: 1,
        overflow: 'hidden',
        ...shadows.soft,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(150,150,150,0.2)',
    },
    headerTitle: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.lg,
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
    },
    offlineBadgeText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 11,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
    },
    fieldContainer: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.lg,
    },
    fieldLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    titleInput: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
    },
    notesInput: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        minHeight: 80,
    },
    chipsSection: {
        paddingHorizontal: spacing.md,
    },
    inlinePanel: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md + 2,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        borderRadius: borderRadius.lg,
        ...shadows.soft,
    },
    saveButtonText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.base,
    },
});
