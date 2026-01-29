import { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useReminders } from '../../hooks/useReminders';
import { AiLiveReminderPanel } from '../../components/AiLiveReminderPanel';
import { ChatMessage, ModalFieldUpdates, MockAIResponse } from '../../types/ai-chat';
import { Reminder } from '../../types/reminder';
import { scheduleReminderNotification } from '../../lib/notifications';
import { extractReminderFields } from '../../lib/ai-extract';

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
function MessageBubble({ message, colors }: { message: ChatMessage; colors: any }) {
  const isUser = message.role === 'user';
  
  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      <View
        style={[
          styles.messageBubble,
          isUser ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: colors.card }],
        ]}
      >
        <Text
          style={[
            styles.messageText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tags, priorities } = useSettings();
  const { user } = useAuth();
  const { addReminder } = useReminders();
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I can help you create reminders. Try saying something like 'Create a reminder to buy milk tomorrow at 3pm'",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFields, setModalFields] = useState<ModalFieldUpdates>({
    repeat: 'none',
  });
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
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

  const extractTitle = useCallback((input: string): string => {
    const cleaned = input
      .replace(/(create|add|remind me to|set a reminder to|set a reminder|new reminder|reminder to|reminder)/gi, '')
      .replace(/\b(tomorrow|today|at \d{1,2}(:\d{2})?\s*(am|pm)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'New reminder';
  }, []);

  const parseTimeFromText = useCallback((input: string): string | undefined => {
    // Match patterns like "3pm", "3:30pm", "15:00", "at 3pm"
    const match = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] || '00';
      const period = match[3].toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return undefined;
  }, []);

  const parseDateFromText = useCallback((input: string): string | undefined => {
    const today = new Date();
    const lower = input.toLowerCase();
    
    if (lower.includes('today')) {
      return formatDateString(today);
    }
    
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return formatDateString(tomorrow);
    }

    // Parse weekdays
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekdays.length; i++) {
      if (lower.includes(weekdays[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next occurrence
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        return formatDateString(targetDate);
      }
    }
    
    return undefined;
  }, [formatDateString]);

  const findTagByName = useCallback((input: string): string | undefined => {
    const lower = input.toLowerCase();
    for (const tag of tags) {
      if (lower.includes(tag.name.toLowerCase())) {
        return tag.id;
      }
    }
    return undefined;
  }, [tags]);

  // Process message with LLM extraction
  const processMessage = useCallback(async (input: string): Promise<MockAIResponse> => {
    try {
      if (!user) return { type: 'chat', message: "Please log in to use AI features." };

      const response = await extractReminderFields({
        query: input,
        user_id: user.id,
        conversation: messages,
        modalContext: {
          isOpen: isModalOpen,
          currentFields: modalFields,
        },
        tags: tags,
        priorities: priorities,
      });

      return {
        type: response.type,
        message: response.message,
        fieldUpdates: response.fieldUpdates,
      };
    } catch (error: any) {
      console.error('[processMessage] Error:', error);
      
      // Fallback response on error
      const lower = input.toLowerCase();
      
      // Check for cancel/nevermind
      if (/(cancel|nevermind|never mind|close|stop)/i.test(lower)) {
        return {
          type: 'chat',
          message: "Okay, I've closed the form. Let me know if you want to create another reminder!",
        };
      }
      
      return {
        type: 'chat',
        message: "I'm having trouble processing that right now. Please try again or rephrase your request.",
      };
    }
  }, [messages, isModalOpen, modalFields, tags, user]);

  // Handle sending messages
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    
    const userContent = inputText.trim();
    setInputText('');
    Keyboard.dismiss();
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Show thinking state
    setIsThinking(true);
    
    try {
      // Process with LLM extraction
      const response = await processMessage(userContent);
      
      // Add AI response
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Handle actions
      if (response.type === 'create') {
        setModalFields({
          repeat: 'none',
          ...(response.fieldUpdates || {}),
        });
        setIsModalOpen(true);
      } else if (response.type === 'update' && response.fieldUpdates) {
        setModalFields(prev => ({ ...prev, ...response.fieldUpdates }));
      } else if (response.type === 'chat' && isModalOpen && /(cancel|nevermind|never mind|close|stop)/i.test(userContent.toLowerCase())) {
        setIsModalOpen(false);
        setModalFields({});
      }
    } catch (error: any) {
      console.error('[handleSend] Error:', error);
      // Add error message
      let errorContent = "I'm sorry, I encountered an error. Please try again.";
      
      if (error.code === 'PRO_REQUIRED' || error.message?.includes('Pro membership')) {
        errorContent = "This AI feature requires a Pro membership. Please upgrade to access AI-powered reminder extraction!";
      } else if (error.message) {
        errorContent = error.message;
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  }, [inputText, isThinking, processMessage, isModalOpen]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setModalFields({});
    
    const closeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Okay, let me know if you want to create another reminder!",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, closeMessage]);
  }, []);

  // Handle save from the inline AI panel
  const handleSaveFromPanel = useCallback(async () => {
    const title = modalFields.title?.trim();
    if (!title) return;

    const dateStr = modalFields.date || getTodayDateString();

    const reminderData: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'> = {
      title,
      date: dateStr,
      time: modalFields.time,
      repeat: modalFields.repeat || 'none',
      tag_id: modalFields.tag_id,
      // priority_id is not set by AI - users set it manually
    };

    const result = await addReminder(reminderData);

    const savedReminder = result?.data as Reminder | null | undefined;
    const error = result?.error;

    if (!error && savedReminder) {
      // Schedule notification, mirroring AddReminderSheet behavior
      try {
        await scheduleReminderNotification(
          title,
          dateStr,
          modalFields.time,
          modalFields.repeat || 'none',
          savedReminder.id,
        );
      } catch (err) {
        console.error('[AIChat] Failed to schedule notification:', err);
      }

      setIsModalOpen(false);
      setModalFields({ repeat: 'none' });

      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Reminder created successfully! What else can I help you with?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);
    }
  }, [addReminder, modalFields, getTodayDateString]);

  // Clear chat
  const handleClearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I can help you create reminders. Try saying something like 'Create a reminder to buy milk tomorrow at 3pm'",
        timestamp: new Date(),
      },
    ]);
    setIsModalOpen(false);
    setModalFields({});
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

  const dynamicStyles = createDynamicStyles(colors);

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
            <View>
              <Text style={dynamicStyles.headerTitle}>AI Assistant</Text>
              <Text style={dynamicStyles.headerSubtitle}>Create reminders with natural language</Text>
            </View>
            <TouchableOpacity
              onPress={handleClearChat}
              style={dynamicStyles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
          contentContainerStyle={dynamicStyles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />
      </View>

      {/* Inline AI live reminder panel between messages and input */}
      <AiLiveReminderPanel
        isOpen={isModalOpen}
        fields={modalFields}
        onChangeFields={(updates) => setModalFields(prev => ({ ...prev, ...updates }))}
        onClose={handleModalClose}
        onSave={handleSaveFromPanel}
      />

      {/* Input Bar */}
      <View
        style={[
          dynamicStyles.inputContainer,
          {
            // Extra offset only when keyboard is hidden, so the bar sits above the tab bar
            paddingBottom:
              Math.max(insets.bottom, spacing.md) +
              (Platform.OS === 'ios' && !keyboardVisible ? 56 : 0),
          },
        ]}
      >
        <View style={dynamicStyles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={dynamicStyles.input}
            placeholder={isModalOpen ? "Update the reminder..." : "Create a reminder..."}
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isThinking}
          />
          <TouchableOpacity
            style={[
              dynamicStyles.sendButton,
              (!inputText.trim() || isThinking) && dynamicStyles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isThinking}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && !isThinking ? colors.primaryForeground : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  messageText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
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

const createDynamicStyles = (colors: any) => StyleSheet.create({
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
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
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
    backgroundColor: colors.muted,
  },
  messagesList: {
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  inputContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
});
