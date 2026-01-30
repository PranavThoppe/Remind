import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadows, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

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
        size={focused ? 26 : 24}
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
        name="ai-chat"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} colors={colors} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
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
    elevation: 0,
    shadowOpacity: 0,
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
