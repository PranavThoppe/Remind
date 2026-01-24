import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

  // Define notification categories for actions
  await Notifications.setNotificationCategoryAsync('reminder-actions', [
    {
      identifier: 'complete',
      buttonTitle: '✅ Mark as Complete',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'snooze-30',
      buttonTitle: '⏳ Snooze 30 Min',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'snooze-60',
      buttonTitle: '⏳ Snooze 1 Hour',
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
 * @returns notification identifier string
 */
export async function scheduleReminderNotification(
  title: string,
  date: string,
  time?: string,
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly',
  id?: string
): Promise<string | null> {
  try {
    const triggerDate = new Date(`${date}T${time || '09:00'}:00`);
    
    // If the time is in the past, don't schedule
    if (triggerDate.getTime() <= Date.now()) {
      console.log('Skipping notification for past date/time');
      return null;
    }

    let trigger: Notifications.NotificationTriggerInput;

    if (repeat && repeat !== 'none') {
      switch (repeat) {
        case 'daily':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: triggerDate.getHours(),
            minute: triggerDate.getMinutes(),
            repeats: true,
          };
          break;
        case 'weekly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            weekday: triggerDate.getDay() + 1, // 1 is Sunday in expo-notifications
            hour: triggerDate.getHours(),
            minute: triggerDate.getMinutes(),
            repeats: true,
          };
          break;
        case 'monthly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            day: triggerDate.getDate(),
            hour: triggerDate.getHours(),
            minute: triggerDate.getMinutes(),
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

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: 'Long-press for options',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'reminder-actions',
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
