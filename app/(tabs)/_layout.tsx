import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, typography } from '../../constants/theme';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
};

function TabIcon({ name, focused }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={name}
        size={focused ? 26 : 24}
        color={focused ? colors.primary : colors.mutedForeground}
        style={focused ? styles.iconActive : undefined}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="completed"
        options={{
          title: 'Done',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    ...Platform.select({
      ios: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      },
    }),
  },
  tabBarLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    marginTop: 2,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    transform: [{ scale: 1.1 }],
  },
});
