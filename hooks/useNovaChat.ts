import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';
import { callNovaAgent } from '../lib/nova-client';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useReminders } from './useReminders';
import { scheduleReminderNotification } from '../lib/notifications';

export interface UseNovaChatOptions {
    /** Pre-pin a reminder as context on mount (used by EditReminderSheet) */
    initialPinnedReminder?: { id: string; title: string; tag_id?: string | null } | null;
}

export function useNovaChat(options?: UseNovaChatOptions) {
    const { user } = useAuth();
    const { tags, priorities } = useSettings();
    const { addReminder, reminders, deleteReminder, updateReminder } = useReminders();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [pinnedReminder, setPinnedReminder] = useState<any>(
        options?.initialPinnedReminder || null
    );

    const flatListRef = useRef<any>(null);

    // ───────────────────────── processMessage ─────────────────────────

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

            let queryWithContext = input;
            if (pinnedReminder) {
                queryWithContext = `${input}\n\n[Active Context: Reminder ID ${pinnedReminder.id} - ${pinnedReminder.title}]`;
            }

            const response = await callNovaAgent({
                query: queryWithContext,
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
                };
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || toolResult.message || "Here's a draft for your reminder:",
                    timestamp: new Date(), panelType: 'draft', panelFields: sheetDraft,
                }]);
            } else if (toolName === 'draft_update_reminder') {
                const draft = toolResult.draft;
                const existingReminder = reminders.find(r => r.id === draft.reminder_id);

                const sheetDraft = {
                    title: draft.title !== undefined ? draft.title : (existingReminder?.title || ''),
                    date: draft.date !== undefined ? draft.date : (existingReminder?.date || ''),
                    time: draft.time !== undefined ? draft.time : (existingReminder?.time || null),
                    repeat: draft.repeat !== undefined ? draft.repeat : (existingReminder?.repeat || 'none'),
                    tag_id: draft.tag_name ? tags.find(t => t.name.toLowerCase() === draft.tag_name.toLowerCase())?.id : existingReminder?.tag_id,
                    priority_id: draft.priority_name ? priorities.find(p => p.name.toLowerCase() === draft.priority_name.toLowerCase())?.id : existingReminder?.priority_id,
                    notes: draft.notes !== undefined ? draft.notes : (existingReminder?.notes || null),
                };

                if (draft.reminder_id && !pinnedReminder) {
                    setPinnedReminder({ id: draft.reminder_id, title: sheetDraft.title, tag_id: sheetDraft.tag_id });
                }

                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || toolResult.message || "Here's the proposed update:",
                    timestamp: new Date(), panelType: 'draft_update' as any, panelFields: sheetDraft,
                }]);
            } else if (toolName === 'create_reminder') {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || toolResult.message || "Reminder created!", timestamp: new Date(),
                }]);
            } else if (toolName === 'search_reminders') {
                const parsedResults = Array.isArray(toolResult.reminders) ? toolResult.reminders : [];
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: response.message || "Here's what I found:", timestamp: new Date(),
                    panelType: 'search', panelSearchResults: parsedResults,
                }]);
            } else if (toolName === 'delete_reminder') {
                const idToDelete = toolResult.reminder_id || toolResult.id;
                if (idToDelete) {
                    await deleteReminder(idToDelete);
                    if (pinnedReminder?.id === idToDelete) {
                        setPinnedReminder(null);
                    }
                }
                const remainingToday = reminders.filter(
                    r => r.date === clientDate && !r.completed && r.id !== idToDelete
                );
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: response.message || toolResult.message || "Reminder deleted successfully!",
                    timestamp: new Date(),
                    panelType: 'reminder_list',
                    panelSearchResults: remainingToday,
                }]);
            } else if (toolName === 'update_reminder') {
                const updatedId = toolResult.reminder_id || toolResult.id;
                const updatedReminder = updatedId ? reminders.find(r => r.id === updatedId) : undefined;
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: response.message || toolResult.message || "Reminder updated.",
                    timestamp: new Date(),
                    ...(updatedReminder ? { panelType: 'reminder_list', panelSearchResults: [updatedReminder] } : {}),
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
    }, [user, tags, priorities, reminders, pinnedReminder]);

    // ───────────────────────── handleSend ─────────────────────────

    const handleSend = useCallback(async () => {
        const trimmed = inputText.trim();
        if ((!trimmed && !selectedImage) || isThinking) return;

        setInputText('');
        const userImage = selectedImage;
        setSelectedImage(null);

        const userMessage: ChatMessage = {
            id: Date.now().toString(), role: 'user',
            content: trimmed, imageUri: userImage || undefined, timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsThinking(true);
        await processMessage(trimmed, updatedMessages, userImage || undefined);
    }, [inputText, selectedImage, isThinking, messages, processMessage]);

    // ───────────────────────── Draft handlers ─────────────────────────

    const handleDraftConfirm = useCallback(async (messageId: string, fields: ModalFieldUpdates) => {
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
            } catch (_err) { }
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, panelIsStatic: true } : m));
        }
    }, [addReminder]);

    const handleDraftUpdateConfirm = useCallback(async (messageId: string, fields: ModalFieldUpdates) => {
        if (!pinnedReminder?.id) {
            Alert.alert("Error", "No reminder selected to update.");
            return;
        }

        const updates: any = {};
        if (fields.title) updates.title = fields.title;
        if (fields.date) updates.date = fields.date;
        if (fields.time) updates.time = fields.time;
        if (fields.repeat) updates.repeat = fields.repeat;
        if (fields.repeat_until) updates.repeat_until = fields.repeat_until;
        if (undefined !== fields.tag_id) updates.tag_id = fields.tag_id;
        if (undefined !== fields.priority_id) updates.priority_id = fields.priority_id;
        if (undefined !== fields.notes) updates.notes = fields.notes;

        const result = await updateReminder(pinnedReminder.id, updates);

        if (!result.error) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, panelIsStatic: true } : m));
            setPinnedReminder(null);
        }
    }, [pinnedReminder, updateReminder]);

    // ───────────────────────── Reset ─────────────────────────

    const reset = useCallback(() => {
        setInputText('');
        setSelectedImage(null);
        setMessages([]);
        setPinnedReminder(null);
    }, []);

    return {
        // State
        messages,
        setMessages,
        isThinking,
        inputText,
        setInputText,
        selectedImage,
        setSelectedImage,
        pinnedReminder,
        setPinnedReminder,
        flatListRef,
        // Actions
        handleSend,
        handleDraftConfirm,
        handleDraftUpdateConfirm,
        processMessage,
        reset,
    };
}
