import { useEffect } from 'react';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

import { View, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadows, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  colors: any;
};

function TabIcon({ name, focused, colors }: TabIconProps) {
  const styles = createStyles(colors);
  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={name}
        size={22}
        color={colors.primaryForeground}
      />
    </View>
  );
}

function ProfileAvatar({ focused, colors }: { focused: boolean; colors: any }) {
  const { user, profile } = useAuth();
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <View style={createAvatarContainerStyle(colors)}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={createAvatarImageStyle(colors)}
        />
      ) : (
        <Ionicons
          name="person"
          size={18}
          color={colors.primaryForeground}
        />
      )}
    </View>
  );
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarIndicator: () => null,
        tabBarLabel: () => null,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 40 + insets.bottom,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        },
        tabBarItemStyle: {
          height: 40,
        },
        tabBarContentContainerStyle: {
          height: 40 + insets.bottom,
          paddingBottom: insets.bottom / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarShowIcon: true,
        tabBarShowLabel: false,
        swipeEnabled: true,
        animationEnabled: true,
      }}
    >
      <MaterialTopTabs.Screen
        name="ai-chat"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} colors={colors} />
          ),
          tabBarLabel: () => null,
        }}
      />
      <MaterialTopTabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} colors={colors} />
          ),
          tabBarLabel: () => null,
        }}
      />
      <MaterialTopTabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <ProfileAvatar focused={focused} colors={colors} />
          ),
          tabBarLabel: () => null,
        }}
      />
    </MaterialTopTabs>
  );
}

const createAvatarContainerStyle = (colors: any) => ({
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.primary,
  overflow: 'hidden' as const,
  ...shadows.soft,
});

const createAvatarImageStyle = (colors: any) => ({
  width: 32,
  height: 32,
  borderRadius: 16,
  borderWidth: 2,
  borderColor: colors.primary,
});

const createStyles = (colors: any) => StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
});
