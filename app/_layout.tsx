import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PoiretOne_400Regular } from '@expo-google-fonts/poiret-one';
import { DMSerifText_400Regular } from '@expo-google-fonts/dm-serif-text';
import { useTheme } from '../hooks/useTheme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RemindersProvider, useRemindersContext } from '../contexts/RemindersContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { UIProvider } from '../contexts/UIContext';
import { initializeNotifications, scheduleReminderNotification, BACKGROUND_NOTIFICATION_TASK } from '../lib/notifications';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { format, addMinutes } from 'date-fns';
import { handleCompleteBackground } from '../lib/reminders';

// Define the background task for handling headless notifications
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.error('[TaskManager] Background notification task error:', error);
    return;
  }
  if (data) {
    const { actionIdentifier, notification, userText } = data as any;
    const { title, id } = notification?.request?.content?.data || {};

    console.log('[TaskManager] Background Action:', actionIdentifier, 'Reminder ID:', id);

    if (actionIdentifier === 'complete' && id) {
      await handleCompleteBackground(id, title);
    } else if (actionIdentifier?.startsWith('snooze-')) {
      if (!title) {
        console.error('[TaskManager] Cannot snooze: Title is missing from notification data');
        return;
      }

      let minutes = 60; // Default 1 hour

      if (actionIdentifier === 'snooze-15') {
        minutes = 15;
      } else if (actionIdentifier === 'snooze-60') {
        minutes = 60;
      } else if (actionIdentifier === 'snooze-custom') {
        const text = userText;
        if (text) {
          const lowerText = text.toLowerCase().trim();

          // Handle "tomorrow" or "tmw"
          if (lowerText.includes('tomorrow') || lowerText.includes('tmw')) {
            minutes = 24 * 60; // 24 hours
          }
          // Try parsing "1.5h" or "2h"
          else if (lowerText.includes('h')) {
            const hours = parseFloat(lowerText.replace('h', ''));
            if (!isNaN(hours)) {
              minutes = Math.round(hours * 60);
            }
          } else {
            // Try parsing straight number as minutes
            const parsed = parseInt(lowerText, 10);
            if (!isNaN(parsed) && parsed > 0) {
              minutes = parsed;
            } else {
              minutes = 60;
              console.log(`[TaskManager] Invalid input "${text}", defaulting to 60m`);
            }
          }
        }
      }

      const now = new Date();
      const snoozeDate = addMinutes(now, minutes);

      const newDate = format(snoozeDate, 'yyyy-MM-dd');
      const newTime = format(snoozeDate, 'HH:mm');

      await scheduleReminderNotification(title, newDate, newTime, 'none', id);
      console.log(`[TaskManager] Snoozed "${title}" for ${minutes} minutes`);
    }
  }
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function NotificationHandler() {
  const { toggleComplete } = useRemindersContext();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionId = response.actionIdentifier;
      // Explicitly type the notification data
      const data = response.notification.request.content.data as { title?: string; id?: string };
      const { title, id } = data;

      console.log('--- Notification Action ---');
      console.log('Action:', actionId);
      console.log('Reminder ID:', id);

      if (actionId === 'complete' && id) {
        console.log(`Attempting to mark "${title || 'Unknown'}" as complete...`);

        // toggleComplete now handles its own session check inside
        const result = await toggleComplete(id, false);
        if (result.error) {
          console.error('Failed to mark as complete. Full Error:', JSON.stringify(result.error, null, 2));
        } else {
          console.log(`Successfully marked "${title || 'Unknown'}" as complete`);
        }
      } else if (actionId?.startsWith('snooze-')) {
        if (!title) {
          console.error('Cannot snooze: Title is missing from notification data');
          return;
        }

        let minutes = 60; // Default 1 hour

        if (actionId === 'snooze-15') {
          minutes = 15;
        } else if (actionId === 'snooze-60') {
          minutes = 60;
        } else if (actionId === 'snooze-custom') {
          const text = (response as any).userText;
          if (text) {
            const lowerText = text.toLowerCase().trim();

            // Handle "tomorrow" or "tmw"
            if (lowerText.includes('tomorrow') || lowerText.includes('tmw')) {
              minutes = 24 * 60; // 24 hours
            }
            // Try parsing "1.5h" or "2h"
            else if (lowerText.includes('h')) {
              const hours = parseFloat(lowerText.replace('h', ''));
              if (!isNaN(hours)) {
                minutes = Math.round(hours * 60);
              }
            } else {
              // Try parsing straight number as minutes
              const parsed = parseInt(lowerText, 10);
              if (!isNaN(parsed) && parsed > 0) {
                minutes = parsed;
              } else {
                // Potential Error Solution: If input is invalid (e.g. "hi"), 
                // default to 60m so the reminder isn't lost.
                minutes = 60;
                console.log(`[NotificationHandler] Invalid input "${text}", defaulting to 60m`);
              }
            }
          }
        }

        const now = new Date();
        const snoozeDate = addMinutes(now, minutes);

        const newDate = format(snoozeDate, 'yyyy-MM-dd');
        const newTime = format(snoozeDate, 'HH:mm');

        await scheduleReminderNotification(title, newDate, newTime, 'none');
        console.log(`Snoozed "${title}" for ${minutes} minutes`);
      }
    });

    return () => subscription.remove();
  }, [toggleComplete]);

  return null;
}


function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = segments[0] === undefined || segments[0] === 'index';
    const isOnboardingRoute = segments[0] === '(onboarding)';

    if (!user && !isPublicRoute) {
      // Redirect to the sign-in page if user is not authenticated and trying to access a private route
      router.replace('/');
    } else if (user) {
      // User is authenticated, check if they need to onboard
      // CRITICAL: If profile is not yet loaded, we wait (handled by loading check above)
      // If profile is missing (null) or has_onboarded is false, they need onboarding
      if (!profile || !profile.has_onboarded) {
        if (!isOnboardingRoute) {
          console.log('[AuthGuard] Profile is missing or not onboarded, redirecting to onboarding');
          router.replace('/(onboarding)');
        }
      } else {
        // User has the profile and has already onboarded
        if (isPublicRoute || isOnboardingRoute) {
          console.log('[AuthGuard] User has already onboarded, redirecting to tabs');
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, profile, loading, segments]);

  if (loading) {
    return null;
  }

  return <>{children}</>;
}


function RootContent() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PoiretOne_400Regular,
    DMSerifText_400Regular,
  });

  useEffect(() => {
    if (fontError) {
      console.error('Error loading fonts:', fontError);
    }
  }, [fontError]);

  useEffect(() => {
    initializeNotifications().catch(console.error);

    try {
      // Platform-specific setup can go here if needed in the future
    } catch (e) {
      console.error('❌ Setup error:', e);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <NotificationHandler />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SettingsProvider>
          <AuthGuard>
            <UIProvider>
              <RemindersProvider>
                <RootContent />
              </RemindersProvider>
            </UIProvider>
          </AuthGuard>
        </SettingsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
});
