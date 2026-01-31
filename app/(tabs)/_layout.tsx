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

import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadows, typography } from '../../constants/theme';

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
        size={focused ? 24 : 22}
        color={focused ? colors.primary : colors.mutedForeground}
        style={focused ? styles.iconActive : undefined}
      />
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3, top: 0 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontSize: 10, textTransform: 'none', fontFamily: typography.fontFamily.medium, marginTop: 0 },
        tabBarShowIcon: true,
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
        }}
      />
      <MaterialTopTabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
    </MaterialTopTabs>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    // transform: [{ scale: 1.1 }],
  },
});
