import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
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

type RepeatValue = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

const repeatOptions: { value: RepeatValue; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export interface AiLiveReminderPanelProps {
  isOpen: boolean;
  fields: ModalFieldUpdates;
  searchResults?: Reminder[];
  onSelectReminder?: (reminder: Reminder) => void;
  onChangeFields: (updates: Partial<ModalFieldUpdates>) => void;
  onClose: () => void;
  onSave: () => Promise<void> | void;
}

type ActivePicker = 'repeat' | 'tag' | 'priority' | null;

export function AiLiveReminderPanel({
  isOpen,
  fields,
  searchResults = [],
  onSelectReminder,
  onChangeFields,
  onClose,
  onSave,
}: AiLiveReminderPanelProps) {
  const { colors, isDark } = useTheme();
  const { tags, priorities } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset pickers whenever component is shown
  useEffect(() => {
    if (isOpen) {
      setShowDatePicker(false);
      setShowTimePicker(false);
      setActivePicker(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isSearching = searchResults.length > 0;
  const isUpdating = !!fields.title; // If title is already there, we're probably updating/refining

  const selectedRepeat: RepeatValue = fields.repeat || 'none';

  const selectedRepeatLabel =
    repeatOptions.find((opt) => opt.value === selectedRepeat)?.label ?? 'None';

  const selectedTag = tags.find((t) => t.id === fields.tag_id);

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

  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Add date';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return 'Add date';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatDisplayTime = (timeStr?: string | null) => {
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
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selected) {
      onChangeFields({ date: formatDateString(selected) });
      if (Platform.OS === 'ios') {
        // On iOS, close after selection
        setShowDatePicker(false);
      }
    }
  };

  const handleTimeChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selected) {
      const hours = selected.getHours().toString().padStart(2, '0');
      const minutes = selected.getMinutes().toString().padStart(2, '0');
      onChangeFields({ time: `${hours}:${minutes}` });
      if (Platform.OS === 'ios') {
        // On iOS, close after selection
        setShowTimePicker(false);
      }
    }
  };

  const handleSavePress = async () => {
    await onSave();
  };

  const renderSelectionModal = () => {
    if (!activePicker) return null;

    let title = '';
    let items: { id: string; label: string; color?: string }[] = [];

    if (activePicker === 'repeat') {
      title = 'Repeat';
      items = repeatOptions.map((opt) => ({
        id: opt.value,
        label: opt.label,
      }));
    } else if (activePicker === 'priority') {
      title = 'Priority';
      items = [
        { id: 'none', label: 'None' },
        ...priorities.map((p) => ({
          id: p.id,
          label: `${p.rank}. ${p.name}`,
          color: p.color,
        })),
      ];
    } else if (activePicker === 'tag') {
      title = 'Tag';
      items = [
        { id: 'none', label: 'None' },
        ...tags.map((t) => ({
          id: t.id,
          label: t.name,
          color: t.color,
        })),
      ];
    }

    const handleSelect = (id: string) => {
      if (activePicker === 'repeat') {
        onChangeFields({ repeat: id as RepeatValue });
      } else if (activePicker === 'tag') {
        onChangeFields({ tag_id: id === 'none' ? null : id });
      } else if (activePicker === 'priority') {
        onChangeFields({ priority_id: id === 'none' ? null : id });
      }
      setActivePicker(null);
    };

    const getIsSelected = (id: string) => {
      if (activePicker === 'repeat') {
        return id === selectedRepeat;
      }
      if (activePicker === 'tag') {
        return id === (fields.tag_id ?? 'none');
      }
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
            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ paddingVertical: spacing.sm }}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => {
                const selected = getIsSelected(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalItem,
                      selected && styles.modalItemSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}
                  >
                    <View style={styles.modalItemLeft}>
                      {item.color && (
                        <View style={[styles.modalColorDot, { backgroundColor: item.color }]} />
                      )}
                      <Text
                        style={[
                          styles.modalItemLabel,
                          selected && styles.modalItemLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {isSearching ? 'Search results' : isUpdating ? 'Updating reminder' : 'Creating reminder'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isSearching ? 'I found these reminders' : 'Live preview from your chat'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>

      {isSearching ? (
        <ScrollView style={styles.searchResultsContainer} showsVerticalScrollIndicator={false}>
          {searchResults.map((reminder) => {
            const tag = tags.find((t) => t.id === reminder.tag_id);
            return (
              <TouchableOpacity
                key={reminder.id}
                style={[
                  styles.searchResultItem,
                  tag && { borderLeftColor: tag.color, borderLeftWidth: 3 },
                ]}
                onPress={() => onSelectReminder?.(reminder)}
              >
                <View style={styles.searchResultContent}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                    {reminder.title}
                  </Text>
                  <View style={styles.searchResultMeta}>
                    {reminder.date && (
                      <View style={styles.searchResultMetaItem}>
                        <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                        <Text style={styles.searchResultMetaText}>{formatDisplayDate(reminder.date)}</Text>
                      </View>
                    )}
                    {reminder.time && (
                      <View style={styles.searchResultMetaItem}>
                        <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                        <Text style={styles.searchResultMetaText}>{formatDisplayTime(reminder.time)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <>
          {/* Title - excluded from keyboard dismiss so user can type */}
          <TextInput
            style={styles.titleInput}
            placeholder="What do you need to remember?"
            placeholderTextColor={colors.mutedForeground}
            value={fields.title ?? ''}
            onChangeText={(text) => onChangeFields({ title: text })}
          />

          {/* Rest of the panel - tapping dismisses keyboard */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              {/* Date & Time row */}
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    fields.date && styles.chipActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={fields.date ? colors.foreground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      fields.date && styles.chipTextActive,
                    ]}
                  >
                    {formatDisplayDate(fields.date)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chip,
                    fields.time && styles.chipActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={fields.time ? colors.foreground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      fields.time && styles.chipTextActive,
                    ]}
                  >
                    {formatDisplayTime(fields.time)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick options: Repeat / Tag */}
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
                    <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
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
                    <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !(fields.title && fields.title.trim()) && styles.saveButtonDisabled,
                ]}
                disabled={!(fields.title && fields.title.trim())}
                onPress={handleSavePress}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {isUpdating ? 'Update Reminder' : 'Add Reminder'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          transparent
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setShowDatePicker(false)}
          >
            <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerHeaderTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          transparent
          animationType="fade"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setShowTimePicker(false)}
          >
            <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerHeaderTitle}>Select Time</Text>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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
    container: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      borderRadius: 24,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      ...shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.fontSize.lg,
      color: colors.foreground,
    },
    headerSubtitle: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.fontSize.sm,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    headerClose: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.muted,
    },
    titleInput: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.fontSize.base,
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: spacing.xs,
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaLabel: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.fontSize.sm,
      color: colors.mutedForeground,
    },
    metaValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    metaValue: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.fontSize.sm,
      color: colors.foreground,
    },
    saveButton: {
      marginTop: spacing.lg,
      height: 44,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.fontSize.base,
      color: colors.primaryForeground,
    },
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
    searchResultsContainer: {
      maxHeight: 220,
      marginBottom: spacing.md,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchResultContent: {
      flex: 1,
      marginRight: spacing.md,
    },
    searchResultTitle: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.fontSize.base,
      color: colors.foreground,
      marginBottom: 2,
    },
    searchResultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    searchResultMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    searchResultMetaText: {
      fontFamily: typography.fontFamily.regular,
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });

