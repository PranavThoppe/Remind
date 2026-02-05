import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CommonTimes } from '../types/settings';

/**
 * Request permissions and set up notification handler
 */
export async function initializeNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return false;
  }

  // Set up how to handle notifications when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  await Notifications.setNotificationCategoryAsync('reminder-snooze-v1', [
    {
      identifier: 'complete',
      buttonTitle: '✅ Mark as Complete',
      options: {
        opensAppToForeground: true, // Opens app to update UI state immediately
      },
    },
    {
      identifier: 'snooze-15',
      buttonTitle: '15m',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'snooze-60',
      buttonTitle: '1h',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'snooze-custom',
      buttonTitle: 'Custom Snooze...',
      textInput: {
        submitButtonTitle: 'Snooze',
        placeholder: 'e.g., "30" or "1.5h"',
      },
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
}

/**
 * Schedule a local notification for a reminder
 * @param title The reminder title
 * @param date ISO date string (YYYY-MM-DD)
 * @param time Time string (HH:mm)
 * @param repeat Optional repeat pattern
 * @param id Optional reminder ID for actions
 * @param commonTimes Optional common times for default logic
 * @returns notification identifier string
 */
export async function scheduleReminderNotification(
  title: string,
  date: string,
  time?: string,
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly',
  id?: string,
  commonTimes?: CommonTimes
): Promise<string | null> {
  try {
    const [year, month, day] = date.split('-').map(Number);

    // Determine default time if not provided
    let finalTime = time;
    if (!finalTime && commonTimes) {
      const now = new Date();
      const isToday = now.getFullYear() === year && (now.getMonth() + 1) === month && now.getDate() === day;

      if (isToday) {
        // Find the next logical common time
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const times = [
          { key: 'morning', value: commonTimes.morning },
          { key: 'afternoon', value: commonTimes.afternoon },
          { key: 'evening', value: commonTimes.evening },
          { key: 'night', value: commonTimes.night },
        ];

        for (const t of times) {
          const [h, m] = t.value.split(':').map(Number);
          const timeInMinutes = h * 60 + m;
          if (timeInMinutes > currentTimeInMinutes + 5) { // 5 min buffer
            finalTime = t.value;
            break;
          }
        }

        // If all common times passed for today, or none found, we'll default to 09:00 below
      } else {
        // If it's a future date, default to the user's morning time
        finalTime = commonTimes.morning;
      }
    }

    const timeParts = (finalTime || '09:00').split(':').map(Number);
    const hour = isNaN(timeParts[0]) ? 9 : timeParts[0];
    const minute = isNaN(timeParts[1]) ? 0 : timeParts[1];

    const triggerDate = new Date(year, month - 1, day, hour, minute);

    // Check if date is valid
    if (isNaN(triggerDate.getTime())) {
      console.error('[Notifications] Invalid date/time for notification:', { date, time, year, month, day, hour, minute });
      return null;
    }

    const isRepeating = repeat && repeat !== 'none';
    const isPast = triggerDate.getTime() <= Date.now();

    // For one-time notifications, skip if in the past
    if (!isRepeating && isPast) {
      console.log('[Notifications] Skipping one-time notification for past date/time:', triggerDate.toLocaleString());
      return null;
    }

    let trigger: Notifications.NotificationTriggerInput;

    if (isRepeating) {
      // For repeating notifications, Expo's CALENDAR trigger handles the "next occurrence" 
      // automatically based on the components provided.
      switch (repeat) {
        case 'daily':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
          };
          break;
        case 'weekly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            weekday: triggerDate.getDay() + 1, // 1 is Sunday in expo-notifications
            hour,
            minute,
            repeats: true,
          };
          break;
        case 'monthly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            day: triggerDate.getDate(),
            hour,
            minute,
            repeats: true,
          };
          break;
        default:
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          };
      }
    } else {
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      };
    }

    console.log(`[Notifications] Scheduling notification: "${title}" at ${triggerDate.toLocaleString()} (Repeat: ${repeat || 'none'})`);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: 'Long-press for options',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'reminder-snooze-v1',
        data: {
          title,
          date,
          time,
          repeat,
          id,
        },
        // Explicitly set channelId for Android
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
      trigger,
    });

    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 * @param identifier The notification identifier
 */
export async function cancelNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}
