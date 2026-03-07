import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CommonTimes } from '../types/settings';
import { rrulestr } from 'rrule';

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
 * @param commonTimes Optional common times array for default logic
 * @returns notification identifier string
 */
export async function scheduleReminderNotification(
  title: string,
  date: string,
  time?: string,
  repeat?: string,
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

      const timesArray = [
        commonTimes.morning,
        commonTimes.afternoon,
        commonTimes.evening,
        commonTimes.night,
      ].sort();

      if (isToday) {
        // Find the next logical common time
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        for (const t of timesArray) {
          const [h, m] = t.split(':').map(Number);
          const timeInMinutes = h * 60 + m;
          if (timeInMinutes > currentTimeInMinutes + 5) { // 5 min buffer
            finalTime = t;
            break;
          }
        }

        // If all common times passed for today, use first one (or default to 09:00)
        if (!finalTime) {
          finalTime = timesArray[0] || '09:00';
        }
      } else {
        // If it's a future date, default to the first common time (usually morning)
        finalTime = timesArray[0] || '09:00';
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

    let isComplexRepeat = false;
    let basicRepeat = 'none';
    if (repeat) {
      if (repeat.includes('INTERVAL=') || repeat.includes('BYDAY=') || repeat.includes('BYMONTH=') || repeat.includes('BYMONTHDAY=')) {
        isComplexRepeat = true;
      } else {
        if (repeat.includes('FREQ=DAILY') || repeat === 'daily') basicRepeat = 'daily';
        else if (repeat.includes('FREQ=WEEKLY') || repeat === 'weekly') basicRepeat = 'weekly';
        else if (repeat.includes('FREQ=MONTHLY') || repeat === 'monthly') basicRepeat = 'monthly';
        else if (repeat.includes('FREQ=YEARLY') || repeat === 'yearly') basicRepeat = 'yearly';
      }
    }

    if (isRepeating && isComplexRepeat) {
      let ruleString = repeat;
      try {
        const dtstart = new Date(Date.UTC(year, month - 1, day, hour, minute));
        const rule = rrulestr(ruleString, { dtstart });

        const now = new Date();
        const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()));

        const sevenDaysFromNowUtc = new Date(nowUtc.getTime() + 7 * 24 * 60 * 60 * 1000);

        const occurrences = rule.between(nowUtc, sevenDaysFromNowUtc, true);

        if (occurrences.length === 0) {
          const nextOccurrence = rule.after(nowUtc, false);
          if (nextOccurrence) occurrences.push(nextOccurrence);
        }

        let firstIdentifier: string | null = null;

        for (const occUtc of occurrences) {
          const occTriggerDate = new Date(occUtc.getUTCFullYear(), occUtc.getUTCMonth(), occUtc.getUTCDate(), occUtc.getUTCHours(), occUtc.getUTCMinutes());
          if (occTriggerDate.getTime() > Date.now()) {
            console.log(`[Notifications] Scheduling complex occurrence: "${title}" at ${occTriggerDate.toLocaleString()}`);
            const identifier = await Notifications.scheduleNotificationAsync({
              content: {
                title: title,
                body: 'Long-press for options',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                categoryIdentifier: 'reminder-snooze-v1',
                data: { title, date, time, repeat, id },
                ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: occTriggerDate,
              }
            });
            if (!firstIdentifier) firstIdentifier = identifier;
          }
        }
        return firstIdentifier;
      } catch (e) {
        console.error('[Notifications] rrule parse error', e);
        return null;
      }
    } else if (isRepeating) {
      // For basic repeating notifications, Expo's CALENDAR trigger handles the "next occurrence" 
      // automatically based on the components provided.
      switch (basicRepeat) {
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
        case 'yearly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            month: triggerDate.getMonth() + 1,
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

    console.log(`[Notifications] Scheduling basic notification: "${title}" at ${triggerDate.toLocaleString()} (Repeat: ${repeat || 'none'})`);

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
/**
 * Cancel notifications for a specific reminder
 * @param reminderId The reminder ID
 */
export async function cancelReminderNotifications(reminderId: string) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(
      (n) => n.content.data?.id === reminderId
    );

    if (toCancel.length > 0) {
      console.log(`[Notifications] Cancelling ${toCancel.length} notification(s) for reminder: ${reminderId}`);
      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Error cancelling reminder notifications:', error);
  }
}

/**
 * Sync notifications with existing reminders
 * @param reminders List of active reminders
 * @param commonTimes Optional common times for default logic
 */
export async function syncNotifications(reminders: any[], commonTimes?: CommonTimes) {
  try {
    console.log('[Notifications] Starting resync of all notifications...');
    await cancelAllNotifications();

    let scheduledCount = 0;
    for (const reminder of reminders) {
      if (!reminder.completed && reminder.date) {
        const id = await scheduleReminderNotification(
          reminder.title,
          reminder.date,
          reminder.time || undefined,
          reminder.repeat || undefined,
          reminder.id,
          commonTimes
        );
        if (id) {
          scheduledCount++;
        }
      }
    }
    console.log(`[Notifications] Sync complete. Scheduled ${scheduledCount} notifications.`);
    return scheduledCount;
  } catch (error) {
    console.error('[Notifications] Error syncing notifications:', error);
    return 0;
  }
}
