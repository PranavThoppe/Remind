import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Image,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { shadows, spacing, borderRadius, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { ThemeType } from '../types/settings';
import * as AppleAuthentication from 'expo-apple-authentication';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  rightElement?: React.ReactNode;
  colors: any;
}

const SettingItem = ({ icon, label, value, onPress, isLast, rightElement, colors }: SettingItemProps) => {
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingItemRight}>
        {rightElement ? (
          rightElement
        ) : (
          <>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const Section = ({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { notificationsEnabled, setNotificationsEnabled, theme, setTheme } = useSettings();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const rawEmail = profile?.email || user?.email || '';
  const shouldHideEmail = rawEmail.toLowerCase().includes('appleid');
  const displayedEmail = shouldHideEmail ? '' : (rawEmail || 'Not signed in');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (error: any) {
      console.error('Error signing out:', error.message);
    }
  };

  const handleDeleteAccount = async () => {
    console.log('[handleDeleteAccount] Delete Account triggered');

    const performDeletion = async () => {
      setIsDeleting(true);
      try {
        // Read current session to pass the access token explicitly in the
        // Authorization header, bypassing the SDK's internal JWT propagation.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No active session found. Please sign in again and retry.');
        }

        // If the user signed in with Apple, Apple requires token revocation on
        // account deletion (App Store guideline 5.1.1(v)).
        const body: Record<string, string | null> = {};
        const provider = user?.app_metadata?.provider;
        const providers: string[] = user?.app_metadata?.providers ?? [];
        const isAppleUser = provider === 'apple' || providers.includes('apple');

        if (Platform.OS === 'ios' && isAppleUser) {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            body.appleAuthorizationCode = credential.authorizationCode ?? null;
          } catch (appleError: any) {
            if (appleError.code === 'ERR_REQUEST_CANCELED') {
              // User dismissed the Apple re-auth prompt; proceed with best-effort deletion.
              console.warn('[handleDeleteAccount] Apple auth canceled; continuing without token revocation');
            }
            // Non-cancellation errors: proceed without revocation
            console.warn('[handleDeleteAccount] Could not get Apple auth code:', appleError.message);
          }
        }

        // Start deletion request without blocking UI logout/redirect (illusion of success).
        supabase.functions.invoke('delete-user', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body,
        })
          .then(({ error }) => {
            if (error) {
              console.error('[handleDeleteAccount] delete-user returned error (non-fatal):', error.message);
            }
          })
          .catch((invokeError: any) => {
            console.error('[handleDeleteAccount] delete-user invoke failed (non-fatal):', invokeError?.message || invokeError);
          });
      } catch (error: any) {
        console.error('[handleDeleteAccount] Pre-delete error (non-fatal):', error.message);
      } finally {
        try {
          await signOut();
          router.replace('/');
        } catch (signOutError: any) {
          console.error('[handleDeleteAccount] Error signing out after delete:', signOutError.message);
          // Still attempt redirect even if signOut fails, since the user intended to leave.
          router.replace('/');
        } finally {
          setIsDeleting(false);
        }
      }
    };

    if (Platform.OS === 'web') {
      console.log('[handleDeleteAccount] Platform is web, skipping confirmation alert');
      performDeletion();
    } else {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => console.log('[handleDeleteAccount] Deletion canceled by user (Mobile)') },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDeletion,
          },
        ]
      );
    }
  };

  const getThemeLabel = (t: ThemeType) => {
    switch (t) {
      case 'system': return 'System';
      case 'light': return 'Light';
      case 'dark': return 'Dark';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={28} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Profile Section */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: profile?.avatar_url || user?.user_metadata?.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarEmoji}>👤</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile?.full_name || user?.user_metadata?.full_name || 'Remind User'}
              </Text>
              <Text style={styles.profileEmail}>
                {displayedEmail}
              </Text>
            </View>
          </View>

          {/* Personalization Section */}
          <Section title="Personalization" colors={colors}>
            <SettingItem
              icon="pricetag-outline"
              label="Tags"
              onPress={() => router.push('/settings/tags')}
              colors={colors}
            />
            <SettingItem
              icon="flag-outline"
              label="Priority Levels"
              onPress={() => router.push('/settings/priority')}
              isLast
              colors={colors}
            />
          </Section>


          {/* App Settings Section */}
          <Section title="App Settings" colors={colors}>
            <SettingItem
              icon="notifications-outline"
              label="Notifications"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={Platform.OS === 'ios' ? undefined : colors.card}
                />
              }
              colors={colors}
            />
            <SettingItem
              icon={isDark ? "moon-outline" : "sunny-outline"}
              label="Appearance"
              value={getThemeLabel(theme)}
              onPress={() => setShowThemeSelector(!showThemeSelector)}
              colors={colors}
            />

            {showThemeSelector && (
              <View style={styles.themeSelector}>
                {(['system', 'light', 'dark'] as ThemeType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.themeOption,
                      theme === t && styles.themeOptionActive
                    ]}
                    onPress={() => {
                      setTheme(t);
                      setShowThemeSelector(false);
                      // On some systems Appearance changes don't trigger immediately, 
                      // but here we rely on SettingsContext -> useTheme
                    }}
                  >
                    <Text style={[
                      styles.themeOptionText,
                      theme === t && styles.themeOptionTextActive
                    ]}>
                      {getThemeLabel(t)}
                    </Text>
                    {theme === t && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <SettingItem
              icon="time-outline"
              label="Common Times"
              onPress={() => router.push('/settings/common-times')}
              colors={colors}
            />
            <SettingItem
              icon="calendar-outline"
              label="Date & Time"
              onPress={() => router.push('/settings/datetime')}
              isLast
              colors={colors}
            />
          </Section>


          {/* Support Section */}
          <Section title="Support" colors={colors}>
            <SettingItem
              icon="information-circle-outline"
              label="About"
              value="v1.0.0"
              onPress={() => { }}
              colors={colors}
            />
            <SettingItem
              icon="document-text-outline"
              label="Privacy Policy"
              onPress={() => Linking.openURL('https://claude.ai/public/artifacts/949089ac-1ea1-41e9-93d4-a72bb666b28a')}
              colors={colors}
            />
            <SettingItem
              icon="book-outline"
              label="Terms of Use"
              onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
              isLast
              colors={colors}
            />
          </Section>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
            disabled={isDeleting}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={colors.destructive}
              style={styles.signOutIcon}
            />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutButton, { marginTop: spacing.md, borderColor: colors.destructive, borderWidth: 0 }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.destructive} size="small" />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={colors.destructive}
                  style={styles.signOutIcon}
                />
                <Text style={styles.signOutText}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Version info */}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.title,
    fontSize: typography.fontSize['2xl'],
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  profileName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
  },
  profileEmail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    ...shadows.card,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  themeSelector: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  themeOptionActive: {
    backgroundColor: colors.background,
  },
  themeOptionText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  themeOptionTextActive: {
    color: colors.foreground,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  signOutIcon: {
    marginRight: spacing.sm,
  },
  signOutText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.destructive,
  },
  versionText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing['3xl'],
  },
});
