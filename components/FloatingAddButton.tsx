import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  LayoutAnimation,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useReminders } from '../hooks/useReminders';
import { scheduleReminderNotification } from '../lib/notifications';
import { callNovaAgent } from '../lib/nova-client';
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';
import { ReminderCard } from './ReminderCard';
import { AddReminderSheet } from './AddReminderSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;
const FAB_SIZE = 56;
const PILL_HORIZONTAL_MARGIN = 20;
const PILL_WIDTH = SCREEN_WIDTH - PILL_HORIZONTAL_MARGIN * 2;
const MIN_PILL_HEIGHT = 52;
const MAX_PILL_HEIGHT = 150;
const FAB_RIGHT = 20;
const TAB_BAR_HEIGHT = 40;
const FAB_ABOVE_TAB_PADDING = 12; // Gap above tab bar
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
    <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.card, alignSelf: 'flex-start', marginLeft: spacing.lg }]}>
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
}: {
  message: ChatMessage;
  colors: any;
  tags: any[];
  onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftEdit?: (messageId: string, draft: ModalFieldUpdates) => void;
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

  if (message.panelType === 'draft' && message.panelFields) {
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
              {isStatic ? 'Reminder Created' : 'Proposed Reminder'}
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
              Tap check to create • Tap card to edit • Swipe to discard
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.aiBubble, { backgroundColor: colors.card }],
        ]}
      >
        <Text
          style={
            isUser
              ? [styles.messageText, { color: colors.primaryForeground }]
              : [styles.aiMessageText, { color: colors.foreground }]
          }
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export function FloatingAddButton({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void } = {}) {
  const { colors, isDark } = useTheme();
  const { tags, priorities } = useSettings();
  const { user } = useAuth();
  const { addReminder } = useReminders();
  const insets = useSafeAreaInsets();

  const [isExpanded, setIsExpanded] = useState(false);
  // Stays true while collapse animation plays so overlay/chat fade out gracefully
  const [isVisible, setIsVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [draftReminder, setDraftReminder] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [pillHeight, setPillHeight] = useState(MIN_PILL_HEIGHT);


  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const rainbowAnim = useRef(new Animated.Value(0)).current;
  // Single animated value driving the pill's bottom position
  const bottomAnim = useRef(new Animated.Value(0)).current;
  // Track keyboard height in a ref so we can use it in expansion state changes
  const keyboardHeightRef = useRef(0);

  // Calculate base bottom (above tab bar)
  const baseFabBottom = insets.bottom + TAB_BAR_HEIGHT + FAB_ABOVE_TAB_PADDING;

  // Initialize bottomAnim once insets are known
  useEffect(() => {
    bottomAnim.setValue(baseFabBottom);
  }, [baseFabBottom]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      // Only lift pill if it's already expanded
      if (isExpanded) {
        Animated.timing(bottomAnim, {
          toValue: e.endCoordinates.height + FAB_ABOVE_TAB_PADDING,
          duration: e.duration || 250,
          useNativeDriver: false,
        }).start();
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, (e: KeyboardEvent) => {
      keyboardHeightRef.current = 0;
      if (isExpanded) {
        Animated.timing(bottomAnim, {
          toValue: baseFabBottom,
          duration: e?.duration || 250,
          useNativeDriver: false,
        }).start();
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
    // Re-run when expansion state changes so the correct behavior is captured
  }, [isExpanded, baseFabBottom]);


  // Rainbow border animation while AI is thinking
  useEffect(() => {
    if (isThinking) {
      rainbowAnim.setValue(0);
      Animated.loop(
        Animated.timing(rainbowAnim, { toValue: 1, duration: 2000, useNativeDriver: false })
      ).start();
    } else {
      rainbowAnim.stopAnimation();
      rainbowAnim.setValue(0);
    }
  }, [isThinking]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isThinking]);

  const expand = () => {
    setIsExpanded(true);
    setIsVisible(true);
    onExpandedChange?.(true);
    // If keyboard is already up (unlikely on expand, but safe), account for it
    const targetBottom = keyboardHeightRef.current > 0
      ? keyboardHeightRef.current + FAB_ABOVE_TAB_PADDING
      : baseFabBottom;
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: false }),
      Animated.timing(bottomAnim, { toValue: targetBottom, duration: ANIM_DURATION, useNativeDriver: false }),
    ]).start(() => {
      inputRef.current?.focus();
    });
  };

  const collapse = () => {
    Keyboard.dismiss();
    // Reset logical state immediately so FAB snaps back to Add button appearance
    setIsExpanded(false);
    onExpandedChange?.(false);
    setInputText('');
    setMessages([]);
    setDraftReminder(null);
    setEditingMessageId(null);
    setPillHeight(MIN_PILL_HEIGHT);
    // Animate collapse, then hide overlay/chat
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(bottomAnim, { toValue: baseFabBottom, duration: 200, useNativeDriver: false }),
    ]).start(() => {
      setIsVisible(false);
    });
  };

  const processMessage = useCallback(async (input: string, currentMessages: ChatMessage[]) => {
    try {
      if (!user) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: "Please log in to use AI features.", timestamp: new Date(),
        }]);
        return;
      }

      const conversationHistory = currentMessages.filter(m =>
        !m.id.startsWith('temp-') && !m.content.includes("I'm sorry, I encountered an error")
      );

      const now = new Date();
      const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Call agent
      const response = await callNovaAgent({ query: input, user_id: user.id, conversation: conversationHistory, client_date: clientDate });
      const lastToolCall = response.tool_calls?.[response.tool_calls.length - 1];

      if (!lastToolCall) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: response.message, timestamp: new Date(),
        }]);
        return;
      }

      const toolName = lastToolCall.tool;
      const toolResult = lastToolCall.result;

      if (toolName === 'draft_reminder') {
        const draft = toolResult.draft;
        const sheetDraft = {
          title: draft.title, date: draft.date, time: draft.time, repeat: draft.repeat || 'none',
          tag_id: draft.tag_name ? tags.find(t => t.name.toLowerCase() === draft.tag_name.toLowerCase())?.id : undefined,
          priority_id: draft.priority_name ? priorities.find(p => p.name.toLowerCase() === draft.priority_name.toLowerCase())?.id : undefined,
          notes: draft.notes,
        };
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: response.message || toolResult.message || "Here's a draft for your reminder:",
          timestamp: new Date(), panelType: 'draft', panelFields: sheetDraft,
        }]);
      } else if (toolName === 'create_reminder') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: response.message || toolResult.message || "Reminder created!", timestamp: new Date(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: response.message, timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: error.message || "An error occurred.", timestamp: new Date(),
      }]);
    } finally {
      setIsThinking(false);
      setInputText(''); // Clear input after response arrives
    }
  }, [user, tags, priorities]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;

    // Keep text in input while thinking — cleared in processMessage's finally block
    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: trimmed, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsThinking(true);
    await processMessage(trimmed, updatedMessages);
  };

  const handleDraftConfirm = async (messageId: string, fields: ModalFieldUpdates) => {
    if (!fields.title?.trim()) return;
    const now = new Date();
    const dateStr = fields.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const result = await addReminder({
      title: fields.title, date: dateStr, time: fields.time, repeat: fields.repeat || 'none',
      tag_id: fields.tag_id, priority_id: fields.priority_id, notes: fields.notes,
    });

    if (!result.error && result.data) {
      try {
        await scheduleReminderNotification(fields.title, dateStr, fields.time || undefined, fields.repeat || 'none', (result.data as Reminder).id);
      } catch (err) { }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, panelIsStatic: true } : m));
      // Not adding the "Anything else?" message to keep UI minimalistic
    }
  };

  const containerWidth = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, PILL_WIDTH] });
  const containerHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, pillHeight] });
  const containerRight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_RIGHT, PILL_HORIZONTAL_MARGIN] });
  const containerBorderRadius = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE / 2, MIN_PILL_HEIGHT / 2] });
  const containerBorderWidth = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] });

  const iconOpacity = expandAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
  const inputOpacity = expandAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const rainbowColor = rainbowAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['#3b82f6', '#7c3aed', '#ec4899', '#7c3aed', '#3b82f6'],
  });
  const rainbowBorderWidth = rainbowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [2, 3, 2],
  });

  // Memoize the draft reminder passed to AddReminderSheet so a new object reference
  // isn't created on every render (which would cause the sheet's useEffect to reset
  // the title every time the user types a character).
  const editingDraftReminder = useMemo(() =>
    draftReminder
      ? { id: 'draft', ...draftReminder, user_id: user?.id || '', completed: false, created_at: new Date().toISOString() } as any
      : undefined,
    [draftReminder, user?.id]
  );

  // Chat list sits just above the pill
  const chatListBottom = Animated.add(bottomAnim, new Animated.Value(pillHeight + 10));

  return (
    <>
      {isVisible && (
        <TouchableWithoutFeedback onPress={collapse}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }]} />
          </Animated.View>
        </TouchableWithoutFeedback>
      )}

      {/* Close button fixed at top-right of screen */}
      {isVisible && (
        <Animated.View style={[styles.closeButtonContainer, { opacity: inputOpacity, top: insets.top + spacing.md }]}>
          <TouchableOpacity
            onPress={collapse}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.closeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {isVisible && (
        <Animated.View
          style={[
            styles.chatListContainer,
            {
              opacity: overlayOpacity,
              bottom: chatListBottom,
            }
          ]}
          pointerEvents="box-none"
        >
          <FlatList
            ref={flatListRef}
            data={messages.filter(m => m.role !== 'user')}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                colors={colors}
                tags={tags}
                onDraftConfirm={(msgId) => {
                  const draftField = messages.find(m => m.id === msgId)?.panelFields;
                  if (draftField) handleDraftConfirm(msgId, draftField);
                }}
                onDraftEdit={(msgId, draft) => {
                  setDraftReminder(draft);
                  setEditingMessageId(msgId);
                  setIsSheetOpen(true);
                }}
                onDraftDiscard={(msgId) => {
                  setMessages(prev => prev.filter(m => m.id !== msgId));
                }}
              />
            )}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
          />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.morphContainer,
          {
            width: containerWidth,
            height: containerHeight,
            right: containerRight,
            bottom: bottomAnim,
            borderRadius: containerBorderRadius,
            backgroundColor: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.primary, colors.card],
            }),
            borderWidth: containerBorderWidth,
            borderColor: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', colors.border],
            }),
            transform: isExpanded ? [] : [{ scale: scaleAnim }],
            ...shadows.fab,
          },
        ]}
      >
        {/* FAB icon (fades out during expand) */}
        <Animated.View style={[styles.fabIconContainer, { opacity: iconOpacity }]} pointerEvents={isVisible ? 'none' : 'auto'}>
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
        <Animated.View style={[styles.pillContent, { opacity: inputOpacity, height: containerHeight }]} pointerEvents={isVisible ? 'auto' : 'none'}>
          <TouchableOpacity
            onPress={() => setIsAddSheetOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.addButton, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` }]}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: colors.foreground }]}
            placeholder="Add a reminder..."
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline={true}
            onContentSizeChange={(e) => {
              if (isExpanded) {
                const newHeight = Math.min(MAX_PILL_HEIGHT, Math.max(MIN_PILL_HEIGHT, e.nativeEvent.contentSize.height + 14));
                if (Math.abs(newHeight - pillHeight) > 2) {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPillHeight(newHeight);
                }
              }
            }}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            maxLength={500}
            editable={!isThinking}
          />

          {inputText.trim() && (
            <TouchableOpacity onPress={handleSend} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>

      {/* Rainbow border overlay — sits on top of pill while AI is thinking */}
      {isExpanded && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: containerWidth,
            height: containerHeight,
            right: containerRight,
            bottom: bottomAnim,
            borderRadius: containerBorderRadius,
            borderWidth: rainbowBorderWidth,
            borderColor: rainbowColor,
            zIndex: 1001,
            opacity: isThinking ? 1 : 0,
          }}
        />
      )}

      <AddReminderSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={async (data: any) => {
          const result = await addReminder(data);
          if (!result.error && editingMessageId) {
            setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, panelIsStatic: true } : m));
            setEditingMessageId(null);
            setIsSheetOpen(false);
          }
          return result;
        }}
        editReminder={editingDraftReminder}
      />

      {/* Quick add sheet from pill + button */}
      <AddReminderSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        onSave={async (data: any) => {
          const result = await addReminder(data);
          if (!result.error) setIsAddSheetOpen(false);
          return result;
        }}
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
    top: 0,
    zIndex: 999,
    justifyContent: 'flex-end', // stack items at the bottom
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
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
    marginRight: spacing.sm,
    textAlignVertical: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 1001,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
