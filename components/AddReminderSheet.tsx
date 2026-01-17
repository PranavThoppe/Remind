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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, shadows, spacing, borderRadius, typography } from '../constants/theme';
import { Reminder } from '../types/reminder';

interface AddReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'completed'>) => void;
  editReminder?: Reminder | null;
}

const timeOptions = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (editReminder) {
      setTitle(editReminder.title);
      setDate(editReminder.date);
      setTime(editReminder.time || '');
      setRepeat(editReminder.repeat || 'none');
    } else {
      setTitle('');
      setDate(undefined);
      setTime('');
      setRepeat('none');
    }
  }, [editReminder, isOpen]);

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

  const handleSave = () => {
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      date,
      time: time || undefined,
      repeat,
    });

    setTitle('');
    setDate(undefined);
    setTime('');
    setRepeat('none');
    onClose();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDate = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
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
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
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
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <TextInput
            style={styles.input}
            placeholder="What do you need to remember?"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          {/* Date & Time Row */}
          <View style={styles.dateTimeRow}>
            {/* Date Picker */}
            <TouchableOpacity
              style={[
                styles.pickerButton,
                date && styles.pickerButtonActive,
              ]}
              onPress={() => setShowDatePicker(true)}
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
              onPress={() => setShowTimePicker(!showTimePicker)}
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
                {time || 'Add time'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Options */}
          {showTimePicker && (
            <View style={styles.timeOptionsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {timeOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeOption,
                      time === t && styles.timeOptionActive,
                    ]}
                    onPress={() => {
                      setTime(t);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      time === t && styles.timeOptionTextActive,
                    ]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Date Picker Modal (Android shows inline) */}
          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
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
                  onPress={() => setRepeat(option.value)}
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
  timeOptionsContainer: {
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  timeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
  },
  timeOptionActive: {
    backgroundColor: colors.primary,
  },
  timeOptionText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
  },
  timeOptionTextActive: {
    color: colors.primaryForeground,
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
});
