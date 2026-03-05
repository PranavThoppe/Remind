import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';
import { callNovaUpdateAgent, callNovaSuggest } from '../lib/nova-client';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useReminders } from './useReminders';

export interface UseNovaUpdateChatOptions {
    initialPinnedReminder?: Reminder | null;
}

export function useNovaUpdateChat(options: UseNovaUpdateChatOptions = {}) {
    const { initialPinnedReminder } = options;
    const { user } = useAuth();
    const { tags, priorities } = useSettings();
    const { updateReminder, deleteReminder } = useReminders();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [inputText, setInputText] = useState('');
    const [pinnedReminder, setPinnedReminder] = useState<Reminder | null>(initialPinnedReminder || null);

    // Explicit suggestion states
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

    const flatListRef = useRef<any>(null);

    // Sync from props if it changes
    useEffect(() => {
        if (initialPinnedReminder) {
            setPinnedReminder(initialPinnedReminder);
        }
    }, [initialPinnedReminder]);

    // Generate suggestions based on the pinned reminder
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!pinnedReminder) {
                setSuggestions([]);
                setIsGeneratingSuggestions(false);
                return;
            }
            setSuggestions([]);
            setIsGeneratingSuggestions(true);

            const now = new Date();
            const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const aiSuggestions = await callNovaSuggest({ ...pinnedReminder, date: pinnedReminder.date || undefined }, clientDate);

            if (aiSuggestions && aiSuggestions.length > 0) {
                setSuggestions(aiSuggestions);
            }
            setIsGeneratingSuggestions(false);
        };

        fetchSuggestions();
    }, [pinnedReminder]);

    const processMessage = useCallback(async (
        input: string,
        currentMessages: ChatMessage[],
    ) => {
        if (!pinnedReminder) return;
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

            // Exclusively call the Update Agent
            const response = await callNovaUpdateAgent({
                query: input,
                user_id: user.id,
                reminder: { ...pinnedReminder, date: pinnedReminder.date || undefined },
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

            if (toolName === 'draft_update_reminder') {
                const draft = toolResult.draft;

                const sheetDraft = {
                    title: draft.title !== undefined ? draft.title : pinnedReminder.title,
                    date: draft.date !== undefined ? draft.date : pinnedReminder.date,
                    time: draft.time !== undefined ? draft.time : (pinnedReminder.time || null),
                    repeat: draft.repeat !== undefined ? draft.repeat : (pinnedReminder.repeat || 'none'),
                    tag_id: draft.tag_name !== undefined ? (draft.tag_name === "" ? null : tags.find(t => t.name.toLowerCase() === draft.tag_name.toLowerCase())?.id || pinnedReminder.tag_id) : pinnedReminder.tag_id,
                    priority_id: draft.priority_name !== undefined ? (draft.priority_name === "" ? null : priorities.find(p => p.name.toLowerCase() === draft.priority_name.toLowerCase())?.id || pinnedReminder.priority_id) : pinnedReminder.priority_id,
                    notes: draft.notes !== undefined ? draft.notes : (pinnedReminder.notes || null),
                };

                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || toolResult.message || "Here's the proposed update:",
                    timestamp: new Date(), panelType: 'draft_update' as any, panelFields: sheetDraft,
                }]);
            } else if (toolName === 'delete_reminder') {
                const idToDelete = toolResult.reminder_id || toolResult.id;
                if (idToDelete) {
                    await deleteReminder(idToDelete);
                }
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: response.message || toolResult.message || "Reminder deleted successfully!",
                    timestamp: new Date(),
                }]);
            } else if (toolName === 'update_notification_offsets') {
                const offsets = toolResult.offsets || [];
                const sheetDraft = {
                    notification_offsets: offsets,
                    title: pinnedReminder.title,
                    date: pinnedReminder.date,
                    time: pinnedReminder.time,
                    repeat: pinnedReminder.repeat,
                    repeat_until: pinnedReminder.repeat_until,
                    tag_id: pinnedReminder.tag_id,
                    priority_id: pinnedReminder.priority_id,
                    notes: pinnedReminder.notes,
                };

                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || toolResult.message || "I've drafted the notification update.",
                    timestamp: new Date(), panelType: 'notification_settings', panelFields: sheetDraft,
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
        }
    }, [user, tags, priorities, pinnedReminder]);

    const handleSend = useCallback(async (overrideText?: string) => {
        const trimmed = overrideText ? overrideText.trim() : inputText.trim();
        if (!trimmed || isThinking) return;

        if (!overrideText) setInputText('');

        const userMessage: ChatMessage = {
            id: Date.now().toString(), role: 'user',
            content: trimmed, timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsThinking(true);
        await processMessage(trimmed, updatedMessages);
    }, [inputText, isThinking, messages, processMessage]);

    const handleDraftUpdateConfirm = useCallback(async (messageId: string, fields: ModalFieldUpdates) => {
        if (!pinnedReminder) return;
        const updates: any = {};
        if (fields.title) updates.title = fields.title;
        if (fields.date) updates.date = fields.date;
        if (fields.time) updates.time = fields.time;
        if (fields.repeat) updates.repeat = fields.repeat;
        if (fields.repeat_until) updates.repeat_until = fields.repeat_until;
        if (undefined !== fields.tag_id) updates.tag_id = fields.tag_id;
        if (undefined !== fields.priority_id) updates.priority_id = fields.priority_id;
        if (fields.notes !== undefined) updates.notes = fields.notes;
        if (fields.notification_offsets !== undefined) updates.notification_offsets = fields.notification_offsets;

        const result = await updateReminder(pinnedReminder.id, updates);

        if (!result.error) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, panelIsStatic: true } : m));
            setPinnedReminder({ ...pinnedReminder, ...updates });
        }
    }, [pinnedReminder, updateReminder]);

    const handleDraftDiscard = useCallback((messageId: string) => {
        // Find the message being discarded
        const discardedMsg = messages.find(m => m.id === messageId);
        const isSettingsPanel = discardedMsg?.panelType === 'notification_settings' || (discardedMsg?.panelType as any) === 'repeat_settings';

        setMessages(prev => prev.filter(m => m.id !== messageId));

        // If it was a notification/repeat setting that got discarded, push fallback response with delay
        if (isSettingsPanel) {
            setIsThinking(true);
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "Anything else?",
                    timestamp: new Date(),
                }]);
                setSuggestions(["Update title", "Change time", "Done"]);
                setIsThinking(false);
            }, 1000);
        }
    }, [messages]);

    const reset = useCallback(() => {
        setInputText('');
        setMessages([]);
        setSuggestions([]);
        setIsGeneratingSuggestions(false);
    }, []);

    const pushNotificationSettings = useCallback(() => {
        if (!pinnedReminder) return;
        // Overwrite standard chat so the modal appears directly at the top under the card
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: "Please select a time:",
            timestamp: new Date(),
            panelType: 'notification_settings',
            panelFields: { notification_offsets: pinnedReminder.notification_offsets || [] }
        }]);
    }, [pinnedReminder]);

    const pushRepeatSettings = useCallback(() => {
        if (!pinnedReminder) return;
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: "Please select a repeating schedule:",
            timestamp: new Date(),
            panelType: 'repeat_settings' as any,
            panelFields: { repeat: pinnedReminder.repeat || 'none' }
        }]);
    }, [pinnedReminder]);

    return {
        messages, setMessages,
        isThinking,
        inputText, setInputText,
        pinnedReminder, setPinnedReminder,
        suggestions, isGeneratingSuggestions,
        flatListRef,
        handleSend,
        handleDraftUpdateConfirm,
        handleDraftDiscard,
        pushNotificationSettings,
        pushRepeatSettings,
        reset,
    };
}
