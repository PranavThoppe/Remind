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
    Dimensions,
    FlatList,
    ScrollView,
    Alert,
    NativeSyntheticEvent,
    TextInputKeyPressEventData,
    KeyboardEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { shadows, spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useNovaUpdateChat } from '../hooks/useNovaUpdateChat';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { Reminder } from '../types/reminder';
import { ReminderCard, CardLayout } from './ReminderCard';
import { SuggestionChips } from './SuggestionChips';
import { InlineNotificationPicker } from './InlineNotificationPicker';
import { InlineRepeatPicker } from './InlineRepeatPicker';
import { InlineSubtaskList } from './InlineSubtaskList';
import { ModalFieldUpdates, ChatMessage } from '../types/ai-chat';
import { InlineEditChips } from './InlineEditChips';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PILL_HEIGHT = 52;
const PILL_HORIZONTAL_MARGIN = 20;
const EXPANDED_PILL_BOTTOM = 32; // Tweak this value to move the pill higher/lower
const ANIM_DURATION = 350;

// ─────────────── Reusable sub-components from FloatingAddButton ───────────────

function TypingIndicator({ colors, onOverlayPress }: { colors: any; onOverlayPress?: () => void }) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            ).start();
        };
        animate(dot1, 0);
        animate(dot2, 150);
        animate(dot3, 300);
    }, []);

    const dotStyle = (anim: Animated.Value) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    });

    return (
        <TouchableWithoutFeedback onPress={onOverlayPress}>
            <View style={[localStyles.messageContainer]}>
                <View style={[localStyles.messageBubble, localStyles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border, alignSelf: 'flex-start', marginLeft: spacing.lg }]}>
                    <View style={localStyles.typingContainer}>
                        <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot1)]} />
                        <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot2)]} />
                        <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot3)]} />
                    </View>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
}

