import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Reminder } from '../types/reminder';

export interface InlineEditChipsProps {
    date: string | null;
    time: string | null;
    tag_id?: string | null;
    priority_id?: string | null;
    notification_offsets?: number[];
    repeat?: string;
    subtasks?: any[];
    onChange: (fields: Partial<Reminder>) => void;
    onOpenNotifications?: () => void;
    onOpenRepeat?: () => void;
    onOpenSubtasks?: () => void;
    onPickerStateChange?: (isOpen: boolean) => void;
}

export function InlineEditChips({
    date,
    time,
    tag_id,
    priority_id,
    notification_offsets,
    repeat,
    subtasks,
    onChange,
    onOpenNotifications,
    onOpenRepeat,
    onOpenSubtasks,
    onPickerStateChange,
}: InlineEditChipsProps) {
    const { colors, isDark } = useTheme();
    const { tags, priorities } = useSettings();

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        onPickerStateChange?.(showDatePicker || showTimePicker);
    }, [showDatePicker, showTimePicker, onPickerStateChange]);

    // Helper functions
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'No date';
        // Use parts to avoid timezone shifting
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        }
        return dateStr;
    };

    const formatDisplayTime = (timeStr: string | null) => {
        if (!timeStr) return 'No time';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const tag = tags.find(t => t.id === tag_id);
    const priority = priorities.find(p => p.id === priority_id);

    // Parse strings to dates for the pickers
    let editDateObj = new Date();
    if (date) {
        const parts = date.split('-');
        if (parts.length === 3) {
            editDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }

    let editTimeObj = new Date();
    if (time) {
        const [h, m] = time.split(':').map(Number);
        editTimeObj.setHours(h, m, 0, 0);
    }

    return (
        <View style={styles.container}>
            <View style={styles.chipsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                    {/* Date Chip */}
                    <TouchableOpacity
                        style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowDatePicker(!showDatePicker);
                            setShowTimePicker(false);
                        }}
                    >
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={[styles.chipText, { color: colors.foreground }]}>
                            {formatDate(date)}
                        </Text>
                    </TouchableOpacity>

                    {/* Time Chip */}
                    <TouchableOpacity
                        style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowTimePicker(!showTimePicker);
                            setShowDatePicker(false);
                        }}
                    >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={[styles.chipText, { color: colors.foreground }]}>
                            {formatDisplayTime(time)}
                        </Text>
                    </TouchableOpacity>

                    {/* Tag Chip */}
                    <TouchableOpacity
                        style={[
                            styles.chip,
                            {
                                backgroundColor: tag ? `${tag.color}20` : colors.card,
                                borderColor: tag ? tag.color : colors.border,
                            },
                        ]}
                        onPress={() => {
                            const currentIdx = tags.findIndex(t => t.id === tag_id);
                            if (currentIdx === -1 || currentIdx === tags.length - 1) {
                                onChange({ tag_id: tags.length > 0 ? tags[0].id : null });
                            } else {
                                onChange({ tag_id: tags[currentIdx + 1].id });
                            }
                        }}
                        onLongPress={() => onChange({ tag_id: null })}
                    >
                        <Ionicons name="pricetag-outline" size={14} color={tag ? tag.color : colors.mutedForeground} />
                        {tag && (
                            <Text style={[styles.chipText, { color: tag.color }]}>
                                {tag.name}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Priority Chip */}
                    <TouchableOpacity
                        style={[
                            styles.chip,
                            {
                                backgroundColor: priority ? `${priority.color}20` : colors.card,
                                borderColor: priority ? priority.color : colors.border,
                            },
                        ]}
                        onPress={() => {
                            const currentIdx = priorities.findIndex(p => p.id === priority_id);
                            if (currentIdx === -1 || currentIdx === priorities.length - 1) {
                                onChange({ priority_id: priorities.length > 0 ? priorities[0].id : null });
                            } else {
                                onChange({ priority_id: priorities[currentIdx + 1].id });
                            }
                        }}
                        onLongPress={() => onChange({ priority_id: null })}
                    >
                        <Ionicons name="flag-outline" size={14} color={priority ? priority.color : colors.mutedForeground} />
                        {priority && (
                            <Text style={[styles.chipText, { color: priority.color }]}>
                                {priority.name}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Notification Chip conditionally rendered */}
                    {onOpenNotifications && (
                        <TouchableOpacity
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: (notification_offsets && notification_offsets.length > 0) ? `${colors.primary}20` : colors.card,
                                    borderColor: (notification_offsets && notification_offsets.length > 0) ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => {
                                Keyboard.dismiss();
                                onOpenNotifications();
                            }}
                        >
                            <Ionicons
                                name={(notification_offsets && notification_offsets.length > 0) ? "notifications" : "notifications-outline"}
                                size={14}
                                color={(notification_offsets && notification_offsets.length > 0) ? colors.primary : colors.mutedForeground}
                            />
                            {(notification_offsets && notification_offsets.length > 0) && (
                                <Text style={[styles.chipText, { color: colors.primary }]}>
                                    Notification
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Repeat Chip conditionally rendered */}
                    {onOpenRepeat && (
                        <TouchableOpacity
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: (repeat && repeat !== 'none') ? `${colors.primary}20` : colors.card,
                                    borderColor: (repeat && repeat !== 'none') ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => {
                                Keyboard.dismiss();
                                onOpenRepeat();
                            }}
                        >
                            <Ionicons
                                name={(repeat && repeat !== 'none') ? "repeat" : "repeat-outline"}
                                size={14}
                                color={(repeat && repeat !== 'none') ? colors.primary : colors.mutedForeground}
                            />
                            {(repeat && repeat !== 'none') && (
                                <Text style={[styles.chipText, { color: colors.primary }]}>
                                    Repeat
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Subtasks Chip conditionally rendered */}
                    {onOpenSubtasks && (
                        <TouchableOpacity
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: (subtasks && subtasks.length > 0) ? `${colors.primary}20` : colors.card,
                                    borderColor: (subtasks && subtasks.length > 0) ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => {
                                Keyboard.dismiss();
                                onOpenSubtasks();
                            }}
                        >
                            <Ionicons
                                name={(subtasks && subtasks.length > 0) ? "checkbox" : "checkbox-outline"}
                                size={14}
                                color={(subtasks && subtasks.length > 0) ? colors.primary : colors.mutedForeground}
                            />
                            {(subtasks && subtasks.length > 0) && (
                                <Text style={[styles.chipText, { color: colors.primary }]}>
                                    {subtasks.filter((s: any) => s.is_completed).length}/{subtasks.length}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>

            {/* Inline Pickers */}
            {showDatePicker && (
                <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <DateTimePicker
                        value={editDateObj}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={(_event: any, selectedDate?: Date) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (selectedDate) {
                                const yyyy = selectedDate.getFullYear();
                                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const dd = String(selectedDate.getDate()).padStart(2, '0');
                                onChange({ date: `${yyyy}-${mm}-${dd}` });
                            }
                        }}
                        textColor={colors.foreground}
                        themeVariant={isDark ? 'dark' : 'light'}
                    />
                </View>
            )}

            {showTimePicker && (
                <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <DateTimePicker
                        value={editTimeObj}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_event: any, selectedTime?: Date) => {
                            setShowTimePicker(Platform.OS === 'ios');
                            if (selectedTime) {
                                const hours = selectedTime.getHours().toString().padStart(2, '0');
                                const mins = selectedTime.getMinutes().toString().padStart(2, '0');
                                onChange({ time: `${hours}:${mins}` });
                            }
                        }}
                        textColor={colors.foreground}
                        themeVariant={isDark ? 'dark' : 'light'}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    chipsContainer: {
        height: 36,
        width: '100%',
    },
    chipsScroll: {
        flexGrow: 0,
        alignItems: 'center',
        paddingRight: spacing.xl,
        paddingLeft: spacing.xs,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 8,
        gap: 6,
    },
    chipText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 13,
    },
    pickerContainer: {
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
});
