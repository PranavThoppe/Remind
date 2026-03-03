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
import { Reminder } from '../types/reminder';
import { ReminderCard, CardLayout } from './ReminderCard';
import { SuggestionChips } from './SuggestionChips';
import { ModalFieldUpdates, ChatMessage } from '../types/ai-chat';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PILL_HEIGHT = 52;
const PILL_HORIZONTAL_MARGIN = 20;
const EXPANDED_PILL_BOTTOM = 32; // Tweak this value to move the pill higher/lower
const ANIM_DURATION = 350;

// ─────────────── Reusable sub-components from FloatingAddButton ───────────────

function TypingIndicator({ colors }: { colors: any }) {
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
        <View style={[localStyles.messageBubble, localStyles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border, alignSelf: 'flex-start', marginLeft: spacing.lg }]}>
            <View style={localStyles.typingContainer}>
                <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot1)]} />
                <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot2)]} />
                <Animated.View style={[localStyles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot3)]} />
            </View>
        </View>
    );
}

function MessageBubble({
    message,
    colors,
    tags,
    onDraftConfirm,
    onDraftDiscard,
}: {
    message: ChatMessage;
    colors: any;
    tags: any[];
    onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
    onDraftDiscard?: (messageId: string) => void;
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
    });

    if ((message.panelType === 'draft' || (message.panelType as any) === 'draft_update') && message.panelFields) {
        const draftReminder = getDraftReminder(message.panelFields);
        const isStatic = message.panelIsStatic;

        return (
            <View style={[localStyles.messageContainer]}>
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
                    />

                    {!isStatic && (
                        <Text style={{ textAlign: 'center', marginTop: 8, color: colors.mutedForeground, fontSize: 11 }}>
                            Tap check to update • Swipe to discard
                        </Text>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[localStyles.messageContainer, isUser && localStyles.userMessageContainer]}>
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
        </View>
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
    const [editDate, setEditDate] = useState<Date | undefined>();
    const [editTime, setEditTime] = useState('');
    const [editTagId, setEditTagId] = useState<string | null | undefined>();
    const [editPriorityId, setEditPriorityId] = useState<string | null | undefined>();
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [isVisible, setIsVisible] = useState(false);

    const nova = useNovaUpdateChat({
        initialPinnedReminder: reminder,
    });
    const {
        messages, isThinking, inputText, setInputText,
        pinnedReminder, setPinnedReminder,
        suggestions, isGeneratingSuggestions,
        flatListRef, handleSend, handleDraftUpdateConfirm,
    } = nova;

    const inputRef = useRef<TextInput>(null);

    // Target position: top of safe area + padding
    const targetY = insets.top + spacing.xl;
    const targetX = spacing.xl;
    const targetWidth = SCREEN_WIDTH - spacing.xl * 2;

    const hasStartedChatting = messages.length > 0 || inputText.trim().length > 0 || isKeyboardVisible;

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
            setEditDate(reminder.date ? new Date(reminder.date + 'T00:00:00') : undefined);
            setEditTime(reminder.time || '');
            setEditTagId(reminder.tag_id);
            setEditPriorityId(reminder.priority_id);
            setShowDatePicker(false);
            setShowTimePicker(false);

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

    const handleClose = () => {
        Keyboard.dismiss();
        setShowDatePicker(false);
        setShowTimePicker(false);

        // Auto-save any local edits on close
        if (reminder) {
            const newDate = editDate ? `${editDate.getFullYear()}-${(editDate.getMonth() + 1).toString().padStart(2, '0')}-${editDate.getDate().toString().padStart(2, '0')}` : reminder.date;
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
                    time: newTime || undefined,
                    repeat: reminder.repeat || 'none',
                    repeat_until: reminder.repeat_until,
                    tag_id: newTagId,
                    priority_id: newPriorityId,
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
        if (isKeyboardVisible) {
            Keyboard.dismiss();
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

    const formatDate = (d: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    const formatDisplayTime = (timeStr: string) => {
        if (!timeStr) return 'No time';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
        date: editDate ? `${editDate.getFullYear()}-${(editDate.getMonth() + 1).toString().padStart(2, '0')}-${editDate.getDate().toString().padStart(2, '0')}` : reminder.date,
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
                {/* Quick-Edit Field Chips */}
                <View style={localStyles.chipsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.chipsScroll}>
                        {/* Date Chip */}
                        <TouchableOpacity
                            style={[localStyles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowDatePicker(!showDatePicker);
                                setShowTimePicker(false);
                            }}
                        >
                            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                            <Text style={[localStyles.chipText, { color: colors.foreground }]}>
                                {editDate ? formatDate(editDate) : 'No date'}
                            </Text>
                        </TouchableOpacity>

                        {/* Time Chip */}
                        <TouchableOpacity
                            style={[localStyles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowTimePicker(!showTimePicker);
                                setShowDatePicker(false);
                            }}
                        >
                            <Ionicons name="time-outline" size={14} color={colors.primary} />
                            <Text style={[localStyles.chipText, { color: colors.foreground }]}>
                                {formatDisplayTime(editTime)}
                            </Text>
                        </TouchableOpacity>

                        {/* Tag Chip */}
                        <TouchableOpacity
                            style={[
                                localStyles.chip,
                                {
                                    backgroundColor: tag ? `${tag.color}20` : colors.card,
                                    borderColor: tag ? tag.color : colors.border,
                                },
                            ]}
                            onPress={() => {
                                // Cycle through tags
                                const currentIdx = tags.findIndex(t => t.id === editTagId);
                                if (currentIdx === -1 || currentIdx === tags.length - 1) {
                                    setEditTagId(tags.length > 0 ? tags[0].id : null);
                                } else {
                                    setEditTagId(tags[currentIdx + 1].id);
                                }
                            }}
                            onLongPress={() => setEditTagId(null)}
                        >
                            <Ionicons name="pricetag-outline" size={14} color={tag ? tag.color : colors.mutedForeground} />
                            <Text style={[localStyles.chipText, { color: tag ? tag.color : colors.mutedForeground }]}>
                                {tag ? tag.name : 'No tag'}
                            </Text>
                        </TouchableOpacity>

                        {/* Priority Chip */}
                        <TouchableOpacity
                            style={[
                                localStyles.chip,
                                {
                                    backgroundColor: priority ? `${priority.color}20` : colors.card,
                                    borderColor: priority ? priority.color : colors.border,
                                },
                            ]}
                            onPress={() => {
                                const currentIdx = priorities.findIndex(p => p.id === editPriorityId);
                                if (currentIdx === -1 || currentIdx === priorities.length - 1) {
                                    setEditPriorityId(priorities.length > 0 ? priorities[0].id : null);
                                } else {
                                    setEditPriorityId(priorities[currentIdx + 1].id);
                                }
                            }}
                            onLongPress={() => setEditPriorityId(null)}
                        >
                            <Ionicons name="flag-outline" size={14} color={priority ? priority.color : colors.mutedForeground} />
                            <Text style={[localStyles.chipText, { color: priority ? priority.color : colors.mutedForeground }]}>
                                {priority ? priority.name : 'No priority'}
                            </Text>
                        </TouchableOpacity>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[localStyles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                            onPress={handleQuickSave}
                        >
                            <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                            <Text style={[localStyles.chipText, { color: colors.primaryForeground, fontFamily: typography.fontFamily.semibold }]}>
                                Save
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Inline Pickers */}
                {showDatePicker && (
                    <View style={[localStyles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <DateTimePicker
                            value={editDate || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(_event: any, selectedDate?: Date) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (selectedDate) setEditDate(selectedDate);
                            }}
                            textColor={colors.foreground}
                            themeVariant={isDark ? 'dark' : 'light'}
                        />
                    </View>
                )}

                {showTimePicker && (
                    <View style={[localStyles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <DateTimePicker
                            value={(() => {
                                if (!editTime) return new Date();
                                const [h, m] = editTime.split(':').map(Number);
                                const d = new Date(); d.setHours(h, m, 0, 0);
                                return d;
                            })()}
                            mode="time"
                            is24Hour={false}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_event: any, selectedTime?: Date) => {
                                setShowTimePicker(Platform.OS === 'ios');
                                if (selectedTime) {
                                    const hours = selectedTime.getHours().toString().padStart(2, '0');
                                    const mins = selectedTime.getMinutes().toString().padStart(2, '0');
                                    setEditTime(`${hours}:${mins}`);
                                }
                            }}
                            textColor={colors.foreground}
                            themeVariant={isDark ? 'dark' : 'light'}
                        />
                    </View>
                )}

                {/* Chat Messages */}
                {messages.length > 0 || isThinking ? (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        style={{ flexGrow: 1 }}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                colors={colors}
                                tags={tags}
                                onDraftConfirm={(msgId) => {
                                    const draftField = messages.find(m => m.id === msgId)?.panelFields;
                                    if (draftField) {
                                        handleDraftUpdateConfirm(msgId, draftField);
                                    }
                                }}
                                onDraftDiscard={(msgId) => {
                                    nova.setMessages(prev => prev.filter(m => m.id !== msgId));
                                }}
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: spacing.lg + 50 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
                    />
                ) : (
                    <TouchableWithoutFeedback onPress={handleOverlayPress}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>
                )}

                {/* Suggestion Chips */}
                {!isKeyboardVisible && (
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

                {inputText.trim() ? (
                    <TouchableOpacity onPress={() => handleSend()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <View style={[localStyles.sendButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => Alert.alert("Coming Soon", "Voice dictation is under development!")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="mic" size={22} color={colors.mutedForeground} />
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
