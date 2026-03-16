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
          display: 'none',
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
        swipeEnabled: false,
        animationEnabled: true,
      }}
    >
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
    </MaterialTopTabs>
  );
}

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
