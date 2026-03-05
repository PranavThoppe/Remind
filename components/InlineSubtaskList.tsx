import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
    ScaleDecorator,
    RenderItemParams,
} from 'react-native-draggable-flatlist';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { Subtask } from '../types/reminder';

interface InlineSubtaskListProps {
    subtasks: Subtask[];
    onChange: (subtasks: Subtask[]) => void;
    onSave?: (subtasks: Subtask[]) => void;
    onCancel?: () => void;
}

export function InlineSubtaskList({ subtasks, onChange, onSave, onCancel }: InlineSubtaskListProps) {
    const { colors } = useTheme();
    const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks);
    const listRef = useRef<any>(null);
    const subtasksRef = useRef(subtasks);
    const isCancelledRef = useRef(false);

    useEffect(() => {
        setLocalSubtasks(subtasks);
    }, [subtasks]);

    useEffect(() => {
        subtasksRef.current = localSubtasks;
    }, [localSubtasks]);

    useEffect(() => {
        return () => {
            if (onSave && !isCancelledRef.current) {
                // Filter out empty subtasks so we don't save blanks
                const validSubtasks = subtasksRef.current.filter(t => t.title.trim().length > 0);
                onSave(validSubtasks);
            }
        };
    }, []);

    const handleDataChange = (newData: Subtask[]) => {
        // Update positions based on array index
        const updated = newData.map((task, index) => ({
            ...task,
            position: index,
        }));
        setLocalSubtasks(updated);
        onChange(updated);
    };

    const handleToggleCompletion = (id: string) => {
        const updated = localSubtasks.map(t =>
            t.id === id ? { ...t, is_completed: !t.is_completed } : t
        );
        setLocalSubtasks(updated);
        onChange(updated);
    };

    const handleTextChange = (id: string, newTitle: string) => {
        const updated = localSubtasks.map(t =>
            t.id === id ? { ...t, title: newTitle } : t
        );
        setLocalSubtasks(updated);
        onChange(updated);
    };

    const handleDelete = (id: string) => {
        const updated = localSubtasks.filter(t => t.id !== id);
        // re-index positions
        const reIndexed = updated.map((task, index) => ({
            ...task,
            position: index,
        }));
        setLocalSubtasks(reIndexed);
        onChange(reIndexed);
    };

    const handleAddNew = () => {
        const newSubtask: Subtask = {
            id: `temp-${Date.now()}`,
            reminder_id: '', // Will be set on backend
            title: '',
            is_completed: false,
            position: localSubtasks.length,
        };
        const updated = [...localSubtasks, newSubtask];
        setLocalSubtasks(updated);
        onChange(updated);
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<Subtask>) => {
        return (
            <ScaleDecorator>
                <View
                    style={[
                        styles.row,
                        {
                            backgroundColor: isActive ? colors.muted : 'transparent',
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity onLongPress={drag} style={styles.dragHandle} disabled={isActive}>
                        <Ionicons name="reorder-two-outline" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => handleToggleCompletion(item.id)}
                    >
                        <Ionicons
                            name={item.is_completed ? "checkmark-circle" : "ellipse-outline"}
                            size={22}
                            color={item.is_completed ? colors.primary : colors.mutedForeground}
                        />
                    </TouchableOpacity>

                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                color: item.is_completed ? colors.mutedForeground : colors.foreground,
                                textDecorationLine: item.is_completed ? 'line-through' : 'none',
                            }
                        ]}
                        value={item.title}
                        onChangeText={(text) => handleTextChange(item.id, text)}
                        placeholder="Subtask description"
                        placeholderTextColor={colors.mutedForeground}
                        autoFocus={item.title === ''}
                    />

                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                        <Ionicons name="close" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                </View>
            </ScaleDecorator>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.foreground }]}>Subtasks</Text>
                </View>
                {onCancel && (
                    <TouchableOpacity
                        onPress={() => {
                            isCancelledRef.current = true;
                            onCancel();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                    </TouchableOpacity>
                )}
            </View>

            <DraggableFlatList
                ref={listRef}
                data={localSubtasks}
                onDragEnd={({ data }) => handleDataChange(data)}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={
                    <TouchableOpacity
                        style={[styles.row, styles.addRow, { borderColor: colors.border, justifyContent: 'center', paddingVertical: spacing.md }]}
                        onPress={handleAddNew}
                    >
                        <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={colors.primary}
                            style={{ marginRight: spacing.sm }}
                        />
                        <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.medium, fontSize: typography.fontSize.base }}>
                            Add Subtask
                        </Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        maxWidth: 340,
        maxHeight: 500, // Constraint height so the flatlist bounds it nicely
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        marginTop: spacing.sm,
        ...shadows.soft,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize.lg,
    },
    listContent: {
        paddingBottom: spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    addRow: {
        marginTop: spacing.sm,
        borderBottomWidth: 0,
    },
    dragHandle: {
        padding: spacing.xs,
    },
    checkboxContainer: {
        padding: spacing.xs,
        marginLeft: spacing.xs,
        marginRight: spacing.sm,
    },
    textInput: {
        flex: 1,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        paddingVertical: spacing.sm,
    },
    deleteButton: {
        padding: spacing.sm,
    },
    bottomButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        paddingTop: spacing.sm,
        gap: spacing.sm,
    },
    saveButton: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
    },
});
