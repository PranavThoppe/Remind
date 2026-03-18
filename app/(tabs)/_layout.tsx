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

import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadows, typography, spacing } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useReminders } from '../../hooks/useReminders';
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { EditReminderSheet } from '../../components/EditReminderSheet';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  colors: any;
};

function TabIcon({ name, focused, colors }: TabIconProps) {
  const styles = createStyles(colors);
  return (
    <View style={[styles.iconContainer, !focused && { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? colors.primaryForeground : colors.mutedForeground}
      />
    </View>
  );
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { isAddSheetOpen, closeAddSheet, editingReminder, editSourceLayout, closeEditSheet, setIsAiChatOpen } = useUI();
  const { addReminder, updateReminder } = useReminders();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const handleSave = async (data: any) => {
    if (editingReminder) {
      return await updateReminder(editingReminder.id, data);
    } else {
      return await addReminder(data);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MaterialTopTabs
        tabBarPosition="bottom"
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarIndicator: () => null,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarItemStyle: {
            height: 60,
          },
          tabBarContentContainerStyle: {
            height: 60,
          },
          tabBarShowIcon: true,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontFamily: typography.fontFamily.medium,
            fontSize: 10,
            textTransform: 'none',
            marginTop: -4,
          },
          swipeEnabled: true,
          animationEnabled: true,
        }}
      >
        <MaterialTopTabs.Screen
          name="index"
          options={{
            title: 'List',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'list' : 'list-outline'} focused={focused} colors={colors} />
            ),
          }}
        />
        <MaterialTopTabs.Screen
          name="week"
          options={{
            title: 'Week',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} colors={colors} />
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
      </MaterialTopTabs>

      {/* Global UI Components */}
      {!editSourceLayout && !editingReminder && (
        <FloatingAddButton
          onExpandedChange={setIsAiChatOpen}
        />
      )}

      <AddReminderSheet
        isOpen={isAddSheetOpen}
        onClose={closeAddSheet}
        onSave={handleSave}
      />

      <EditReminderSheet
        reminder={editSourceLayout ? editingReminder : null}
        sourceLayout={editSourceLayout}
        onClose={closeEditSheet}
        onSave={handleSave}
      />
    </View>
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
