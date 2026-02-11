import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
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
import { initializeNotifications, scheduleReminderNotification } from '../lib/notifications';
import * as Notifications from 'expo-notifications';
import { format, addMinutes } from 'date-fns';

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

// Must match the entitlement identifier in the RevenueCat dashboard exactly
const PRO_ENTITLEMENT_ID = 'AI Reminders';

/**
 * Identifies the Supabase user to RevenueCat and syncs pro status on startup.
 * Fixes: purchases not appearing in RC customers dashboard, and
 * pro status getting out of sync if a DB update fails during purchase.
 */
function RevenueCatSync() {
  const { user, profile, refreshProfile } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;

    async function syncRevenueCat() {
      try {
        // Identify the user to RevenueCat so purchases are tied to their Supabase ID
        console.log('🔗 RevenueCat: Logging in user', user!.id);
        const { customerInfo } = await Purchases.logIn(user!.id);
        console.log('✅ RevenueCat: logIn() completed');
        console.log('📦 Active entitlements:', Object.keys(customerInfo.entitlements.active));

        // Sync: if RC says the user has pro but the DB doesn't, fix the DB
        const hasEntitlement = !!customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
        if (hasEntitlement && profile?.pro !== true) {
          console.log('🔄 Syncing pro status: RC has entitlement but DB is false, updating...');
          await supabase.from('profiles').update({ pro: true }).eq('id', user!.id);
          await refreshProfile();
          console.log('✅ Pro status synced to true');
        }

        synced.current = true;
      } catch (e) {
        console.error('❌ RevenueCat sync error:', e);
      }
    }

    syncRevenueCat();
  }, [user, profile]);

  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = segments[0] === undefined || segments[0] === 'index';

    if (!user && !isPublicRoute) {
      // Redirect to the sign-in page if user is not authenticated and trying to access a private route
      router.replace('/');
    } else if (user && isPublicRoute) {
      // Redirect to the home page if user is authenticated and trying to access an auth screen
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments]);

  if (loading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
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
      if (__DEV__) {
        console.log('🔑 RevenueCat: Configuring with TEST STORE key');
        Purchases.configure({ apiKey: 'test_UbGQugWUgtBPAUSpqblBSZWCWIX' });
      } else if (Platform.OS === 'ios') {
        console.log('🔑 RevenueCat: Configuring with iOS key');
        Purchases.configure({ apiKey: 'appl_PejDVLLTYLtWtqVbrjbEQzPqDUr' });
      } else if (Platform.OS === 'android') {
        console.log('🔑 RevenueCat: Configuring with Android key');
        Purchases.configure({ apiKey: 'goog_SOhwxVOHyeCjxadVfIrITqTHMrd' });
      }
      console.log('✅ RevenueCat: configure() completed');
    } catch (e) {
      console.error('❌ RevenueCat: configure() FAILED:', e);
    }
  }, []);

  if (!fontsLoaded && !fontError) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NotificationHandler />
      <RevenueCatSync />
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
            <RemindersProvider>
              <RootContent />
            </RemindersProvider>
          </AuthGuard>
        </SettingsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
