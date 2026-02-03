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
import { ChatMessage, ModalFieldUpdates, MockAIResponse } from '../../types/ai-chat';
import { Reminder } from '../../types/reminder';
import { scheduleReminderNotification } from '../../lib/notifications';
import { extractReminderFields, searchReminders } from '../../lib/ai-extract';
import { VoiceModeButton } from '../../components/voice/VoiceModeButton';

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
}: {
  message: ChatMessage;
  colors: any;
  tags: any[];
  onPanelFieldsChange?: (messageId: string, fields: ModalFieldUpdates) => void;
  onPanelSave?: (messageId: string) => void;
  onPanelClose?: (messageId: string) => void;
  onSelectReminder?: (reminder: Reminder) => void;
}) {
  const isUser = message.role === 'user';

  // If message has panel data, render inline panel
  if (message.panelType) {
    return (
      <View style={[styles.messageContainer, styles.panelMessageContainer]}>
        <InlineReminderPanel
          type={message.panelType}
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
            <Text style={[styles.messageText, { color: colors.foreground }]}>
              {message.content.split(/(\b\w+\b)/g).map((part, i) => {
                const tag = tags.find(t => t.name.toLowerCase() === part.toLowerCase());
                if (tag) {
                  return (
                    <Text key={i} style={{ color: tag.color, fontWeight: 'bold' }}>
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tags, priorities } = useSettings();
  const { user } = useAuth();
  const { addReminder, updateReminder } = useReminders();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I can help you create, find, or update reminders.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
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

  // Process message with LLM extraction
  const processMessage = useCallback(async (input: string, imageUri?: string): Promise<MockAIResponse> => {
    try {
      if (!user) return { type: 'chat', message: "Please log in to use AI features." };

      let base64Image = undefined;
      if (imageUri) {
        try {
          // Read image as base64 using the new File API in expo-file-system v19+
          const file = new FileSystem.File(imageUri);
          base64Image = await file.base64();
          console.log('[processMessage] Image converted to base64, length:', base64Image?.length);
        } catch (imageError) {
          console.error('[processMessage] Error reading image:', imageError);
        }
      }

      const response = await extractReminderFields({
        query: input,
        user_id: user.id,
        image: base64Image,
        conversation: messages.filter(m =>
          !m.content.includes('Reminder created successfully!') &&
          !m.content.includes('Okay, let me know if you want to create another reminder!')
        ),
        modalContext: {
          isOpen: false,
          currentFields: {},
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
  }, [messages, tags, user]);

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

    try {
      // Process with LLM extraction
      const response = await processMessage(userContent || (userImage ? "I uploaded an image." : ""), userImage || undefined);

      // Handle search specially - we want to show the actual search answer, not the extraction message
      if (response.type === 'search') {
        console.log('[handleSend] 🔍 SEARCH MODE TRIGGERED');
        console.log('[handleSend] Search query:', userContent);
        try {
          // DEBUG: Log the handoff
          const targetDate = response.fieldUpdates?.date;
          console.log('[handleSend] Extracted date for search:', targetDate);

          // User Feedback: Explicitly mention the date we are checking
          const searchMessageContent = targetDate
            ? `Checking your schedule for ${targetDate}...`
            : "Searching for reminders...";

          // Add a temporary "Searching..." message
          const searchingMessageId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, {
            id: searchingMessageId,
            role: 'assistant',
            content: searchMessageContent,
            timestamp: new Date(),
          }]);

          const searchData = await searchReminders({
            query: userContent,
            user_id: user!.id,
            targetDate: targetDate || undefined,
          });

          // Remove the temporary searching message
          setMessages(prev => prev.filter(m => m.id !== searchingMessageId));

          console.log('[handleSend] Search response:', JSON.stringify(searchData, null, 2));
          console.log('[handleSend] Evidence count:', searchData.evidence?.length || 0);

          if (searchData.evidence && searchData.evidence.length > 0) {
            // Map reminder_id to id for the Reminder interface compatibility
            const mappedResults = searchData.evidence.map((item: any) => ({
              ...item,
              id: item.reminder_id || item.id,
            }));

            // Create inline panel message with search results
            const panelMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: searchData.answer || "I found these reminders:",
              timestamp: new Date(),
              panelType: 'search',
              panelSearchResults: mappedResults,
              panelIsStatic: false,
            };
            setMessages(prev => [...prev, panelMessage]);
          } else {
            // No results found
            const noResultsMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: searchData.answer || "I couldn't find any matching reminders.",
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, noResultsMessage]);
          }
        } catch (searchError) {
          console.error('[handleSend] ❌ Search Error:', searchError);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "I had trouble searching your reminders. Please try again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else if (response.type === 'create') {
        // Create inline panel message for creating a reminder
        const panelMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          panelType: 'create',
          panelFields: {
            repeat: 'none',
            ...(response.fieldUpdates || {}),
          },
          panelIsStatic: false,
        };
        setMessages(prev => [...prev, panelMessage]);
      } else if (response.type === 'update') {
        // Find the most recent panel message and update its fields
        setMessages(prev => {
          const lastPanelIndex = prev.findLastIndex(m => m.panelType && !m.panelIsStatic);
          if (lastPanelIndex !== -1 && response.fieldUpdates) {
            const updated = [...prev];
            updated[lastPanelIndex] = {
              ...updated[lastPanelIndex],
              panelFields: {
                ...updated[lastPanelIndex].panelFields,
                ...response.fieldUpdates,
              },
            };
            return updated;
          }
          return prev;
        });

        // Also add an AI message acknowledging the update
        const updateMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, updateMessage]);
      } else {
        // Regular chat message
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error: any) {
      console.error('[handleSend] Error:', error);
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
  }, [inputText, selectedImage, isThinking, processMessage, user]);

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
        content: "Hi! I can help you create, find, or update reminders. Try saying 'What do I have tomorrow?' or 'Remind me to call mom at 5pm'",
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
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              colors={colors}
              tags={tags}
              onPanelFieldsChange={handlePanelFieldsChange}
              onPanelSave={handlePanelSave}
              onPanelClose={handlePanelClose}
              onSelectReminder={handleSelectReminder}
            />
          )}
          contentContainerStyle={dynamicStyles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isThinking ? <TypingIndicator colors={colors} /> : null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />
      </View>

      {/* Input Area */}
      <View
        style={[
          dynamicStyles.inputContainer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
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
            style={dynamicStyles.addButton}
            onPress={handlePickImage}
            disabled={isThinking}
          >
            <Ionicons name="add" size={24} color={colors.background} />
          </TouchableOpacity>

          {/* Text Input Pill (Center) */}
          <View style={dynamicStyles.inputPill}>
            <TextInput
              ref={inputRef}
              style={dynamicStyles.input}
              placeholder="Ask anything..."
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!isThinking}
            />

            {/* Action Icon (Right side of pill) */}
            {inputText.trim() || selectedImage ? (
              <TouchableOpacity
                onPress={handleSend}
                disabled={isThinking}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-up-circle" size={32} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => Alert.alert("Coming Soon", "Voice dictation is under development!")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // New Input Bar Styles
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
    backgroundColor: '#FFFFFF', // Specifically white as requested
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
