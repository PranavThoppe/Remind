import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useReminders } from '../../hooks/useReminders';
import { AiLiveReminderPanel } from '../../components/AiLiveReminderPanel';
import { InlineReminderPanel } from '../../components/InlineReminderPanel';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { ReminderCard } from '../../components/ReminderCard';
import { ChatMessage, ModalFieldUpdates, MockAIResponse } from '../../types/ai-chat';
import { Reminder } from '../../types/reminder';
import { scheduleReminderNotification } from '../../lib/notifications';
import { callNovaAgent } from '../../lib/nova-client';
import { VoiceModeButton } from '../../components/voice/VoiceModeButton';
import { PremiumLockOverlay } from '../../components/PremiumLockOverlay';

// Typing indicator component
function TypingIndicator({ colors }: { colors: any }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.card }]}>
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

// Message bubble component
function MessageBubble({
  message,
  colors,
  tags,
  onPanelFieldsChange,
  onPanelSave,
  onPanelClose,
  onSelectReminder,
  onDraftConfirm,
  onDraftEdit,
  onDraftDiscard,
}: {
  message: ChatMessage;
  colors: any;
  tags: any[];
  onPanelFieldsChange?: (messageId: string, fields: ModalFieldUpdates) => void;
  onPanelSave?: (messageId: string) => void;
  onPanelClose?: (messageId: string) => void;
  onSelectReminder?: (reminder: Reminder) => void;
  onDraftConfirm?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftEdit?: (messageId: string, draft: ModalFieldUpdates) => void;
  onDraftDiscard?: (messageId: string) => void;
}) {
  const isUser = message.role === 'user';

  // Helper to create a temporary reminder object for the draft card
  const getDraftReminder = (fields: ModalFieldUpdates): Reminder => {
    return {
      id: `draft-${message.id}`,
      user_id: 'current-user', // specific id not strict for visual representation
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
    };
  };

  // If message is a draft, verify it renders as a ReminderCard
  if (message.panelType === 'draft' && message.panelFields) {
    const draftReminder = getDraftReminder(message.panelFields);
    const isStatic = message.panelIsStatic;

    return (
      <View style={[styles.messageContainer, styles.panelMessageContainer]}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          {/* Header for the draft card */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
            marginLeft: 4
          }}>
            <Ionicons
              name={isStatic ? "checkmark-circle" : "sparkles"}
              size={16}
              color={isStatic ? colors.success : colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={{
              color: isStatic ? colors.success : colors.mutedForeground,
              fontSize: 12,
              fontFamily: typography.fontFamily.medium
            }}>
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
            <Text style={{
              textAlign: 'center',
              marginTop: 8,
              color: colors.mutedForeground,
              fontSize: 11
            }}>
              Tap check to create • Tap card to edit • Swipe to discard
            </Text>
          )}
        </View>
      </View>
    );
  }

  // If message has panel data, render inline panel
  if (message.panelType) {
    return (
      <View style={[styles.messageContainer, styles.panelMessageContainer]}>
        <InlineReminderPanel
          type={message.panelType as 'create' | 'edit' | 'search'}
          fields={message.panelFields}
          searchResults={message.panelSearchResults}
          isStatic={message.panelIsStatic}
          onFieldsChange={(fields) => onPanelFieldsChange?.(message.id, fields)}
          onSave={() => onPanelSave?.(message.id)}
          onClose={() => onPanelClose?.(message.id)}
          onSelectReminder={onSelectReminder}
        />
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
          isUser ? (
            <Text
              style={[
                styles.messageText,
                { color: colors.primaryForeground },
              ]}
            >
              {message.content}
            </Text>
          ) : (
            // AI messages: Highlight tags if they appear in text
            <Text style={[styles.aiMessageText, { color: colors.foreground }]}>
              {message.content.split(/(\b\w+\b)/g).map((part, i) => {
                const tag = tags.find(t => t.name.toLowerCase() === part.toLowerCase());
                if (tag) {
                  return (
                    <Text key={i} style={{ color: tag.color, fontWeight: 'regular' }}>
                      {part}
                    </Text>
                  );
                }
                return part;
              })}
            </Text>
          )
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      <View
        style={[
          styles.messageBubble,
          isUser ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: colors.card }],
        ]}
      >
        {renderContent()}
      </View>
    </View>
  );
}

