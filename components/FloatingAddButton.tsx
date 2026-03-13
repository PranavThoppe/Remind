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
  onDraftConfirm,
  onDraftEdit,
  onDraftDiscard,
  onSelectSearchResult,
}: {
  message: ChatMessage;
  colors: any;
  tags: any[];
  onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftEdit?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftDiscard?: (messageId: string) => void;
  onSelectSearchResult?: (reminder: Reminder) => void;
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
            onEdit={isStatic ? () => { } : () => onDraftEdit?.(message.id, message.panelFields!)}
            onDelete={isStatic ? undefined : () => onDraftDiscard?.(message.id)}
          />

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

  if ((message.panelType as any) === 'repeat_settings') {
    const isStatic = message.panelIsStatic;
    return (
      <View style={[styles.messageContainer]}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          <InlineRepeatPicker
            initialRepeat={message.panelFields?.repeat}
            reminderDate={message.panelFields?.date || null}
            onConfirm={(rrule) => {
              if (!isStatic) {
                onDraftConfirm?.(message.id, { repeat: rrule });
              }
            }}
            onCancel={() => {
              if (!isStatic) {
                onDraftConfirm?.(message.id, { repeat: 'none' });
                onDraftDiscard?.(message.id);
              }
            }}
          />
        </View>
      </View>
    );
  }

  // Render search results as a list of standard ReminderCards
  if (message.panelType === 'search' && message.panelSearchResults) {
    return (
      <View style={[styles.messageContainer, { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: spacing.lg, width: '100%', maxWidth: 360 }]}>
        <View style={{ marginBottom: 8, marginLeft: 4 }}>
          <Text style={{ fontFamily: typography.fontFamily.medium, fontSize: 13, color: colors.primary }}>Search Results</Text>
        </View>
        <View style={{ gap: spacing.sm, width: '100%' }}>
          {message.panelSearchResults.map((reminder, idx) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              index={idx}
              onComplete={onDraftConfirm ? (_) => onDraftConfirm(message.id, { ...reminder }) : () => { }}
              onEdit={onSelectSearchResult ? (_) => onSelectSearchResult(reminder) : () => { }}
            />
          ))}
          <Text style={{ textAlign: 'center', marginTop: 8, color: colors.mutedForeground, fontSize: 11 }}>
            Tap a card to pin it as context for updates.
          </Text>
        </View>
      </View>
    );
  }

  // Render after-action reminder list (e.g. remaining reminders after delete)
  if (message.panelType === 'reminder_list') {
    const hasCards = message.panelSearchResults && message.panelSearchResults.length > 0;
    return (
      <View style={[styles.messageContainer, { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: spacing.lg, width: '100%', maxWidth: 360 }]}>
        {/* AI confirmation text */}
        {message.content ? (
          <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: hasCards ? spacing.md : 0 }]}>
            <Text style={[styles.aiMessageText, { color: colors.foreground }]}>{message.content}</Text>
          </View>
        ) : null}
        {/* Remaining reminder cards */}
        {hasCards && (
          <View style={{ gap: spacing.sm, width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, marginBottom: 2 }}>
              <Ionicons name="list" size={13} color={colors.mutedForeground} style={{ marginRight: 5 }} />
              <Text style={{ fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.mutedForeground }}>Today's Reminders</Text>
            </View>
            {message.panelSearchResults!.map((reminder, idx) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                index={idx}
                onComplete={() => { }}
                onEdit={onSelectSearchResult ? (_) => onSelectSearchResult(reminder) : () => { }}
              />
            ))}
            <Text style={{ textAlign: 'center', marginTop: 4, color: colors.mutedForeground, fontSize: 11 }}>
              Tap a card to pin it as context.
            </Text>
          </View>
        )}
        {!hasCards && !message.content && (
          <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.aiMessageText, { color: colors.foreground }]}>No remaining reminders for today.</Text>
          </View>
        )}
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

  const nova = useNovaAddChat();
  const {
    messages, setMessages, isThinking, inputText, setInputText,
    selectedImage, setSelectedImage,
    flatListRef, handleSend, handleDraftConfirm, handleDraftDiscard
  } = nova;

  const handleTranscript = (text: string) => {
    setInputText(prev => (prev ? prev + ' ' + text : text));
  };
  const { isRecording, isTranscribing, toggleDictation } = useVoiceDictation(handleTranscript);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draftReminder, setDraftReminder] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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
      setDraftReminder(null);
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
          {/* Top Right Close Button */}
          <TouchableOpacity
            style={[styles.topRightCloseButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={collapse}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>

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
                onDraftConfirm={(msgId) => {
                  const draftField = messages.find(m => m.id === msgId)?.panelFields;
                  if (draftField) {
                    handleDraftConfirm(msgId, draftField);
                  }
                }}
                onDraftEdit={(msgId, draft) => {
                  setDraftReminder(draft);
                  setEditingMessageId(msgId);
                  setIsSheetOpen(true);
                }}
                onDraftDiscard={(msgId) => {
                  handleDraftDiscard(msgId);
                }}
                onSelectSearchResult={(r) => {
                  // When we split completely, tapping a search result in the Add flow could open the EditReminderSheet 
                  // instead of handling it inline. For now, we do nothing or could alert.
                  Alert.alert("Edit", "Tap the card in the list to edit.");
                }}
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

      <AddReminderSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={async (data: any) => {
          const result = await addReminder(data);
          if (!result.error && editingMessageId) {
            setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, panelIsStatic: true, panelFields: { ...m.panelFields, ...data } } : m));
            setEditingMessageId(null);
            setIsSheetOpen(false);
          }
          return result;
        }}
        editReminder={draftReminder ? { id: 'draft', ...draftReminder, user_id: user?.id || '', completed: false, created_at: new Date().toISOString() } as any : undefined}
      />
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
  topRightCloseButton: {
    position: 'absolute',
    top: -10, // Moved down to avoid iOS status bar overlap
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
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
  }
});

