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
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { Reminder } from '../types/reminder';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../hooks/useTheme';

interface ReminderCardProps {
  reminder: Reminder;
  onComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete?: (id: string) => void;
  index: number;
}

export function ReminderCard({ reminder, onComplete, onEdit, onDelete, index }: ReminderCardProps) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const checkScaleAnim = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<Swipeable>(null);
  const { tags, priorities } = useSettings();

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

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const tag = tags.find(t => t.id === reminder.tag_id);
  const priority = priorities.find(p => p.id === reminder.priority_id);

  // Render red background with animated trash icon
  // Icon opacity increases as user swipes further, indicating deletion on full swipe
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    // Icon fades in as user swipes (more visible = closer to deletion)
    const iconOpacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });

    const iconScale = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1.2, 0.8, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.deleteBackground}>
        <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
          <Ionicons name="trash-outline" size={28} color="#FFFFFF" />
        </Animated.View>
      </View>
    );
  };
  
  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={100}
      overshootFriction={8}
      onSwipeableWillOpen={(direction) => {
        // Fires when about to fully open - requires deliberate full swipe
        if (direction === 'right') {
          swipeableRef.current?.close();
          onDelete?.(reminder.id);
        }
      }}
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
          style={[
            styles.card,
            tag && !reminder.completed && {
              backgroundColor: `${tag.color}${isDark ? '15' : '08'}`,
              borderLeftWidth: 1,
              borderLeftColor: tag.color,
              borderRightWidth: 1,
              borderRightColor: tag.color,
              paddingLeft: spacing.lg - 4,
              borderBottomWidth: 1,
              borderBottomColor: tag.color,
              borderTopWidth: 1,
              borderTopColor: tag.color,
            }
          ]}
          onPress={() => onEdit(reminder)}
          activeOpacity={0.9}
        >
          {priority && (
            <>
              <View style={[styles.priorityTriangle, { borderTopColor: priority.color }]} />
              <View style={styles.priorityRankContainer}>
                <Text style={styles.priorityRankText}>{priority.rank}</Text>
              </View>
            </>
          )}
          <View style={[styles.content, !reminder.time && { alignItems: 'center' }]}>
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
                  tag && !reminder.completed && { borderColor: tag.color },
                  !reminder.time && { marginTop: 0 },
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
              <View style={[styles.titleRow, priority && { paddingRight: 24 }]}>
                <Text
                  style={[
                    styles.title,
                    reminder.completed && styles.titleCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {reminder.title}
                </Text>
                {tag && (
                  <View style={[styles.tagBadgeSmall, { backgroundColor: tag.color }]} />
                )}
              </View>

              {/* Meta Info */}
              <View style={styles.metaContainer}>
                {reminder.time && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{formatTime(reminder.time)}</Text>
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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
  },
  containerCompleted: {
    opacity: 0.6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  priorityTriangle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 40,
    borderLeftWidth: 40,
    borderLeftColor: 'transparent',
    zIndex: 1,
  },
  priorityRankContainer: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 2,
  },
  priorityRankText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: 'white',
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
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'nowrap',
  },
  tagBadgeSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: 'center',
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
  deleteBackground: {
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: borderRadius.lg,
    marginLeft: spacing.md,
  },
});