export default function AIChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tags, priorities } = useSettings();
  const { user, profile } = useAuth();
  const { addReminder, updateReminder } = useReminders();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi, I'm Mind. I can help you create, find, or update reminders.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draftReminder, setDraftReminder] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Helper functions for parsing
  const formatDateString = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getTodayDateString = useCallback((): string => {
    return formatDateString(new Date());
  }, [formatDateString]);

  // Image Picker Logic
  const handlePickImage = async () => {
    // Request permission
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

  const handleSheetSave = useCallback(async (data: any) => {
    let result = await addReminder(data);

    if (!result.error && result.data) {
      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Reminder created successfully! Do you need anything else?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);

      // If we were editing a message from the chat, mark it as static/confirmed
      if (editingMessageId) {
        setMessages(prev => prev.map(msg =>
          msg.id === editingMessageId ? { ...msg, panelIsStatic: true } : msg
        ));
        setEditingMessageId(null);
      }

      setDraftReminder(null);
      setIsSheetOpen(false);
    }
    return result;
  }, [addReminder]);

  // Process message with Nova Agent
  const processMessage = useCallback(async (input: string, imageUri?: string): Promise<void> => {
    try {
      if (!user) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Please log in to use AI features.",
          timestamp: new Date()
        }]);
        return;
      }

      // Note: Image upload not yet supported by Nova Agent in this iteration
      // We'll add that later. For now, rely on text.

      // Filter out internal UI states or temporary messages if needed
      const conversationHistory = messages.filter(m =>
        !m.id.startsWith('temp-') &&
        !m.content.includes("I'm sorry, I encountered an error")
      );

      const now = new Date();
      const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const response = await callNovaAgent({
        query: input,
        user_id: user.id,
        conversation: conversationHistory,
        client_date: clientDate
      });

      // Handle the response based on tool calls
      const lastToolCall = response.tool_calls?.[response.tool_calls.length - 1];

      if (!lastToolCall) {
        // No tool called (chat only)
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date()
        }]);
        return;
      }

      const toolName = lastToolCall.tool;
      const toolResult = lastToolCall.result;

      if (toolName === 'draft_reminder') {
        const draft = toolResult.draft;

        // Prepare draft data for the sheet
        const sheetDraft = {
          title: draft.title,
          date: draft.date,
          time: draft.time,
          repeat: draft.repeat || 'none',
          tag_id: draft.tag_name ? tags.find(t => t.name.toLowerCase() === draft.tag_name.toLowerCase())?.id : undefined,
          priority_id: draft.priority_name ? priorities.find(p => p.name.toLowerCase() === draft.priority_name.toLowerCase())?.id : undefined,
          notes: draft.notes
        };

        // Create an inline draft message instead of opening sheet immediately
        const draftMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || toolResult.message || "Here is a draft for your reminder:",
          timestamp: new Date(),
          panelType: 'draft',
          panelFields: sheetDraft,
        };

        setMessages(prev => [...prev, draftMessage]);
        return;

      } else if (toolName === 'create_reminder') {
        // Reminder was created immediately
        const successMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || toolResult.message || "Reminder created successfully!",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);

      } else if (toolName === 'search_reminders') {
        // Handle search results
        const reminders = toolResult.reminders || [];
        console.log('[AIChat] API Search Results Received:', JSON.stringify(reminders, null, 2));

        if (reminders.length > 0) {
          const panelMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.message || toolResult.message || `I found ${reminders.length} reminders:`,
            timestamp: new Date(),
            panelType: 'search',
            panelSearchResults: reminders,
            panelIsStatic: false
          };
          setMessages(prev => [...prev, panelMessage]);
        } else {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: response.message || toolResult.message || "I couldn't find any reminders matching that.",
            timestamp: new Date()
          }]);
        }

      } else if (toolName === 'update_reminder') {
        // Handle update
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || toolResult.message || "Reminder updated.",
          timestamp: new Date()
        }]);

      } else if (toolName === 'delete_reminder') {
        // Handle delete
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || toolResult.message || "Reminder deleted.",
          timestamp: new Date()
        }]);
      } else {
        // Fallback
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date()
        }]);
      }

    } catch (error: any) {
      console.error('[processMessage] Error:', error);
      let errorContent = "I'm sorry, I encountered an error. Please try again.";
      if (error.code === 'PRO_REQUIRED' || error.message?.includes('Pro membership')) {
        errorContent = "This AI feature requires a Pro membership.";
      } else if (error.message) {
        errorContent = error.message;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [user]);

  // Handle sending messages
  const handleSend = useCallback(async () => {
    if ((!inputText.trim() && !selectedImage) || isThinking) return;

    const userContent = inputText.trim();
    const userImage = selectedImage;

    setInputText('');
    setSelectedImage(null);
    Keyboard.dismiss();

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      imageUri: userImage || undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Show thinking state
    setIsThinking(true);

    // Call Nova Agent
    await processMessage(userContent, userImage || undefined);

  }, [inputText, selectedImage, isThinking, processMessage]);

  // Handle panel field changes
  const handlePanelFieldsChange = useCallback((messageId: string, fields: ModalFieldUpdates) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, panelFields: fields } : msg
    ));
  }, []);

  // Handle panel save
  const handlePanelSave = useCallback(async (messageId: string) => {
    // Find the panel message
    const panelMessage = messages.find(m => m.id === messageId);
    if (!panelMessage || !panelMessage.panelFields?.title?.trim()) return;

    const fields = panelMessage.panelFields;
    const dateStr = fields.date || getTodayDateString();

    const reminderData: any = {
      title: fields.title,
      date: dateStr,
      time: fields.time,
      repeat: fields.repeat || 'none',
      tag_id: fields.tag_id,
      notes: fields.notes,
    };

    let result;
    if (panelMessage.panelReminderId) {
      result = await updateReminder(panelMessage.panelReminderId, reminderData);
    } else {
      result = await addReminder(reminderData);
    }

    const savedReminder = result?.data as Reminder | null | undefined;
    const error = result?.error;

    if (!error && savedReminder) {
      // Schedule notification
      try {
        await scheduleReminderNotification(
          fields.title!,
          dateStr,
          fields.time || undefined,
          fields.repeat || 'none',
          savedReminder.id,
        );
      } catch (err) {
        console.error('[AIChat] Failed to schedule notification:', err);
      }

      // Convert panel to static state
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, panelIsStatic: true } : msg
      ));

      // Add success message
      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Reminder ${panelMessage.panelReminderId ? 'updated' : 'created'} successfully! What else can I help you with?`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);
    }
  }, [messages, addReminder, updateReminder, getTodayDateString]);

  // Handle panel close
  const handlePanelClose = useCallback((messageId: string) => {
    // Convert panel to static or just remove it
    setMessages(prev => prev.filter(m => m.id !== messageId));

    const closeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Okay, let me know if you want to create or find another reminder!",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, closeMessage]);
  }, []);

  // Handle selecting a reminder from search results (convert to edit panel)
  const handleSelectReminder = useCallback((reminder: Reminder) => {
    // Find the search panel message
    const searchPanelIndex = messages.findLastIndex(m => m.panelType === 'search');
    if (searchPanelIndex === -1) return;

    // Replace search panel with edit panel
    setMessages(prev => {
      const updated = [...prev];
      updated[searchPanelIndex] = {
        ...updated[searchPanelIndex],
        panelType: 'edit',
        panelFields: {
          title: reminder.title,
          date: reminder.date,
          time: reminder.time,
          tag_id: reminder.tag_id,
          repeat: reminder.repeat || 'none',
        },
        panelReminderId: reminder.id,
        panelSearchResults: undefined,
      };
      return updated;
    });
  }, [messages]);

  // Clear chat
  const handleClearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hi, I'm Mind. I can help you create, find, or update reminders.",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Track keyboard visibility so we can remove extra bottom padding when it's open
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isThinking]);

  const dynamicStyles = createDynamicStyles(colors, insets);

  const handleUnlock = () => {
    router.push('/subscription');
  };

  const isPro = profile?.pro === true;

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[dynamicStyles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={dynamicStyles.headerContent}>
            <Text style={[dynamicStyles.headerTitle, { color: isPro ? colors.primary : colors.gold }]}>Mind</Text>
            <TouchableOpacity
              onPress={handleClearChat}
              style={[dynamicStyles.clearButton, { backgroundColor: isPro ? colors.primaryLight : colors.goldLight }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              colors={colors}
              tags={tags}
              onPanelFieldsChange={handlePanelFieldsChange}
              onPanelSave={handlePanelSave}
              onPanelClose={handlePanelClose}
              onSelectReminder={handleSelectReminder}
              onDraftConfirm={(msgId, draft) => {
                // Confirming creates the reminder immediately
                handlePanelSave(msgId);
              }}
              onDraftEdit={(msgId, draft) => {
                // Editing opens the sheet
                setDraftReminder(draft);
                setEditingMessageId(msgId);
                setIsSheetOpen(true);
                // We keep the message in history now, and it will be updated to static once saved
              }}
              onDraftDiscard={(msgId) => {
                handlePanelClose(msgId);
              }}
            />
          )}
          contentContainerStyle={dynamicStyles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEnabled={isPro}
        />
      </View>

      {/* Input Area */}
      <View style={dynamicStyles.inputContainer}>
        {/* Image Preview - Shows above input if selected */}
        {selectedImage && (
          <View style={dynamicStyles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={dynamicStyles.imagePreview} />
            <TouchableOpacity
              style={dynamicStyles.removeImageButton}
              onPress={() => setSelectedImage(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}

        <View style={dynamicStyles.inputRow}>
          {/* Add Button (Left) */}
          <TouchableOpacity
            style={[dynamicStyles.addButton, { backgroundColor: isPro ? colors.primary : colors.gold }]}
            onPress={handlePickImage}
            disabled={isThinking || !isPro}
          >
            <Ionicons name="add" size={24} color={colors.background} />
          </TouchableOpacity>

          {/* Text Input Pill (Center) */}
          <View style={dynamicStyles.inputPill}>
            <TextInput
              ref={inputRef}
              style={dynamicStyles.input}
              placeholder={isPro ? "What's on your mind?" : "Upgrade to unlock Mind"}
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!isThinking && isPro}
            />

            {/* Action Icon (Right side of pill) */}
            {inputText.trim() || selectedImage ? (
              <TouchableOpacity
                onPress={handleSend}
                disabled={isThinking || !isPro}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-up-circle" size={32} color={isPro ? colors.primary : colors.gold} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => Alert.alert("Coming Soon", "Voice dictation is under development!")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={!isPro}
              >
                <Ionicons name="mic" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>


          {/* Voice Mode Button */}
          <VoiceModeButton
            colors={colors}
            userId={user?.id}
            onSessionUpdate={setIsVoiceActive}
          />
        </View>
      </View>

      {!isPro && <PremiumLockOverlay onUnlock={handleUnlock} />}

      {/* Add Reminder Sheet for AI Drafts */}
      <AddReminderSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleSheetSave}
        editReminder={draftReminder ? {
          id: 'draft', // Temporary ID
          ...draftReminder,
          user_id: user?.id || '',
          completed: false,
          created_at: new Date().toISOString()
        } as unknown as Reminder : undefined}
      />
    </KeyboardAvoidingView>
  );
}

// Remove the now unused component
// function PulsatingBrainButton ...

// Separate component to handle its own animation cycle
function PulsatingBrainButton({ colors, isTyping, onPress }: { colors: any, isTyping: boolean, onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTyping) {
      // Stop pulsating and reset to normal
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Start pulsating loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [isTyping]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={{
        width: 35,
        height: 35,
        borderRadius: 21,
        backgroundColor: colors.foreground,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale }]
      }}>
        <MaterialIcons name="record-voice-over" size={24} color={colors.card} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  panelMessageContainer: {
    paddingHorizontal: spacing.lg,
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

const createDynamicStyles = (colors: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.title,
    fontSize: typography.fontSize['2xl'],
    color: colors.gold,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clearButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.goldLight,
  },
  messagesList: {
    paddingTop: spacing.lg,
    paddingBottom: 48 + insets.bottom + spacing.xl,
  },

  // New Input Bar Styles
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 25 + insets.bottom,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  addButton: {
    width: 35,
    height: 35,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border, // Add a subtle border since it's white on background
  },
  inputPill: {
    flex: 1,
    maxHeight: 45,
    minHeight: 45,
    backgroundColor: colors.card,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs, // Allow multiline to expand
    borderWidth: 1,
    borderColor: colors.border,

  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: Platform.OS === 'ios' ? 11 : 8,
    marginRight: spacing.sm,
  },
  voiceModeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.foreground, // Dark/Light contrast
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Image Preview
  imagePreviewContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    left: 70, // Offset from image edge
    backgroundColor: colors.destructive,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
