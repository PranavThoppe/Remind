import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, shadows, spacing, borderRadius, typography } from '../constants/theme';
import { Reminder } from '../types/reminder';

interface ReminderCardProps {
  reminder: Reminder;
  onComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete?: (id: string) => void;
  index: number;
}

export function ReminderCard({ reminder, onComplete, onEdit, onDelete, index }: ReminderCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const checkScaleAnim = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<Swipeable>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  const handleComplete = () => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(checkScaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(checkScaleAnim, {
        toValue: 1.1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(checkScaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      onComplete(reminder.id);
    }, 200);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getRepeatLabel = (repeat: string) => {
    switch (repeat) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return '';
    }
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        onPress={() => {
          swipeableRef.current?.close();
          onDelete?.(reminder.id);
        }}
        style={styles.deleteAction}
        activeOpacity={0.7}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={24} color={colors.background} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
          reminder.completed && styles.containerCompleted,
        ]}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => onEdit(reminder)}
          activeOpacity={0.9}
        >
          <View style={styles.content}>
            {/* Checkbox */}
            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Animated.View
                style={[
                  styles.checkbox,
                  reminder.completed && styles.checkboxCompleted,
                  { transform: [{ scale: checkScaleAnim }] },
                ]}
              >
                {reminder.completed && (
                  <Ionicons name="checkmark" size={14} color={colors.successForeground} strokeWidth={3} />
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Text Content */}
            <View style={styles.textContent}>
              <Text
                style={[
                  styles.title,
                  reminder.completed && styles.titleCompleted,
                ]}
              >
                {reminder.title}
              </Text>

              {/* Meta Info */}
              <View style={styles.metaContainer}>
                {reminder.date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{formatDate(reminder.date)}</Text>
                  </View>
                )}
                {reminder.time && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{formatTime(reminder.time)}</Text>
                  </View>
                )}
                {reminder.repeat && reminder.repeat !== 'none' && (
                  <View style={styles.metaItem}>
                    <Ionicons name="repeat" size={14} color={colors.primary} />
                    <Text style={[styles.metaText, styles.metaTextPrimary]}>
                      {getRepeatLabel(reminder.repeat)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
  },
  containerCompleted: {
    opacity: 0.6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: `${colors.mutedForeground}30`,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
    lineHeight: 22,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.mutedForeground,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
  },
  metaTextPrimary: {
    color: colors.primary,
  },
  deleteAction: {
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: borderRadius.lg,
    marginLeft: spacing.md,
  },
});
