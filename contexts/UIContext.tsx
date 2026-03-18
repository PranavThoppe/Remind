import * as React from 'react';
import { createContext, useContext, useState } from 'react';
import { Reminder } from '../types/reminder';
import { CardLayout } from '../components/ReminderCard';

interface UIContextType {
    isAddSheetOpen: boolean;
    editingReminder: Reminder | null;
    editSourceLayout: CardLayout | null;
    openAddSheet: () => void;
    closeAddSheet: () => void;
    openEditSheet: (reminder: Reminder, layout?: CardLayout) => void;
    closeEditSheet: () => void;
    isAiChatOpen: boolean;
    setIsAiChatOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [editSourceLayout, setEditSourceLayout] = useState<CardLayout | null>(null);
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);

    const openAddSheet = () => setIsAddSheetOpen(true);
    const closeAddSheet = () => {
        setIsAddSheetOpen(false);
        setEditingReminder(null);
    };

    const openEditSheet = (reminder: Reminder, layout?: CardLayout) => {
        setEditingReminder(reminder);
        if (layout) {
            setEditSourceLayout(layout);
        }
    };

    const closeEditSheet = () => {
        setEditingReminder(null);
        setEditSourceLayout(null);
    };

    return (
        <UIContext.Provider
            value={{
                isAddSheetOpen,
                editingReminder,
                editSourceLayout,
                openAddSheet,
                closeAddSheet,
                openEditSheet,
                closeEditSheet,
                isAiChatOpen,
                setIsAiChatOpen,
            }}
        >
            {children}
        </UIContext.Provider>
    );
}

export const useUI = () => {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
