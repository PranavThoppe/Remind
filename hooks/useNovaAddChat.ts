import { useState, useCallback, useRef } from 'react';
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';
import { callNovaAgent } from '../lib/nova-client';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useReminders } from './useReminders';
import { scheduleReminderNotification } from '../lib/notifications';

export function useNovaAddChat(options?: { onNetworkError?: (failedText: string) => void }) {
    const { user } = useAuth();
    const { tags, priorities } = useSettings();
    const { addReminder, updateSubtasks } = useReminders();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesRef = useRef<ChatMessage[]>([]); // mirror for sync reads
    const [hiddenMessages, setHiddenMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [dayOverviewDate, setDayOverviewDate] = useState<string | null>(null);

    const flatListRef = useRef<any>(null);

    // Keep messagesRef in sync so handleDraftConfirm can read current messages synchronously
    const syncedSetMessages: typeof setMessages = useCallback((updater) => {
        setMessages(prev => {
            const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
            messagesRef.current = next;
            return next;
        });
    }, []);

    const processMessage = useCallback(async (
        input: string,
        currentMessages: ChatMessage[],
        _imageUri?: string,
    ) => {
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

            // Add flow only uses the base nova-agent
            const response = await callNovaAgent({
                query: input,
                user_id: user.id,
                conversation: conversationHistory,
                client_date: clientDate,
            });

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
                    subtasks: draft.subtasks,
                };

                const newMessage = {
                    id: Date.now().toString(), role: 'assistant' as const,
                    content: response.message || toolResult.message || "Here's a draft for your reminder:",
                    timestamp: new Date(), panelType: 'draft' as const, panelFields: sheetDraft,
                };
                if (draft.subtasks && draft.subtasks.length > 0) {
                    setHiddenMessages(currentMessages);
                    syncedSetMessages([newMessage]);
                } else {
                    syncedSetMessages(prev => [...prev, newMessage]);
                }
            } else if (toolName === 'comment_on_day') {
                // Agent responded with a day comment after confirmation — just show the text
                syncedSetMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message, timestamp: new Date(),
                }]);
            } else {
                syncedSetMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message, timestamp: new Date(),
                }]);
            }
        } catch (error: any) {
            const isNetworkError = error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch') || error.name === 'TypeError';
            if (isNetworkError && options?.onNetworkError) {
                options.onNetworkError(input);
            } else {
                syncedSetMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(), role: 'assistant',
                    content: error.message || "An error occurred.", timestamp: new Date(),
                }]);
            }
        } finally {
            setIsThinking(false);
        }
    }, [user, tags, priorities, options?.onNetworkError]);

    const handleSend = useCallback(async (overrideText?: string) => {
        const trimmed = overrideText ? overrideText.trim() : inputText.trim();
        if ((!trimmed && !selectedImage) || isThinking) return;

        if (!overrideText) setInputText('');
        const userImage = selectedImage;
        setSelectedImage(null);

        const userMessage: ChatMessage = {
            id: Date.now().toString(), role: 'user',
            content: trimmed, imageUri: userImage || undefined, timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMessage];
        syncedSetMessages(updatedMessages);
        setIsThinking(true);
        await processMessage(trimmed, updatedMessages, userImage || undefined);
    }, [inputText, selectedImage, isThinking, messages, processMessage, syncedSetMessages]);

    const handleDraftConfirm = useCallback(async (messageId: string, fields: ModalFieldUpdates) => {
        if (!fields.title?.trim()) return;
        const now = new Date();
        const dateStr = fields.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const result = await addReminder({
            title: fields.title, date: dateStr, time: fields.time, repeat: fields.repeat || 'none',
            tag_id: fields.tag_id, priority_id: fields.priority_id, notes: fields.notes,
        });

        if (!result.error && result.data) {
            if (fields.subtasks && fields.subtasks.length > 0) {
                await updateSubtasks((result.data as Reminder).id, fields.subtasks);
            }
            try {
                await scheduleReminderNotification(fields.title, dateStr, fields.time || undefined, fields.repeat || 'none', (result.data as Reminder).id);
            } catch (_err) { }

            // Mark draft as static
            syncedSetMessages(prev => prev.map(m => m.id === messageId ? { ...m, panelIsStatic: true } : m));

            // Inject the day overview panel inline in the chat
            setDayOverviewDate(dateStr);
            syncedSetMessages(prev => [...prev, {
                id: `day-overview-${Date.now()}`,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                panelType: 'day_overview',
                panelFields: { date: dateStr },
            }]);

            // Agent no longer needs to comment on the day, so we stop here.
        }
    }, [addReminder, updateSubtasks, processMessage, syncedSetMessages]);

    const handleDraftDiscard = useCallback((messageId: string) => {
        setMessages(prev => {
            const isDiscardingSubtaskDraft = prev.find(m => m.id === messageId && m.panelFields?.subtasks && m.panelFields.subtasks.length > 0);
            if (isDiscardingSubtaskDraft && hiddenMessages.length > 0) {
                return hiddenMessages;
            }
            return prev.filter(m => m.id !== messageId);
        });
        setHiddenMessages([]);
    }, [hiddenMessages]);

    const pushRepeatSettings = useCallback((initialFields?: { repeat?: string; date?: string | null }) => {
        setMessages(prev => [...prev, {
            id: `temp-repeat-${Date.now()}`, role: 'assistant' as const,
            content: '', timestamp: new Date(), panelType: 'repeat_settings' as const,
            panelFields: { repeat: initialFields?.repeat, date: initialFields?.date },
            panelIsStatic: false,
        }]);
    }, []);

    const pushSubtasksSettings = useCallback((initialFields?: { subtasks?: any[] }) => {
        setMessages(prev => [...prev, {
            id: `temp-subtasks-${Date.now()}`, role: 'assistant' as const,
            content: '', timestamp: new Date(), panelType: 'subtasks_settings' as const,
            panelFields: { subtasks: initialFields?.subtasks || [] },
            panelIsStatic: false,
        }]);
    }, []);

    const pushNotificationSettings = useCallback(() => {
        setMessages(prev => [...prev, {
            id: `temp-notification-${Date.now()}`, role: 'assistant' as const,
            content: '', timestamp: new Date(), panelType: 'notification_settings' as const, panelFields: {},
            panelIsStatic: false,
        }]);
    }, []);

    const reset = useCallback(() => {
        setInputText('');
        setSelectedImage(null);
        setMessages([]);
        setHiddenMessages([]);
        setDayOverviewDate(null);
    }, []);

    return {
        messages, setMessages,
        isThinking,
        inputText, setInputText,
        selectedImage, setSelectedImage,
        dayOverviewDate, setDayOverviewDate,
        flatListRef,
        handleSend,
        handleDraftConfirm,
        handleDraftDiscard,
        processMessage,
        pushRepeatSettings,
        pushSubtasksSettings,
        pushNotificationSettings,
        reset,
    };
}
