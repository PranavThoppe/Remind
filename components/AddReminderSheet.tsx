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
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { Reminder } from '../types/reminder';
import { ModalFieldUpdates } from '../types/ai-chat';
import { scheduleReminderNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { ColorPicker } from './ColorPicker';
import { PRESET_COLORS } from '../types/settings';

interface AddReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => Promise<any>;
  editReminder?: Reminder | null;
  // Live mode props for AI chat integration
  liveMode?: boolean;
  externalFields?: ModalFieldUpdates;
}


const repeatOptions = [
  { value: 'none' as const, label: 'No repeat' },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function AddReminderSheet({
  isOpen,
  onClose,
  onSave,
  editReminder,
  liveMode,
  externalFields,
}: AddReminderSheetProps) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [tagId, setTagId] = useState<string | null | undefined>();
  const [priorityId, setPriorityId] = useState<string | null | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { tags, priorities, addTag, addPriority } = useSettings();

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0].color);

  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState(PRESET_COLORS[0].color);

  // Track which entity we are picking a color for
  const [colorPickerMode, setColorPickerMode] = useState<'tag' | 'priority'>('tag');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Field animations for live mode
  const fieldAnimations = useRef({
    title: new Animated.Value(1),
    date: new Animated.Value(1),
    time: new Animated.Value(1),
    tag: new Animated.Value(1),
    priority: new Animated.Value(1),
  }).current;

  const animateFieldUpdate = (field: keyof typeof fieldAnimations) => {
    // Pulse animation: scale up slightly then back
    Animated.sequence([
      Animated.timing(fieldAnimations[field], {
        toValue: 1.03,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fieldAnimations[field], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    await addTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setIsAddingTag(false);
    // Reset to a random color for next time
    setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].color);
  };

  const handleAddPriority = async () => {
    if (!newPriorityName.trim()) return;

    // Calculate next rank (max rank + 1)
    const maxRank = priorities.length > 0
      ? Math.max(...priorities.map(p => p.rank))
      : 0;

    await addPriority(newPriorityName.trim(), newPriorityColor, maxRank + 1);

    setNewPriorityName('');
    setIsAddingPriority(false);
    // Reset to a random color
    setNewPriorityColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].color);
  };

  const toggleAddTag = () => {
    if (!isAddingTag) {
      setColorPickerMode('tag');
      setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].color);
    }
    setIsAddingTag(!isAddingTag);
    if (isAddingPriority) setIsAddingPriority(false);
  };

  const toggleAddPriority = () => {
    if (!isAddingPriority) {
      setColorPickerMode('priority');
      setNewPriorityColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].color);
    }
    setIsAddingPriority(!isAddingPriority);
    if (isAddingTag) setIsAddingTag(false);
  };

  const handleColorSelect = (color: string) => {
    if (colorPickerMode === 'tag') {
      setNewTagColor(color);
    } else {
      setNewPriorityColor(color);
    }
  };


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
      setTagId(null);
      setPriorityId(null);
    }
    // Reset picker visibility when sheet is opened or closed
    setShowDatePicker(false);
    setShowTimePicker(false);
    setIsAddingTag(false);
    setIsAddingPriority(false);
  }, [editReminder, isOpen]);

  // Effect for live updates in conversational mode
  useEffect(() => {
    if (liveMode && externalFields && isOpen) {
      // Update title with animation
      if (externalFields.title !== undefined && externalFields.title !== title) {
        setTitle(externalFields.title);
        animateFieldUpdate('title');
      }

      // Update date with animation
      if (externalFields.date !== undefined) {
        if (externalFields.date === null) {
          if (date !== undefined) {
            setDate(undefined);
            animateFieldUpdate('date');
          }
        } else {
          const newDate = new Date(externalFields.date + 'T00:00:00');
          if (!date || newDate.getTime() !== date.getTime()) {
            setDate(newDate);
            animateFieldUpdate('date');
          }
        }
      }

      // Update time with animation
      if (externalFields.time !== undefined && (externalFields.time || '') !== time) {
        setTime(externalFields.time || '');
        animateFieldUpdate('time');
      }

      // Update tag with animation
      if (externalFields.tag_id !== undefined && externalFields.tag_id !== tagId) {
        setTagId(externalFields.tag_id);
        animateFieldUpdate('tag');
      }

      // Update priority with animation
      if (externalFields.priority_id !== undefined && externalFields.priority_id !== priorityId) {
        setPriorityId(externalFields.priority_id);
        animateFieldUpdate('priority');
      }
    }
  }, [externalFields, liveMode, isOpen]);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setShowDatePicker(false);
        setShowTimePicker(false);
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
    if (isOpen && !liveMode) {
      // Only run the full-screen slide/backdrop animations in default modal mode.
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
    } else if (!isOpen && !liveMode) {
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
  }, [isOpen, liveMode, slideAnim, backdropAnim]);

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

    const result = await onSave({
      title: title.trim(),
      date: dateString,
      time: time || undefined,
      repeat,
      tag_id: tagId || null,
      priority_id: priorityId || null,
    }) as any;

    const savedReminder = result?.data;
    const error = result?.error;

    if (error) {
      console.error('[AddReminderSheet] Error saving reminder:', error);
    }

    // Schedule notification
    if (!error && savedReminder && dateString) {
      console.log('[AddReminderSheet] Scheduling notification for saved reminder:', savedReminder.id);
      scheduleReminderNotification(
        title.trim(),
        dateString,
        time || undefined,
        repeat,
        savedReminder.id // Pass the ID for completion logic
      ).catch(err => console.error('[AddReminderSheet] Failed to schedule notification:', err));
    } else {
      console.log('[AddReminderSheet] Skipping notification scheduling:', { hasError: !!error, hasSavedReminder: !!savedReminder, hasDateString: !!dateString });
    }

    setTitle('');
    setDate(undefined);
    setTime('');
    setRepeat('none');
    setTagId(null);
    setPriorityId(null);
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
  // Shared sheet content used in both default modal mode and inline liveMode.
  const sheetContent = (
    <Animated.View
      style={[
        liveMode ? styles.inlineSheet : styles.sheet,
        !liveMode && {
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
          {editReminder ? 'Edit Reminder' : liveMode ? 'Creating Reminder' : 'New Reminder'}
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
        <Animated.View style={{ transform: [{ scale: fieldAnimations.title }] }}>
          <TextInput
            style={styles.input}
            placeholder="What do you need to remember?"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            onFocus={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          />
        </Animated.View>

        {/* Date & Time Row */}
        <View style={styles.dateTimeRow}>
          {/* Date Picker */}
          <Animated.View
            style={[styles.pickerButtonWrapper, { transform: [{ scale: fieldAnimations.date }] }]}
          >
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
              <Text
                style={[
                  styles.pickerButtonText,
                  date && styles.pickerButtonTextActive,
                ]}
              >
                {date ? formatDate(date) : 'Add date'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Time Picker */}
          <Animated.View
            style={[styles.pickerButtonWrapper, { transform: [{ scale: fieldAnimations.time }] }]}
          >
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
              <Text
                style={[
                  styles.pickerButtonText,
                  time && styles.pickerButtonTextActive,
                ]}
              >
                {formatDisplayTime(time)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
            themeVariant={isDark ? 'dark' : 'light'}
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
            themeVariant={isDark ? 'dark' : 'light'}
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
                <Text
                  style={[
                    styles.repeatOptionText,
                    repeat === option.value && styles.repeatOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority Selection */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, styles.headerSpaceBetween]}>
            <View style={styles.headerLabelContainer}>
              <Ionicons name="flag-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.sectionLabel}>Priority</Text>
            </View>
            <TouchableOpacity
              onPress={toggleAddPriority}
              style={styles.addTagButton}
            >
              <Ionicons
                name={isAddingPriority ? "close" : "add"}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {isAddingPriority && (
            <View style={styles.addTagInputContainer}>
              <TouchableOpacity
                style={[styles.newTagColorPreview, { backgroundColor: newPriorityColor }]}
                onPress={() => {
                  Keyboard.dismiss();
                  setColorPickerMode('priority');
                  setShowColorPicker(true);
                }}
              />
              <TextInput
                style={styles.addTagInput}
                placeholder="New priority name"
                placeholderTextColor={colors.mutedForeground}
                value={newPriorityName}
                onChangeText={setNewPriorityName}
                autoFocus
                onSubmitEditing={handleAddPriority}
              />
              <TouchableOpacity
                style={styles.addTagConfirmButton}
                onPress={handleAddPriority}
                disabled={!newPriorityName.trim()}
              >
                <Ionicons name="checkmark" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
          >
            <TouchableOpacity
              style={[styles.tagOption, !priorityId && styles.tagOptionActive]}
              onPress={() => setPriorityId(null)}
            >
              <Text style={[styles.tagText, !priorityId && styles.tagTextActive]}>None</Text>
            </TouchableOpacity>
            {priorities.map((priority) => (
              <TouchableOpacity
                key={priority.id}
                style={[
                  styles.tagOption,
                  priorityId === priority.id && {
                    backgroundColor: priority.color,
                    borderColor: priority.color,
                  },
                ]}
                onPress={() => setPriorityId(priority.id)}
              >
                <Text
                  style={[
                    styles.priorityRankText,
                    priorityId === priority.id && { color: 'white' },
                  ]}
                >
                  {priority.rank}
                </Text>
                <Text
                  style={[styles.tagText, priorityId === priority.id && { color: 'white' }]}
                >
                  {priority.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tag Selection */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, styles.headerSpaceBetween]}>
            <View style={styles.headerLabelContainer}>
              <Ionicons name="pricetag-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.sectionLabel}>Tag</Text>
            </View>
            <TouchableOpacity
              onPress={toggleAddTag}
              style={styles.addTagButton}
            >
              <Ionicons
                name={isAddingTag ? "close" : "add"}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {isAddingTag && (
            <View style={styles.addTagInputContainer}>
              <TouchableOpacity
                style={[styles.newTagColorPreview, { backgroundColor: newTagColor }]}
                onPress={() => {
                  Keyboard.dismiss();
                  setColorPickerMode('tag');
                  setShowColorPicker(true);
                }}
              />
              <TextInput
                style={styles.addTagInput}
                placeholder="New tag name"
                placeholderTextColor={colors.mutedForeground}
                value={newTagName}
                onChangeText={setNewTagName}
                autoFocus
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity
                style={styles.addTagConfirmButton}
                onPress={handleAddTag}
                disabled={!newTagName.trim()}
              >
                <Ionicons name="checkmark" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
          >
            <TouchableOpacity
              style={[styles.tagOption, !tagId && styles.tagOptionActive]}
              onPress={() => setTagId(null)}
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
                <View
                  style={[
                    styles.tagDot,
                    { backgroundColor: tagId === tag.id ? 'white' : tag.color },
                  ]}
                />
                <Text style={[styles.tagText, tagId === tag.id && { color: 'white' }]}>
                  {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  );

  // In live conversational mode, render inline inside the layout (between chat and input),
  // so that the user's text input remains visible and usable.
  if (liveMode) {
    return sheetContent;
  }

  // Default behavior: render as full-screen modal bottom sheet (used on Home screen, etc.).
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
              outputRange: [0, 0.4],
            }),
          },
        ]}
      >
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      {sheetContent}

      <ColorPicker
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        selectedColor={colorPickerMode === 'tag' ? newTagColor : newPriorityColor}
        onSelect={handleColorSelect}
        colors={colors}
      />
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
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
  // Inline variant for AI chat: sits between messages and input, not full-screen.
  inlineSheet: {
    backgroundColor: colors.card,
    borderRadius: 24,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.6,
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
    borderColor: colors.border,
    backgroundColor: colors.background,
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
  pickerButtonWrapper: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
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
    backgroundColor: colors.secondary,
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
    borderColor: colors.border,
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
  priorityRankText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    marginRight: spacing.xs,
    color: colors.primary,
  },
  headerSpaceBetween: {
    justifyContent: 'space-between',
  },
  headerLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addTagButton: {
    padding: spacing.xs,
  },
  addTagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  newTagColorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'black',
    ...shadows.soft,
  },
  colorEditIcon: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    color: colors.foreground,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
  },
  addTagConfirmButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
