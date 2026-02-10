import { useRef, useEffect } from 'react';
import { isToday, isTomorrow, format } from 'date-fns';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { Reminder } from '../types/reminder';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { BirthdayArt } from './BirthdayArt';

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

  const isBirthday = reminder.title.toLowerCase().includes('birthday');

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
        ]}
      >
        <TouchableOpacity
          style={[
            styles.card,
            reminder.completed && styles.cardCompleted,
            tag && !reminder.completed && {
              backgroundColor: `${tag.color}${isDark ? '15' : '08'}`,
              borderLeftWidth: 1,
              borderLeftColor: tag.color,
              borderRightWidth: 1,
              borderRightColor: tag.color,
              paddingLeft: spacing.md - 4,
              borderBottomWidth: 1,
              borderBottomColor: tag.color,
              borderTopWidth: 1,
              borderTopColor: tag.color,
            },
            isBirthday && !reminder.completed && styles.birthdayCard
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

          {isBirthday && !reminder.completed && <BirthdayArt />}

          <View style={[styles.content, !reminder.time && { alignItems: 'center' }, { backgroundColor: 'transparent' }]}>
            {/* Checkbox */}
            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <Animated.View
                style={[
                  styles.checkbox,
                  reminder.completed && styles.checkboxCompleted,
                  tag && !reminder.completed && { borderColor: tag.color },
                  !reminder.time && { marginTop: 0 },
                  isBirthday && !reminder.completed && styles.birthdayCheckbox,
                  { transform: [{ scale: checkScaleAnim }] },
                ]}
              >
                {reminder.completed && (
                  <Ionicons name="checkmark" size={14} color={colors.successForeground} />
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Text Content */}
            <View style={[styles.textContent, { backgroundColor: 'transparent' }]}>
              <View style={[styles.titleRow, priority && { paddingRight: 24 }, { backgroundColor: 'transparent' }]}>
                <Text
                  style={[
                    styles.title,
                    reminder.completed && styles.titleCompleted,
                    isBirthday && !reminder.completed && styles.birthdayTitle,
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
                {(reminder.time || (reminder.date && isToday(new Date(reminder.date + 'T00:00:00')))) ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={isBirthday && !reminder.completed ? 'rgba(0,0,0,0.6)' : colors.mutedForeground} />
                    <Text style={[styles.metaText, isBirthday && !reminder.completed && styles.birthdayMetaText]}>
                      {reminder.time ? formatTime(reminder.time) : 'Anytime'}
                    </Text>
                  </View>
                ) : null}
                {reminder.date && !isToday(new Date(reminder.date + 'T00:00:00')) && !isTomorrow(new Date(reminder.date + 'T00:00:00')) ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={isBirthday && !reminder.completed ? 'rgba(0,0,0,0.6)' : colors.mutedForeground} />
                    <Text style={[styles.metaText, isBirthday && !reminder.completed && styles.birthdayMetaText]}>
                      {format(new Date(reminder.date + 'T00:00:00'), 'MMM d')}
                    </Text>
                  </View>
                ) : null}
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
  },
  cardCompleted: {
    opacity: 0.6,
    elevation: 0, // Shadows can cause "opaque box" artifacts with transparency on Android
    shadowOpacity: 0,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
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
    fontFamily: typography.fontFamily.title,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
    lineHeight: 24,
    flexShrink: 1,
    fontWeight: '600' as any,
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
    textDecorationLine: Platform.OS === 'ios' ? 'line-through' : 'none',
    color: colors.mutedForeground,
    opacity: Platform.OS === 'android' ? 0.7 : 1,
    lineHeight: Platform.OS === 'android' ? undefined : 24,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
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
    borderRadius: borderRadius.lg,
    marginLeft: spacing.md,
  },
  birthdayCard: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1.5,
  },
  birthdayTitle: {
    color: '#1F2937', // Dark text for legibility on light gradient
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontFamily: typography.fontFamily.bold,
  },
  birthdayCheckbox: {
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  birthdayMetaText: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
});
