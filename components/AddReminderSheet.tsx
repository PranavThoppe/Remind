import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, shadows, spacing, borderRadius, typography } from '../constants/theme';
import { Reminder } from '../types/reminder';
import { scheduleReminderNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';

interface AddReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => Promise<any>;
  editReminder?: Reminder | null;
}


const repeatOptions = [
  { value: 'none' as const, label: 'No repeat' },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function AddReminderSheet({ isOpen, onClose, onSave, editReminder }: AddReminderSheetProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [tagId, setTagId] = useState<string | undefined>();
  const [priorityId, setPriorityId] = useState<string | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { tags, priorities } = useSettings();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (editReminder) {
      setTitle(editReminder.title);
      // Parse YYYY-MM-DD string back to Date object for the picker
      setDate(editReminder.date ? new Date(editReminder.date + 'T00:00:00') : undefined);
      setTime(editReminder.time || '');
      setRepeat(editReminder.repeat || 'none');
      setTagId(editReminder.tag_id);
      setPriorityId(editReminder.priority_id);
    } else {
      setTitle('');
      setDate(undefined);
      setTime('');
      setRepeat('none');
      setTagId(undefined);
      setPriorityId(undefined);
    }
    // Reset picker visibility when sheet is opened or closed
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [editReminder, isOpen]);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 10,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    Keyboard.dismiss();

    // Format date as YYYY-MM-DD for Supabase (default to today if not set) using local time
    const d = date || new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const { data: savedReminder, error } = await onSave({
      title: title.trim(),
      date: dateString,
      time: time || undefined,
      repeat,
      tag_id: tagId,
      priority_id: priorityId,
    }) as any;

    // Schedule notification
    if (!error && savedReminder && dateString) {
      scheduleReminderNotification(
        title.trim(),
        dateString,
        time || undefined,
        repeat,
        savedReminder.id // Pass the ID for completion logic
      ).catch(error => console.error('Failed to schedule notification:', error));
    }

    setTitle('');
    setDate(undefined);
    setTime('');
    setRepeat('none');
    handleClose();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const getTimeDate = () => {
    if (!time) return new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      // Manually format to HH:mm to ensure Postgres compatibility
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      setTime(timeString);
    }
  };

  const formatDate = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return 'Add time';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2],
            }),
          },
        ]}
      >
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            marginBottom: keyboardHeight,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {editReminder ? 'Edit Reminder' : 'New Reminder'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input */}
          <TextInput
            style={styles.input}
            placeholder="What do you need to remember?"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />

          {/* Date & Time Row */}
          <View style={styles.dateTimeRow}>
            {/* Date Picker */}
            <TouchableOpacity
              style={[
                styles.pickerButton,
                date && styles.pickerButtonActive,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setShowDatePicker(!showDatePicker);
                setShowTimePicker(false);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={date ? colors.foreground : colors.mutedForeground}
              />
              <Text style={[
                styles.pickerButtonText,
                date && styles.pickerButtonTextActive,
              ]}>
                {date ? formatDate(date) : 'Add date'}
              </Text>
            </TouchableOpacity>

            {/* Time Picker */}
            <TouchableOpacity
              style={[
                styles.pickerButton,
                time && styles.pickerButtonActive,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setShowTimePicker(!showTimePicker);
                setShowDatePicker(false);
              }}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={time ? colors.foreground : colors.mutedForeground}
              />
              <Text style={[
                styles.pickerButtonText,
                time && styles.pickerButtonTextActive,
              ]}>
                {formatDisplayTime(time)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Picker Modal */}
          {showTimePicker && (
            <DateTimePicker
              value={getTimeDate()}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              textColor={colors.foreground}
              themeVariant="light"
            />
          )}

          {/* Date Picker Modal (Android shows inline) */}
          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
              textColor={colors.foreground}
              themeVariant="light"

            />
          )}

          {/* Repeat Options */}
          <View style={styles.repeatSection}>
            <View style={styles.repeatHeader}>
              <Ionicons name="repeat" size={18} color={colors.mutedForeground} />
              <Text style={styles.repeatLabel}>Repeat</Text>
            </View>
            <View style={styles.repeatOptions}>
              {repeatOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.repeatOption,
                    repeat === option.value && styles.repeatOptionActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRepeat(option.value);
                  }}
                >
                  <Text style={[
                    styles.repeatOptionText,
                    repeat === option.value && styles.repeatOptionTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tag Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.sectionLabel}>Tag</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              <TouchableOpacity
                style={[styles.tagOption, !tagId && styles.tagOptionActive]}
                onPress={() => setTagId(undefined)}
              >
                <Text style={[styles.tagText, !tagId && styles.tagTextActive]}>None</Text>
              </TouchableOpacity>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagOption,
                    tagId === tag.id && { backgroundColor: tag.color, borderColor: tag.color },
                  ]}
                  onPress={() => setTagId(tag.id)}
                >
                  <View style={[styles.tagDot, { backgroundColor: tagId === tag.id ? 'white' : tag.color }]} />
                  <Text style={[styles.tagText, tagId === tag.id && { color: 'white' }]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Priority Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flag-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.sectionLabel}>Priority</Text>
            </View>
            <View style={styles.priorityOptions}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.id}
                  style={[
                    styles.priorityOption,
                    priorityId === priority.id && { backgroundColor: `${priority.color}15`, borderColor: priority.color },
                  ]}
                  onPress={() => setPriorityId(priority.id)}
                >
                  <Ionicons 
                    name={priorityId === priority.id ? "flag" : "flag-outline"} 
                    size={16} 
                    color={priority.color} 
                  />
                  <Text style={[styles.priorityText, { color: priority.color }]}>
                    {priority.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              !title.trim() && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!title.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {editReminder ? 'Save Changes' : 'Add Reminder'}
            </Text>
          </TouchableOpacity>

          {/* Bottom padding for safe area */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.foreground,
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...shadows.cardHover,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.mutedForeground}30`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
  },
  closeButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  input: {
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.muted,
    backgroundColor: `${colors.muted}30`,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.xl,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.muted,
    backgroundColor: `${colors.muted}30`,
  },
  pickerButtonActive: {
    borderColor: `${colors.primary}30`,
    backgroundColor: `${colors.primary}08`,
  },
  pickerButtonText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  pickerButtonTextActive: {
    color: colors.foreground,
  },
  repeatSection: {
    marginBottom: spacing.xl,
  },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  repeatLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  repeatOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  repeatOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.muted}50`,
    alignItems: 'center',
  },
  repeatOptionActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  repeatOptionText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  repeatOptionTextActive: {
    color: colors.primaryForeground,
  },
  saveButton: {
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.primaryForeground,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  horizontalScroll: {
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.muted,
    marginRight: spacing.sm,
    backgroundColor: colors.card,
  },
  tagOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  tagText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  tagTextActive: {
    color: 'white',
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  priorityOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.muted,
    backgroundColor: colors.card,
  },
  priorityText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
  },
});