function MessageBubble({
    message,
    colors,
    tags,
    reminder,
    onDraftConfirm,
    onDraftDiscard,
    onOverlayPress,
}: {
    message: ChatMessage;
    colors: any;
    tags: any[];
    reminder?: Reminder | null;
    onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
    onDraftDiscard?: (messageId: string) => void;
    onOverlayPress?: () => void;
}) {
    const isUser = message.role === 'user';

    const getDraftReminder = (fields: ModalFieldUpdates): Reminder => ({
        id: `draft-${message.id}`,
        user_id: 'current-user',
        title: fields.title || '',
        date: fields.date || null,
        time: fields.time || null,
        repeat: fields.repeat || 'none',
        repeat_until: fields.repeat_until || null,
        completed: false,
        created_at: new Date().toISOString(),
        tag_id: fields.tag_id,
        priority_id: fields.priority_id,
        notes: fields.notes,
        subtasks: fields.subtasks,
        notification_offsets: fields.notification_offsets,
    });

    if ((message.panelType === 'draft' || (message.panelType as any) === 'draft_update') && message.panelFields) {
        const draftReminder = getDraftReminder(message.panelFields);
        const isStatic = message.panelIsStatic;

        return (
            <TouchableWithoutFeedback onPress={onOverlayPress}>
                <View style={[localStyles.messageContainer]}>
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View style={{ width: '100%', maxWidth: 340 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 }}>
                                <Ionicons
                                    name={isStatic ? 'checkmark-circle' : 'sparkles'}
                                    size={16}
                                    color={isStatic ? colors.success : colors.primary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={{ color: isStatic ? colors.success : colors.mutedForeground, fontSize: 12, fontFamily: typography.fontFamily.medium }}>
                                    {isStatic
                                        ? ((message.panelType as any) === 'draft_update' ? 'Reminder Updated' : 'Reminder Created')
                                        : 'Proposed Update'}
                                </Text>
                            </View>

                            <ReminderCard
                                reminder={draftReminder}
                                index={0}
                                onComplete={isStatic ? () => { } : () => onDraftConfirm?.(message.id, message.panelFields!)}
                                onEdit={isStatic ? () => { } : () => { }}
                                onDelete={isStatic ? undefined : () => onDraftDiscard?.(message.id)}
                            /* We don't allow opening notification sheet from a drafted message bubble for now, they use the ghost card */
                            />

                            {!isStatic && (
                                <Text style={{ textAlign: 'center', marginTop: 8, color: colors.mutedForeground, fontSize: 11 }}>
                                    Tap check to update • Swipe to discard
                                </Text>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        );
    }

    if (message.panelType === 'notification_settings') {
        const isStatic = message.panelIsStatic;
        return (
            <TouchableWithoutFeedback onPress={onOverlayPress}>
                <View style={[localStyles.messageContainer]}>
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View style={{ width: '100%', maxWidth: 340 }}>
                            <InlineNotificationPicker
                                initialOffsets={message.panelFields?.notification_offsets || []}
                                baseTime={reminder?.time}
                                onConfirm={(offsets) => {
                                    if (!isStatic) {
                                        // Instantly auto-save so the ghost card updates and shows the bell icon
                                        onDraftConfirm?.(message.id, { notification_offsets: offsets });
                                    }
                                }}
                                onCancel={() => {
                                    if (!isStatic) {
                                        // If they explicitly close the tool, clear the notifications
                                        onDraftConfirm?.(message.id, { notification_offsets: [] });
                                        onDraftDiscard?.(message.id);
                                    }
                                }}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        );
    }

    if ((message.panelType as any) === 'subtasks_settings') {
        const isStatic = message.panelIsStatic;
        return (
            <TouchableWithoutFeedback onPress={onOverlayPress}>
                <View style={[localStyles.messageContainer]}>
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View style={{ width: '100%', maxWidth: 340 }}>
                            <InlineSubtaskList
                                subtasks={message.panelFields?.subtasks || []}
                                onChange={(subtasks) => {
                                    // Local UI updates handled inside
                                }}
                                onSave={!isStatic ? (subtasks) => {
                                    onDraftConfirm?.(message.id, { subtasks });
                                } : undefined}
                                onCancel={() => {
                                    if (!isStatic) {
                                        // If they explicitly dismiss the subtask panel, just discard
                                        onDraftDiscard?.(message.id);
                                    }
                                }}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={onOverlayPress}>
            <View style={[localStyles.messageContainer, isUser && localStyles.userMessageContainer]}>
                <TouchableWithoutFeedback onPress={() => { }}>
                    <View
                        style={[
                            localStyles.messageBubble,
                            isUser
                                ? [localStyles.userBubble, { backgroundColor: colors.primary }]
                                : [localStyles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                        ]}
                    >
                        {message.content ? (
                            <Text
                                style={
                                    isUser
                                        ? [localStyles.messageText, { color: colors.primaryForeground }]
                                        : [localStyles.aiMessageText, { color: colors.foreground }]
                                }
                            >
                                {message.content}
                            </Text>
                        ) : null}
                    </View>
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
    );
}

// ─────────────── Props ───────────────

interface EditReminderSheetProps {
    reminder: Reminder | null;
    sourceLayout: CardLayout | null;
    onClose: () => void;
    onSave: (data: any) => Promise<any>;
}

// ─────────────── Main Component ───────────────

export function EditReminderSheet({ reminder, sourceLayout, onClose, onSave }: EditReminderSheetProps) {
    const { colors, isDark } = useTheme();
    const { tags, priorities } = useSettings();
    const insets = useSafeAreaInsets();

    // Ghost card animation
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const cardTranslateY = useRef(new Animated.Value(0)).current;
    const cardTranslateX = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(1)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
    // Offset for middle position.
    const MIDDLE_Y_OFFSET = SCREEN_HEIGHT * 0.25;
    const chatOffset = useRef(new Animated.Value(MIDDLE_Y_OFFSET)).current;
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Quick-edit field state (local overrides while editing)
    const [editDate, setEditDate] = useState<string | null>(reminder?.date || null);
    const [editTime, setEditTime] = useState<string | null>(reminder?.time || null);
    const [editTagId, setEditTagId] = useState<string | null | undefined>(reminder?.tag_id);
    const [editPriorityId, setEditPriorityId] = useState<string | null | undefined>(reminder?.priority_id);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const [isVisible, setIsVisible] = useState(false);

    const nova = useNovaUpdateChat({
        initialPinnedReminder: reminder,
    });
    const {
        messages, isThinking, inputText, setInputText,
        pinnedReminder, setPinnedReminder,
        suggestions, isGeneratingSuggestions,
        flatListRef, handleSend, handleDraftUpdateConfirm,
        triggerInitialAnalysis,
    } = nova;

    const handleTranscript = (text: string) => {
        setInputText(prev => (prev ? prev + ' ' + text : text));
    };
    const { isRecording, isTranscribing, toggleDictation } = useVoiceDictation(handleTranscript);

    const inputRef = useRef<TextInput>(null);

    // Target position: top of safe area + padding
    const targetY = insets.top + spacing.xl;
    const targetX = spacing.xl;
    const targetWidth = SCREEN_WIDTH - spacing.xl * 2;

    const hasStartedChatting = messages.some(m => m.role === 'user') || inputText.trim().length > 0 || isKeyboardVisible;

    useEffect(() => {
        if (!isVisible) return;
        Animated.spring(chatOffset, {
            toValue: hasStartedChatting ? 0 : MIDDLE_Y_OFFSET,
            friction: 9,
            tension: 60,
            useNativeDriver: false,
        }).start();
    }, [hasStartedChatting, isVisible]);

    // ─────────── Keyboard handling ───────────

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
            setIsKeyboardVisible(true);
            Animated.timing(keyboardHeightAnim, {
                toValue: e.endCoordinates.height,
                duration: e.duration || 250,
                useNativeDriver: false,
            }).start();
        });

        const hideSub = Keyboard.addListener(hideEvent, (e: KeyboardEvent) => {
            setIsKeyboardVisible(false);
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

    // ─────────── Scroll chat on new messages ───────────

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, isThinking]);

    // ─────────── Open / Close Animation ───────────

    useEffect(() => {
        if (reminder && sourceLayout) {
            // Initialize local field state from reminder
            setEditDate(reminder.date || null);
            setEditTime(reminder.time || null);
            setEditTagId(reminder.tag_id);
            setEditPriorityId(reminder.priority_id);

            // Set initial position = source card position
            chatOffset.setValue(MIDDLE_Y_OFFSET);
            const deltaY = sourceLayout.y - (targetY + MIDDLE_Y_OFFSET);
            const deltaX = sourceLayout.x - targetX;
            const scaleX = sourceLayout.width / targetWidth;

            cardTranslateY.setValue(deltaY);
            cardTranslateX.setValue(deltaX);
            cardScale.setValue(scaleX);
            contentOpacity.setValue(0);
            backdropAnim.setValue(0);

            setIsVisible(true);

            // Animate card to top position
            Animated.parallel([
                Animated.spring(cardTranslateY, { toValue: 0, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.spring(cardTranslateX, { toValue: 0, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.spring(cardScale, { toValue: 1, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.timing(backdropAnim, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: false }),
                Animated.timing(contentOpacity, { toValue: 1, duration: ANIM_DURATION, delay: 150, useNativeDriver: false }),
            ]).start();
        }
    }, [reminder, sourceLayout]);

    // Trigger initial analysis when ready
    useEffect(() => {
        if (isVisible && reminder) {
            // Small buffer to ensure everything is settled after animation starts
            const timer = setTimeout(() => {
                triggerInitialAnalysis();
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isVisible, !!reminder, triggerInitialAnalysis]);

    const handleClose = () => {
        Keyboard.dismiss();

        // Auto-save any local edits on close
        if (reminder) {
            const newDate = editDate || reminder.date;
            const newTime = editTime || reminder.time;
            const newTagId = editTagId !== undefined ? editTagId : reminder.tag_id;
            const newPriorityId = editPriorityId !== undefined ? editPriorityId : reminder.priority_id;

            const hasChanges =
                newDate !== reminder.date ||
                newTime !== reminder.time ||
                newTagId !== reminder.tag_id ||
                newPriorityId !== reminder.priority_id;

            if (hasChanges) {
                onSave({
                    title: reminder.title,
                    date: newDate,
                    time: newTime === '' ? null : (newTime || undefined),
                    repeat: reminder.repeat || 'none',
                    repeat_until: reminder.repeat_until,
                    tag_id: newTagId,
                    priority_id: newPriorityId,
                    // Note: We deliberately omit subtasks and notification_offsets from this basic
                    // onSave payload because they are stored in separate tables. Including them
                    // causes a Supabase schema cache error ("Column subtasks does not exist").
                });
            }
        }

        if (sourceLayout) {
            const currentOffset = hasStartedChatting ? 0 : MIDDLE_Y_OFFSET;
            const deltaY = sourceLayout.y - (targetY + currentOffset);
            const deltaX = sourceLayout.x - targetX;
            const scaleX = sourceLayout.width / targetWidth;

            Animated.parallel([
                Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
                Animated.spring(cardTranslateY, { toValue: deltaY, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.spring(cardTranslateX, { toValue: deltaX, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.spring(cardScale, { toValue: scaleX, friction: 9, tension: 60, useNativeDriver: false }),
                Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
            ]).start(() => {
                setIsVisible(false);
                nova.reset();
                onClose();
            });
        } else {
            setIsVisible(false);
            nova.reset();
            onClose();
        }
    };

    const handleOverlayPress = () => {
        if (isPickerOpen) {
            // Let the picker's internal hooks handle closing it; do NOT close the sheet.
            return;
        } else if (isKeyboardVisible) {
            Keyboard.dismiss();
        } else if (messages.some(m => m.panelType === 'notification_settings')) {
            // If the user tapped the overlay while notification setting is open, close and save the sheet
            handleClose();
        } else if (messages.length > 0) {
            // Clear chat and move card back to middle — don't close the sheet
            nova.reset();
        } else {
            handleClose();
        }
    };

    // ─────────── Quick-edit helpers ───────────

    const handleQuickSave = () => {
        handleClose();
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (e.nativeEvent.key === 'Backspace' && inputText === '' && pinnedReminder) {
            setPinnedReminder(null);
        }
    };

    // ─────────── Render ───────────

    if (!isVisible || !reminder) return null;

    const tag = tags.find(t => t.id === (editTagId ?? reminder.tag_id));
    const priority = priorities.find(p => p.id === (editPriorityId ?? reminder.priority_id));

    // Build the ghost card as a Reminder object with current edit state
    const displayReminder: Reminder = {
        ...reminder,
        date: editDate || reminder.date,
        time: editTime || reminder.time,
        tag_id: editTagId !== undefined ? editTagId : reminder.tag_id,
        priority_id: editPriorityId !== undefined ? editPriorityId : reminder.priority_id,
    };

    const pillBottom = Animated.add(
        new Animated.Value(EXPANDED_PILL_BOTTOM),
        keyboardHeightAnim,
    );

    return (
        <>
            {/* Blur Backdrop */}
            <TouchableWithoutFeedback onPress={handleOverlayPress}>
                <Animated.View style={[localStyles.overlay, { opacity: backdropAnim }]}>
                    <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }]} />
                </Animated.View>
            </TouchableWithoutFeedback>

            {/* Close Button */}
            <Animated.View style={{ position: 'absolute', top: insets.top + 8, right: spacing.xl, zIndex: 1002, opacity: contentOpacity }}>
                <TouchableOpacity
                    style={[localStyles.closeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={20} color={colors.foreground} />
                </TouchableOpacity>
            </Animated.View>

            {/* Ghost Card (animated from source to top) */}
            <Animated.View
                style={[
                    localStyles.ghostCard,
                    {
                        top: targetY,
                        left: targetX,
                        width: targetWidth,
                        transform: [
                            { translateY: Animated.add(cardTranslateY, chatOffset) },
                            { translateX: cardTranslateX },
                            { scaleX: cardScale },
                        ],
                    },
                ]}
            >
                <ReminderCard
                    reminder={displayReminder}
                    index={0}
                    onComplete={() => { }}
                    onEdit={() => { }}
                    onNotificationTap={() => {
                        nova.pushNotificationSettings();
                    }}
                />
            </Animated.View>

            {/* Content Area: field chips + chat messages */}
            <Animated.View
                style={[
                    localStyles.contentArea,
                    {
                        opacity: contentOpacity,
                        top: Animated.add(new Animated.Value(targetY + 90), chatOffset) as any,
                        bottom: Animated.add(new Animated.Value(PILL_HEIGHT + EXPANDED_PILL_BOTTOM + 4), keyboardHeightAnim) as any,
                        left: 0,
                        right: 0,
                    },
                ]}
                pointerEvents="box-none"
            >
                {/* Field Chips (Hidden when interaction starts) */}
                {!hasStartedChatting && (
                    <ScrollView
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: isPickerOpen ? spacing.xl * 2 : 0 }}
                        style={{ flexGrow: 0 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <TouchableWithoutFeedback onPress={handleOverlayPress}>
                            <View style={localStyles.chipsContainer}>
                                <InlineEditChips
                                    date={editDate}
                                    time={editTime}
                                    tag_id={editTagId}
                                    priority_id={editPriorityId}
                                    notification_offsets={reminder.notification_offsets}
                                    repeat={reminder.repeat}
                                    subtasks={reminder.subtasks}
                                    onChange={(fields) => {
                                        if (fields.date !== undefined) setEditDate(fields.date);
                                        if (fields.time !== undefined) setEditTime(fields.time);
                                        if (fields.tag_id !== undefined) setEditTagId(fields.tag_id);
                                        if (fields.priority_id !== undefined) setEditPriorityId(fields.priority_id);
                                    }}
                                    onOpenNotifications={nova.pushNotificationSettings}
                                    onOpenRepeat={(nova as any).pushRepeatSettings}
                                    onOpenSubtasks={(nova as any).pushSubtasksSettings}
                                    onPickerStateChange={setIsPickerOpen}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </ScrollView>
                )}


                {/* Chat Messages */}
                {messages.length > 0 || isThinking ? (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        style={{ flexShrink: 1, flexGrow: 0 }}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                colors={colors}
                                tags={tags}
                                reminder={reminder}
                                onOverlayPress={handleOverlayPress}
                                onDraftConfirm={(msgId, draftFields) => {
                                    // Make sure we pass the fields through properly (handleDraftConfirm expects msgId, fields)
                                    // Since we updated the signature of onDraftConfirm, we should use the new draftFields if provided.
                                    // For subtasks, since onChange gets real-time data but we might not have updated the message's panelFields synchronously,
                                    // we can let the "Save Subtasks" button pass the current subtasks to draftFields.
                                    // Actually, we must use the latest state from the InlineSubtaskList, so we'll need to update it.
                                    // The current button sends `message.panelFields.subtasks`. We should ensure this is updated.
                                    // For now, let's keep it simple.
                                    const fieldsToUse = draftFields || messages.find(m => m.id === msgId)?.panelFields;
                                    if (fieldsToUse) {
                                        nova.handleDraftUpdateConfirm(msgId, fieldsToUse);
                                    }
                                }}
                                onDraftDiscard={(msgId) => {
                                    nova.handleDraftDiscard(msgId);
                                }}
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: spacing.lg + 50 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        ListFooterComponent={isThinking ? <TypingIndicator colors={colors} onOverlayPress={handleOverlayPress} /> : null}
                    />
                ) : (
                    <TouchableWithoutFeedback onPress={handleOverlayPress}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>
                )}

                {/* Suggestion Chips */}
                {(!isKeyboardVisible && !isPickerOpen) && (
                    <View style={{ position: 'absolute', bottom: 0, left: -spacing.lg, right: -spacing.lg }}>
                        <SuggestionChips
                            suggestions={suggestions}
                            isGenerating={isGeneratingSuggestions}
                            onSelectSuggestion={(suggestion) => handleSend(suggestion)}
                            colors={colors}
                        />
                    </View>
                )}
            </Animated.View>

            {/* Input Pill */}
            <Animated.View
                style={[
                    localStyles.inputPill,
                    {
                        bottom: pillBottom,
                        opacity: contentOpacity,
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                {/* Context Pill inline */}
                {pinnedReminder && (
                    <View style={[localStyles.contextPill, { backgroundColor: colors.card, borderColor: tag?.color || colors.foreground }]}>
                        <Text style={[localStyles.contextPillText, { color: tag?.color || colors.foreground }]} numberOfLines={1}>
                            {pinnedReminder.title}
                        </Text>
                        <TouchableOpacity onPress={() => setPinnedReminder(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    </View>
                )}

                <TextInput
                    ref={inputRef}
                    style={[localStyles.textInput, { color: colors.foreground, marginLeft: pinnedReminder ? spacing.xs : 0 }]}
                    placeholder={pinnedReminder ? "Ask to update this..." : "Describe your changes..."}
                    placeholderTextColor={colors.mutedForeground}
                    value={inputText}
                    onChangeText={setInputText}
                    onKeyPress={handleKeyPress}
                    returnKeyType="send"
                    onSubmitEditing={() => handleSend()}
                    blurOnSubmit={false}
                    maxLength={200}
                    editable={!isThinking}
                />

                {isTranscribing ? (
                    <Ionicons name="ellipsis-horizontal" size={22} color={colors.mutedForeground} />
                ) : inputText.trim() ? (
                    <TouchableOpacity onPress={() => handleSend()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <View style={[localStyles.sendButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={toggleDictation} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name={isRecording ? "stop-circle" : "mic"} size={24} color={isRecording ? 'red' : colors.mutedForeground} />
                    </TouchableOpacity>
                )}
            </Animated.View>
        </>
    );
}

// ─────────────── Styles ───────────────

const localStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 998,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.soft,
    },
    ghostCard: {
        position: 'absolute',
        zIndex: 1001,
    },
    contentArea: {
        position: 'absolute',
        zIndex: 1000,
        paddingHorizontal: spacing.lg,
    },
    chipsContainer: {
        marginBottom: spacing.md,
    },
    chipsScroll: {
        gap: spacing.sm,
        paddingRight: spacing.md,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        gap: 6,
    },
    chipText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
    },
    pickerContainer: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    inputPill: {
        position: 'absolute',
        left: PILL_HORIZONTAL_MARGIN,
        right: PILL_HORIZONTAL_MARGIN,
        height: PILL_HEIGHT,
        borderRadius: PILL_HEIGHT / 2,
        borderWidth: 1.5,
        zIndex: 1001,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        ...shadows.fab,
    },
    contextPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        maxWidth: 150,
    },
    contextPillText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
        marginRight: 4,
        flexShrink: 1,
    },
    textInput: {
        flex: 1,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        height: '100%',
        paddingVertical: 0,
        marginRight: spacing.sm,
    },
    sendButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Message styles
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        ...shadows.soft,
    },
    userBubble: {
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        borderBottomLeftRadius: 4,
        borderWidth: 1.5,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    messageText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.base,
        lineHeight: 22,
    },
    aiMessageText: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize.lg,
        lineHeight: 22,
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
