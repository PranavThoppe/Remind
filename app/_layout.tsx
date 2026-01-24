import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RemindersProvider, useRemindersContext } from '../contexts/RemindersContext';
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
      } else if (actionId === 'snooze-30' || actionId === 'snooze-60') {
        if (!title) {
          console.error('Cannot snooze: Title is missing from notification data');
          return;
        }

        const minutes = actionId === 'snooze-30' ? 30 : 60;
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
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!user && inAuthGroup) {
      // Redirect to the sign-in page if user is not authenticated and trying to access tabs
      router.replace('/');
    } else if (user && !inAuthGroup) {
      // Redirect to the home page if user is authenticated and trying to access auth screens
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.error('Error loading fonts:', fontError);
    }
  }, [fontError]);

  useEffect(() => {
    initializeNotifications().catch(console.error);
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthGuard>
          <RemindersProvider>
            <NotificationHandler />
            <StatusBar style="dark" />
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
          </RemindersProvider>
        </AuthGuard>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
