import React from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import CalendarView from '../../components/CalendarView';
import { useTheme } from '../../hooks/useTheme';
import { StatusBar } from 'expo-status-bar';

export default function CalendarScreen() {
    const { colors, isDark } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <CalendarView />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
