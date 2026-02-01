import { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Modal,
    ScrollView,
    Pressable,
    Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../contexts/SettingsContext';
import { ModalFieldUpdates } from '../types/ai-chat';
import { Reminder } from '../types/reminder';

type RepeatValue = 'none' | 'daily' | 'weekly' | 'monthly';

const repeatOptions: { value: RepeatValue; label: string }[] = [
    { value: 'none', label: 'No repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

interface InlineReminderPanelProps {
    type: 'create' | 'edit' | 'search';
    fields?: ModalFieldUpdates;
    searchResults?: Reminder[];
    isStatic?: boolean;
    onFieldsChange?: (fields: ModalFieldUpdates) => void;
    onSave?: () => void;
    onClose?: () => void;
    onSelectReminder?: (reminder: Reminder) => void;
}

type ActivePicker = 'repeat' | 'tag' | null;

export function InlineReminderPanel({
    type,
    fields = {},
    searchResults = [],
    isStatic = false,
    onFieldsChange,
    onSave,
    onClose,
    onSelectReminder,
}: InlineReminderPanelProps) {
    const { colors, isDark } = useTheme();
    const { tags } = useSettings();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [activePicker, setActivePicker] = useState<ActivePicker>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const selectedRepeat: RepeatValue = fields.repeat || 'none';
    const selectedRepeatLabel = repeatOptions.find((opt) => opt.value === selectedRepeat)?.label ?? 'No repeat';
    const selectedTag = tags.find((t) => t.id === fields.tag_id);

    // Helper functions
    const getDateForPicker = () => {
        if (fields.date) {
            const d = new Date(fields.date + 'T00:00:00');
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    };

    const getTimeForPicker = () => {
        if (!fields.time) return new Date();
        const [hours, minutes] = fields.time.split(':').map(Number);
        const d = new Date();
        d.setHours(hours || 0, minutes || 0, 0, 0);
        return d;
    };

    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return 'Add date';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return 'Add date';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    const formatDisplayTime = (timeStr?: string) => {
        if (!timeStr) return 'Add time';
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return 'Add time';
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateChange = (_: any, selected?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selected) {
            onFieldsChange?.({ ...fields, date: formatDateString(selected) });
            if (Platform.OS === 'ios') setShowDatePicker(false);
        }
    };

    const handleTimeChange = (_: any, selected?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selected) {
            const hours = selected.getHours().toString().padStart(2, '0');
            const minutes = selected.getMinutes().toString().padStart(2, '0');
            onFieldsChange?.({ ...fields, time: `${hours}:${minutes}` });
            if (Platform.OS === 'ios') setShowTimePicker(false);
        }
    };

    const renderSelectionModal = () => {
        if (!activePicker) return null;

        let title = '';
        let items: { id: string; label: string; color?: string }[] = [];

        if (activePicker === 'repeat') {
            title = 'Repeat';
            items = repeatOptions.map((opt) => ({ id: opt.value, label: opt.label }));
        } else if (activePicker === 'tag') {
            title = 'Tag';
            items = [
                { id: 'none', label: 'None' },
                ...tags.map((t) => ({ id: t.id, label: t.name, color: t.color })),
            ];
        }

        const handleSelect = (id: string) => {
            if (activePicker === 'repeat') {
                onFieldsChange?.({ ...fields, repeat: id as RepeatValue });
            } else if (activePicker === 'tag') {
                onFieldsChange?.({ ...fields, tag_id: id === 'none' ? undefined : id });
            }
            setActivePicker(null);
        };

        const getIsSelected = (id: string) => {
            if (activePicker === 'repeat') return id === selectedRepeat;
            if (activePicker === 'tag') return id === (fields.tag_id ?? 'none');
            return false;
        };

        return (
            <Modal transparent animationType="fade" visible onRequestClose={() => setActivePicker(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setActivePicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={colors.mutedForeground} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalList} contentContainerStyle={{ paddingVertical: spacing.sm }} showsVerticalScrollIndicator={false}>
                            {items.map((item) => {
                                const selected = getIsSelected(item.id);
                                return (
                                    <TouchableOpacity key={item.id} style={[styles.modalItem, selected && styles.modalItemSelected]} onPress={() => handleSelect(item.id)}>
                                        <View style={styles.modalItemLeft}>
                                            {item.color && <View style={[styles.modalColorDot, { backgroundColor: item.color }]} />}
                                            <Text style={[styles.modalItemLabel, selected && styles.modalItemLabelSelected]}>{item.label}</Text>
                                        </View>
                                        {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    // Render static summary (read-only)
    if (isStatic) {
        return (
            <View style={[
                styles.staticContainer,
                selectedTag && {
                    backgroundColor: `${selectedTag.color}${isDark ? '15' : '08'}`,
                    borderColor: selectedTag.color,
                    borderWidth: 1,
                    borderLeftWidth: 1, // Override the default 3
                }
            ]}>
                <View style={styles.staticHeader}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={styles.staticTitle}>{type === 'edit' ? 'Reminder Updated' : 'Reminder Created'}</Text>
                </View>
                <Text style={styles.staticReminderTitle}>{fields.title || 'Untitled'}</Text>
                <View style={styles.staticMeta}>
                    {fields.date && (
                        <View style={styles.staticMetaItem}>
                            <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                            <Text style={styles.staticMetaText}>{formatDisplayDate(fields.date)}</Text>
                        </View>
                    )}
                    {fields.time && (
                        <View style={styles.staticMetaItem}>
                            <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                            <Text style={styles.staticMetaText}>{formatDisplayTime(fields.time)}</Text>
                        </View>
                    )}
                    {selectedTag && (
                        <View style={[styles.staticTagChip, { backgroundColor: selectedTag.color + '20', borderColor: selectedTag.color }]}>
                            <Text style={[styles.staticTagText, { color: selectedTag.color }]}>{selectedTag.name}</Text>
                        </View>
                    )}
                    {selectedRepeat !== 'none' && (
                        <View style={styles.staticMetaItem}>
                            <Ionicons name="repeat-outline" size={12} color={colors.mutedForeground} />
                            <Text style={styles.staticMetaText}>{selectedRepeatLabel}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // Render search results
    if (type === 'search') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Search results</Text>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={16} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView style={styles.searchContainer} showsVerticalScrollIndicator={false}>
                    {searchResults.map((reminder) => {
                        const tag = tags.find((t) => t.id === reminder.tag_id);
                        return (
                            <TouchableOpacity
                                key={reminder.id}
                                style={[
                                    styles.searchItem,
                                    tag && {
                                        backgroundColor: `${tag.color}${isDark ? '15' : '08'}`,
                                        borderColor: tag.color,
                                    }
                                ]}
                                onPress={() => onSelectReminder?.(reminder)}
                            >
                                <View style={styles.searchContent}>
                                    <Text style={styles.searchTitle} numberOfLines={1}>{reminder.title}</Text>
                                    <View style={styles.searchMeta}>
                                        {reminder.date && (
                                            <View style={styles.searchMetaItem}>
                                                <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                                                <Text style={styles.searchMetaText}>{formatDisplayDate(reminder.date)}</Text>
                                            </View>
                                        )}
                                        {reminder.time && (
                                            <View style={styles.searchMetaItem}>
                                                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                                                <Text style={styles.searchMetaText}>{formatDisplayTime(reminder.time)}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        );
    }

    // Render interactive form (create/edit)
    return (
        <View style={[
            styles.container,
            selectedTag && {
                backgroundColor: `${selectedTag.color}${isDark ? '15' : '08'}`,
                borderColor: selectedTag.color,
                borderWidth: 1,
            }
        ]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{type === 'edit' ? 'Editing reminder' : 'Creating reminder'}</Text>
                {onClose && (
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                )}
            </View>

            <TextInput
                style={styles.titleInput}
                placeholder="What do you need to remember?"
                placeholderTextColor={colors.mutedForeground}
                value={fields.title ?? ''}
                onChangeText={(text) => onFieldsChange?.({ ...fields, title: text })}
            />

            {/* Date & Time */}
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.chip, fields.date && styles.chipActive]}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowDatePicker(true);
                    }}
                >
                    <Ionicons name="calendar-outline" size={14} color={fields.date ? colors.foreground : colors.mutedForeground} />
                    <Text style={[styles.chipText, fields.date && styles.chipTextActive]}>{formatDisplayDate(fields.date)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, fields.time && styles.chipActive]}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowTimePicker(true);
                    }}
                >
                    <Ionicons name="time-outline" size={14} color={fields.time ? colors.foreground : colors.mutedForeground} />
                    <Text style={[styles.chipText, fields.time && styles.chipTextActive]}>{formatDisplayTime(fields.time)}</Text>
                </TouchableOpacity>
            </View>

            {/* Repeat & Tag */}
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.metaButton}
                    onPress={() => {
                        Keyboard.dismiss();
                        setActivePicker('repeat');
                    }}
                >
                    <Text style={styles.metaLabel}>Repeat</Text>
                    <View style={styles.metaValueContainer}>
                        <Text style={styles.metaValue}>{selectedRepeatLabel}</Text>
                        <Ionicons name="chevron-down" size={12} color={colors.mutedForeground} />
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.metaButton}
                    onPress={() => {
                        Keyboard.dismiss();
                        setActivePicker('tag');
                    }}
                >
                    <Text style={styles.metaLabel}>Tag</Text>
                    <View style={styles.metaValueContainer}>
                        <Text style={styles.metaValue}>{selectedTag ? selectedTag.name : 'None'}</Text>
                        <Ionicons name="chevron-down" size={12} color={colors.mutedForeground} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Save button */}
            <TouchableOpacity
                style={[styles.saveButton, !(fields.title && fields.title.trim()) && styles.saveButtonDisabled]}
                disabled={!(fields.title && fields.title.trim())}
                onPress={onSave}
                activeOpacity={0.85}
            >
                <Text style={styles.saveButtonText}>{type === 'edit' ? 'Update Reminder' : 'Add Reminder'}</Text>
            </TouchableOpacity>

            {/* Date Picker */}
            {showDatePicker && (
                <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                    <Pressable style={styles.pickerBackdrop} onPress={() => setShowDatePicker(false)}>
                        <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerHeaderTitle}>Select Date</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={20} color={colors.mutedForeground} />
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={getDateForPicker()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                minimumDate={new Date()}
                                textColor={colors.foreground}
                                themeVariant={isDark ? 'dark' : 'light'}
                            />
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* Time Picker */}
            {showTimePicker && (
                <Modal transparent animationType="fade" visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
                    <Pressable style={styles.pickerBackdrop} onPress={() => setShowTimePicker(false)}>
                        <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerHeaderTitle}>Select Time</Text>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={20} color={colors.mutedForeground} />
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={getTimeForPicker()}
                                mode="time"
                                is24Hour={false}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChange}
                                textColor={colors.foreground}
                                themeVariant={isDark ? 'dark' : 'light'}
                            />
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {renderSelectionModal()}
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        // Inline container (fits in chat)
        container: {
            width: '100%',
            borderRadius: borderRadius.lg,
            backgroundColor: colors.card,
            padding: spacing.md,
            ...shadows.soft,
            marginVertical: spacing.xs,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
        },
        headerTitle: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.base,
            color: colors.foreground,
        },
        titleInput: {
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.fontSize.base,
            color: colors.foreground,
            marginBottom: spacing.sm,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            gap: 4,
        },
        chipActive: {
            borderColor: `${colors.primary}40`,
            backgroundColor: `${colors.primary}10`,
        },
        chipText: {
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.fontSize.sm,
            color: colors.mutedForeground,
        },
        chipTextActive: {
            color: colors.foreground,
        },
        metaButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
        },
        metaLabel: {
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.fontSize.sm,
            color: colors.mutedForeground,
        },
        metaValueContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        metaValue: {
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.fontSize.sm,
            color: colors.foreground,
        },
        saveButton: {
            marginTop: spacing.sm,
            height: 36,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        saveButtonDisabled: {
            opacity: 0.5,
        },
        saveButtonText: {
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.fontSize.sm,
            color: colors.primaryForeground,
        },

        // Static summary
        staticContainer: {
            width: '100%',
            borderRadius: borderRadius.lg,
            backgroundColor: colors.card,
            padding: spacing.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            marginVertical: spacing.xs,
        },
        staticHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: spacing.xs,
        },
        staticTitle: {
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.fontSize.sm,
            color: colors.primary,
        },
        staticReminderTitle: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.base,
            color: colors.foreground,
            marginBottom: spacing.xs,
        },
        staticMeta: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: spacing.sm,
        },
        staticMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        staticMetaText: {
            fontFamily: typography.fontFamily.regular,
            fontSize: 12,
            color: colors.mutedForeground,
        },
        staticTagChip: {
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: borderRadius.full,
            borderWidth: 1,
        },
        staticTagText: {
            fontFamily: typography.fontFamily.medium,
            fontSize: 11,
        },

        // Search results
        searchContainer: {
            maxHeight: 200,
        },
        searchItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            marginBottom: spacing.xs,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchContent: {
            flex: 1,
            marginRight: spacing.sm,
        },
        searchTitle: {
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.fontSize.sm,
            color: colors.foreground,
            marginBottom: 2,
        },
        searchMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        searchMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        searchMetaText: {
            fontFamily: typography.fontFamily.regular,
            fontSize: 11,
            color: colors.mutedForeground,
        },

        // Modals for pickers
        modalBackdrop: {
            flex: 1,
            backgroundColor: '#00000070',
            justifyContent: 'flex-end',
        },
        modalCard: {
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing['2xl'],
            ...shadows.card,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
        },
        modalTitle: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.lg,
            color: colors.foreground,
        },
        modalList: {
            maxHeight: 280,
        },
        modalItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.sm,
        },
        modalItemSelected: {
            borderRadius: borderRadius.md,
            backgroundColor: `${colors.primary}10`,
            paddingHorizontal: spacing.sm,
        },
        modalItemLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        modalItemLabel: {
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.fontSize.base,
            color: colors.foreground,
        },
        modalItemLabelSelected: {
            fontFamily: typography.fontFamily.medium,
            color: colors.primary,
        },
        modalColorDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        pickerBackdrop: {
            flex: 1,
            backgroundColor: '#00000070',
            justifyContent: 'center',
            alignItems: 'center',
        },
        pickerContainer: {
            backgroundColor: colors.card,
            borderRadius: 24,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            maxWidth: '90%',
            maxHeight: '80%',
            ...shadows.card,
        },
        pickerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        pickerHeaderTitle: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.lg,
            color: colors.foreground,
        },
    });
