import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { CommonTimes } from '../../types/settings';

export default function CommonTimesScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { commonTimes, updateCommonTimes } = useSettings();
    const [activePicker, setActivePicker] = useState<keyof CommonTimes | null>(null);

    const styles = createStyles(colors);

    const formatDisplayTime = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setActivePicker(null);
        }

        if (selectedDate && activePicker) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            updateCommonTimes({ [activePicker]: timeString });
        }
    };

    const getPickerDate = () => {
        if (!activePicker) return new Date();
        const [hours, minutes] = commonTimes[activePicker].split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.title}>Common Times</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.descriptionCard}>
                    <Text style={styles.descriptionText}>
                        Define default times for different parts of the day. These will be used for reminders when you don't specify a time.
                    </Text>
                </View>

                <View style={styles.timesContainer}>
                    {(Object.keys(commonTimes) as (keyof CommonTimes)[]).map((key, index) => (
                        <TouchableOpacity
                            key={key}
                            style={[
                                styles.timeRow,
                                index !== 0 && styles.borderTop,
                                activePicker === key && styles.timeRowActive
                            ]}
                            onPress={() => setActivePicker(activePicker === key ? null : key)}
                        >
                            <View style={styles.timeLabelContainer}>
                                <Ionicons
                                    name={
                                        key === 'morning' ? 'sunny-outline' :
                                            key === 'afternoon' ? 'partly-sunny-outline' :
                                                key === 'evening' ? 'moon-outline' : 'cloudy-night-outline'
                                    }
                                    size={22}
                                    color={colors.primary}
                                />
                                <Text style={styles.timeLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                            </View>
                            <Text style={styles.timeValue}>{formatDisplayTime(commonTimes[key])}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activePicker && Platform.OS === 'ios' && (
                    <View style={styles.iosPickerContainer}>
                        <DateTimePicker
                            value={getPickerDate()}
                            mode="time"
                            is24Hour={false}
                            display="spinner"
                            onChange={onTimeChange}
                            textColor={colors.foreground}
                            themeVariant={isDark ? 'dark' : 'light'}
                        />
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => setActivePicker(null)}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                        value={getPickerDate()}
                        mode="time"
                        is24Hour={false}
                        display="default"
                        onChange={onTimeChange}
                    />
                )}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    title: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.xl,
        color: colors.foreground,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 40,
    },
    descriptionCard: {
        backgroundColor: `${colors.primary}10`,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: `${colors.primary}20`,
    },
    descriptionText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        lineHeight: 20,
        textAlign: 'center',
    },
    timesContainer: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        ...shadows.card,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.xl,
        borderBottomWidth: 0, // Handled by borderTop for and check index
    },
    borderTop: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    timeRowActive: {
        backgroundColor: `${colors.primary}05`,
    },
    timeLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    timeLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.lg,
        color: colors.foreground,
    },
    timeValue: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.lg,
        color: colors.primary,
    },
    iosPickerContainer: {
        marginTop: spacing.xl,
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        ...shadows.card,
    },
    doneButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    doneButtonText: {
        fontFamily: typography.fontFamily.semibold,
        color: 'white',
        fontSize: typography.fontSize.base,
    },
});
