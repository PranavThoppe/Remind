import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
  View,
  Keyboard,
  Platform,
  Dimensions,
  FlatList,
  Text,
  KeyboardEvent,
  Image,
  Alert,
  NativeSyntheticEvent,
  TextInputKeyPressEventData
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { shadows, spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useReminders } from '../hooks/useReminders';
import { useNovaAddChat } from '../hooks/useNovaAddChat';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';
import { ReminderCard } from './ReminderCard';
import { AddReminderSheet } from './AddReminderSheet';
import { InlineRepeatPicker } from './InlineRepeatPicker';
import { InlineSubtaskList } from './InlineSubtaskList';
import { InlineEditChips } from './InlineEditChips';
import { DayOverviewModal } from './DayOverviewModal';
import { ManualAddReminder } from './ManualAddReminder';

const SCREEN_WIDTH = Dimensions.get('window').width;
const FAB_SIZE = 56;
const PILL_HEIGHT = 52;
const PILL_HORIZONTAL_MARGIN = 20;
const PILL_WIDTH = SCREEN_WIDTH - PILL_HORIZONTAL_MARGIN * 2;
const FAB_RIGHT = 20;
const FAB_BOTTOM = 90;
const EXPANDED_PILL_BOTTOM = 32; // Tweak this value to move the pill higher/lower
const ANIM_DURATION = 350;

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
    <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border, alignSelf: 'flex-start', marginLeft: spacing.lg }]}>
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  colors,
  tags,
  isEditingInline,
  onDraftConfirm,
  onDraftDiscard,
  onToggleInlineEdit,
  onDraftUpdateFields,
  onDraftPanelConfirm,
  onDraftPanelChange,
  onPushRepeatSettings,
  onPushSubtasksSettings,
  onPushNotificationSettings,
}: {
  message: ChatMessage;
  colors: any;
  tags: any[];
  isEditingInline?: boolean;
  onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftDiscard?: (messageId: string) => void;
  onToggleInlineEdit?: (messageId: string) => void;
  onDraftUpdateFields?: (messageId: string, fields: Partial<Reminder>) => void;
  onDraftPanelConfirm?: (draftMsgId: string, panelMsgId: string, fields: ModalFieldUpdates) => void;
  // Real-time field changes from a panel (no static marking, no DB write — just state sync)
  onDraftPanelChange?: (panelMsgId: string, fields: ModalFieldUpdates) => void;
  onPushRepeatSettings?: (fields: { repeat?: string; date?: string | null }) => void;
  onPushSubtasksSettings?: (fields: { subtasks?: any[] }) => void;
  onPushNotificationSettings?: () => void;
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
      <View style={[styles.messageContainer]}>
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
                : 'Proposed Reminder'}
            </Text>
          </View>

          <ReminderCard
            reminder={draftReminder}
            index={0}
            onComplete={isStatic ? () => { } : () => onDraftConfirm?.(message.id, message.panelFields!)}
            onEdit={isStatic ? () => { } : () => onToggleInlineEdit?.(message.id)}
            onDelete={isStatic ? undefined : () => onDraftDiscard?.(message.id)}
          />

          {!isStatic && isEditingInline && (
            <InlineEditChips
              date={draftReminder.date ?? null}
              time={draftReminder.time ?? null}
              tag_id={draftReminder.tag_id ?? null}
              priority_id={draftReminder.priority_id ?? null}
              repeat={draftReminder.repeat}
              subtasks={draftReminder.subtasks}
              notification_offsets={draftReminder.notification_offsets}
              onChange={(fields) => onDraftUpdateFields?.(message.id, fields)}
              onOpenRepeat={() => {
                // Close chips and spawn the repeat picker panel in the chat
                onToggleInlineEdit?.(message.id);
                onPushRepeatSettings?.({
                  repeat: message.panelFields?.repeat,
                  date: message.panelFields?.date,
                });
              }}
              onOpenSubtasks={() => {
                // Close chips and spawn the subtasks panel in the chat
                onToggleInlineEdit?.(message.id);
                onPushSubtasksSettings?.({
                  subtasks: message.panelFields?.subtasks,
                });
              }}
              onOpenNotifications={() => {
                onToggleInlineEdit?.(message.id);
                onPushNotificationSettings?.();
              }}
            />
          )}

          {!isStatic && (
            <Text style={{ textAlign: 'center', marginTop: 8, color: colors.mutedForeground, fontSize: 11 }}>
              {(message.panelType as any) === 'draft_update'
                ? "Tap check to update • Tap card to edit • Swipe to discard"
                : "Tap check to create • Tap card to edit • Swipe to discard"}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // repeat_settings panel — injected when user taps the Repeat chip on a draft
  if (message.panelType === 'repeat_settings') {
    const isStatic = message.panelIsStatic;
    return (
      <View style={[styles.messageContainer]}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          <InlineRepeatPicker
            initialRepeat={message.panelFields?.repeat}
            reminderDate={message.panelFields?.date || null}
            onConfirm={(rrule) => {
              if (!isStatic) {
                onDraftPanelConfirm?.(message.id, message.id, { repeat: rrule });
              }
            }}
            onCancel={() => {
              if (!isStatic) {
                onDraftDiscard?.(message.id);
              }
            }}
          />
        </View>
      </View>
    );
  }

  // subtasks_settings panel — injected when user taps the Subtasks chip
  if ((message.panelType as any) === 'subtasks_settings') {
    const isStatic = message.panelIsStatic;
    return (
      <View style={[styles.messageContainer]}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          <InlineSubtaskList
            subtasks={message.panelFields?.subtasks || []}
            onChange={(updatedSubtasks) => {
              // Real-time sync — update both panel message and draft message panelFields
              onDraftPanelChange?.(message.id, { subtasks: updatedSubtasks });
            }}
            onSave={!isStatic ? (subtasks) => {
              // onSave fires on unmount: do a final confirm to also mark the panel static
              onDraftPanelConfirm?.(message.id, message.id, { subtasks });
            } : undefined}
            onCancel={() => {
              if (!isStatic) {
                onDraftDiscard?.(message.id);
              }
            }}
          />
        </View>
      </View>
    );
  }

  // day_overview panel — rendered inline after a reminder is confirmed
  if ((message.panelType as any) === 'day_overview' && message.panelFields?.date) {
    return (
      <View style={[styles.messageContainer]}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 }}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: typography.fontFamily.medium }}>
              Your day
            </Text>
          </View>
          <DayOverviewModal date={message.panelFields.date as string} />
        </View>
      </View>
    );
  }

  const renderContent = () => {
    return (
      <View>
        {message.imageUri && (
          <Image
            source={{ uri: message.imageUri }}
            style={{
              width: 200,
              height: 150,
              borderRadius: borderRadius.md,
              marginBottom: message.content ? spacing.sm : 0,
            }}
            resizeMode="cover"
          />
        )}
        {message.content ? (
          <Text
            style={
              isUser
                ? [styles.messageText, { color: colors.primaryForeground }]
                : [styles.aiMessageText, { color: colors.foreground }]
            }
          >
            {message.content}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        {renderContent()}
      </View>
    </View>
  );
}

interface FloatingAddButtonProps {
  onExpandedChange?: (expanded: boolean) => void;
}

export function FloatingAddButton({ onExpandedChange }: FloatingAddButtonProps) {
  const { colors, isDark } = useTheme();
  const { tags } = useSettings();
  const { user } = useAuth();
  const { addReminder } = useReminders();
  const insets = useSafeAreaInsets();

  const nova = useNovaAddChat({
    onNetworkError: (failedText: string) => {
      collapse();
      setManualInitialTitle(failedText);
      setTimeout(() => setIsManualOpen(true), 400); // wait for collapse
    }
  });
  const {
    messages, setMessages, isThinking, inputText, setInputText,
    selectedImage, setSelectedImage, dayOverviewDate,
    flatListRef, handleSend, handleDraftConfirm, handleDraftDiscard,
    pushRepeatSettings, pushSubtasksSettings, pushNotificationSettings
  } = nova;

  const handleTranscript = (text: string) => {
    setInputText(prev => (prev ? prev + ' ' + text : text));
  };
  const { isRecording, isTranscribing, toggleDictation } = useVoiceDictation(handleTranscript);

  const [isExpanded, setIsExpanded] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualInitialTitle, setManualInitialTitle] = useState('');

  const inputRef = useRef<TextInput>(null);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  const keyboardOffset = useRef(Animated.multiply(keyboardHeightAnim, expandAnim)).current;
  const baseBottom = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_BOTTOM, EXPANDED_PILL_BOTTOM] });
  const pillBottom = Animated.add(baseBottom, keyboardOffset);
  // Reduce absolute spacing from top of screen to prevent notch overlap
  const listBottom = Animated.add(Animated.add(baseBottom, new Animated.Value(PILL_HEIGHT + (selectedImage ? 90 : 4))), keyboardOffset);

  // Image Picker Logic
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };


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

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isThinking]);

  const expand = () => {
    setIsExpanded(true);
    onExpandedChange?.(true);
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: false }),
    ]).start(() => {
      inputRef.current?.focus();
    });
  };

  const collapse = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => {
      setIsExpanded(false);
      onExpandedChange?.(false);
      nova.reset();
      setEditingMessageId(null);
    });
  };

  const handleOverlayPress = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    } else {
      collapse();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    // Logic for deleting chips later if needed
  };

  const containerWidth = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, PILL_WIDTH] });
  const containerHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, PILL_HEIGHT] });
  const containerRight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_RIGHT, PILL_HORIZONTAL_MARGIN] });
  const containerBorderRadius = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE / 2, PILL_HEIGHT / 2] });

  const iconOpacity = expandAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
  const inputOpacity = expandAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });



  return (
    <>
      {isExpanded && (
        <TouchableWithoutFeedback onPress={handleOverlayPress}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }]} />
          </Animated.View>
        </TouchableWithoutFeedback>
      )}

      {isExpanded && (
        <Animated.View
          style={[
            styles.chatListContainer,
            {
              opacity: overlayOpacity,
              bottom: listBottom,
              top: insets.top + spacing.xl,
            }
          ]}
          pointerEvents="box-none"
        >
          {/* Top Right Buttons */}
          <View style={[styles.topButtonsContainer, { right: spacing.xl }]}>
            <TouchableOpacity
              style={[styles.topActionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => {
                nova.reset();
                setEditingMessageId(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={collapse}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            style={{ flexGrow: 0 }}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                colors={colors}
                tags={tags}
                isEditingInline={editingMessageId === item.id}
                onDraftConfirm={(msgId) => {
                  const draftField = messages.find(m => m.id === msgId)?.panelFields;
                  if (draftField) {
                    handleDraftConfirm(msgId, draftField);
                  }
                }}
                onToggleInlineEdit={(msgId) => {
                  setEditingMessageId(prev => prev === msgId ? null : msgId);
                }}
                onDraftUpdateFields={(msgId, fields) => {
                  setMessages(prev => prev.map(m => m.id === msgId && m.panelFields ? { ...m, panelFields: { ...m.panelFields, ...fields } } : m));
                }}
                onDraftDiscard={(msgId) => {
                  handleDraftDiscard(msgId);
                }}
                // When a repeat/subtask panel confirms, find the most recent draft message and merge into its panelFields
                onDraftPanelConfirm={(_panelMsgId, panelMsgId, fields) => {
                  // Find the most recent unfinalised draft message to update
                  const draftMsg = [...messages].reverse().find(m => (m.panelType === 'draft' || (m.panelType as any) === 'draft_update') && !m.panelIsStatic);
                  if (draftMsg) {
                    setMessages(prev => prev.map(m => {
                      if (m.id === draftMsg.id && m.panelFields) {
                        return { ...m, panelFields: { ...m.panelFields, ...fields } };
                      }
                      // Mark the panel message as static (consumed)
                      if (m.id === panelMsgId) {
                        return { ...m, panelIsStatic: true };
                      }
                      return m;
                    }));
                  }
                }}
                // Real-time change from a panel (e.g. each keystroke in subtask list) — syncs into both panel + draft without marking static
                onDraftPanelChange={(panelMsgId, fields) => {
                  setMessages(prev => {
                    const draftMsg = [...prev].reverse().find(
                      m => (m.panelType === 'draft' || (m.panelType as any) === 'draft_update') && !m.panelIsStatic
                    );
                    return prev.map(m => {
                      // Update the panel message's own panelFields so it re-renders with current data
                      if (m.id === panelMsgId && m.panelFields) {
                        return { ...m, panelFields: { ...m.panelFields, ...fields } };
                      }
                      // Also propagate into the draft's panelFields so checkmark confirm picks them up
                      if (draftMsg && m.id === draftMsg.id && m.panelFields) {
                        return { ...m, panelFields: { ...m.panelFields, ...fields } };
                      }
                      return m;
                    });
                  });
                }}
                onPushRepeatSettings={(fields) => pushRepeatSettings(fields)}
                onPushSubtasksSettings={(fields) => pushSubtasksSettings(fields)}
                onPushNotificationSettings={() => pushNotificationSettings()}
              />
            )}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
          />

          {/* Image Preview - Shows above input if selected */}
          {selectedImage && (
            <View style={[styles.imagePreviewContainer, {
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'flex-start'
            }]}>
              <View>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}

        </Animated.View>
      )}

      {/* Manual Entry Button — above the pill on the right */}
      {isExpanded && (
        <Animated.View
          style={[
            styles.manualEntryButton,
            {
              bottom: Animated.add(pillBottom, new Animated.Value(PILL_HEIGHT + spacing.sm)) as any,
              opacity: overlayOpacity,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              collapse();
              setManualInitialTitle('');
              setTimeout(() => setIsManualOpen(true), 400);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={{ fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>
              Manual
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.morphContainer,
          {
            width: containerWidth,
            height: containerHeight,
            right: containerRight,
            bottom: pillBottom,
            borderRadius: containerBorderRadius,
            backgroundColor: isExpanded ? colors.card : colors.primary,
            borderWidth: isExpanded ? 1.5 : 0,
            borderColor: isExpanded ? colors.border : 'transparent',
            transform: isExpanded ? [] : [{ scale: scaleAnim }],
            zIndex: 1000,
            ...shadows.fab,
          },
        ]}
      >
        {/* FAB icon (fades out during expand) */}
        <Animated.View style={[styles.fabIconContainer, { opacity: iconOpacity }]} pointerEvents={isExpanded ? 'none' : 'auto'}>
          <TouchableOpacity
            style={styles.touchable}
            onPress={expand}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.92, friction: 5, useNativeDriver: false }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }).start()}
            activeOpacity={1}
          >
            <Ionicons name="add" size={28} color={colors.primaryForeground} />
          </TouchableOpacity>
        </Animated.View>

        {/* Morph to pill with input */}
        <Animated.View style={[styles.pillContent, { opacity: inputOpacity }]} pointerEvents={isExpanded ? 'auto' : 'none'}>

          <TouchableOpacity onPress={handlePickImage} disabled={isThinking} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add" size={24} color={colors.primary} style={styles.addIcon} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: colors.foreground }]}
            placeholder="Add a reminder..."
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
          ) : inputText.trim() || selectedImage ? (
            <TouchableOpacity onPress={() => handleSend()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={toggleDictation} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={isRecording ? "stop-circle" : "mic"} size={24} color={isRecording ? 'red' : colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>

      {/* AddReminderSheet removed - inline editing is now used instead */}

      {/* Manual Add Reminder (offline / non-AI) */}
      {isManualOpen && (
        <ManualAddReminder
          visible={isManualOpen}
          onClose={() => setIsManualOpen(false)}
          initialTitle={manualInitialTitle}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },
  chatListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    justifyContent: 'flex-end', // stack items at the bottom
  },
  topButtonsContainer: {
    position: 'absolute',
    top: -10, // Moved down to avoid iOS status bar overlap
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 1000,
  },
  topActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  morphContainer: {
    position: 'absolute',
    zIndex: 1000,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  addIcon: {
    marginRight: spacing.sm,
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
    paddingHorizontal: spacing.lg,
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
  imagePreviewContainer: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    left: 70, // Offset from image edge
    backgroundColor: 'red',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  contextPillClose: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualEntryButton: {
    position: 'absolute',
    right: PILL_HORIZONTAL_MARGIN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 1000,
    ...shadows.soft,
  },
});

