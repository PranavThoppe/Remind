import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { shadows, spacing, borderRadius, typography } from '../../constants/theme';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const DEFAULT_TIMES: Record<TimeOfDay, string> = {
    morning: '09:00',
    afternoon: '14:00',
    evening: '18:00',
    night: '21:00',
};

const TIME_LABELS: Record<TimeOfDay, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
};

export default function CommonTimesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const { settings, updateSettings } = useSettings();

    // Get current times or use defaults
    const currentTimes = {
        morning: settings.commonTimes?.morning || DEFAULT_TIMES.morning,
        afternoon: settings.commonTimes?.afternoon || DEFAULT_TIMES.afternoon,
        evening: settings.commonTimes?.evening || DEFAULT_TIMES.evening,
        night: settings.commonTimes?.night || DEFAULT_TIMES.night,
    };

    const [showTimePicker, setShowTimePicker] = useState<TimeOfDay | null>(null);
    const [tempTime, setTempTime] = useState(new Date());

    const handleTimePress = (timeOfDay: TimeOfDay) => {
        // Parse current time to Date object
        const [hours, minutes] = currentTimes[timeOfDay].split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setTempTime(date);
        setShowTimePicker(timeOfDay);
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(null);
        }

        if (selectedDate && showTimePicker) {
            const timeStr = format(selectedDate, 'HH:mm');
            updateSettings({
                commonTimes: {
                    ...currentTimes,
                    [showTimePicker]: timeStr,
                },
            });

            if (Platform.OS === 'ios') {
                setTempTime(selectedDate);
            }
        }
    };

    const renderTimeCard = (timeOfDay: TimeOfDay) => {
        const [h, m] = currentTimes[timeOfDay].split(':').map(Number);
        const displayDate = new Date();
        displayDate.setHours(h, m);
        const displayTime = format(displayDate, 'h:mm a');

        return (
            <TouchableOpacity
                key={timeOfDay}
                style={styles.timeCard}
                onPress={() => handleTimePress(timeOfDay)}
                activeOpacity={0.7}
            >
                <View style={styles.timeInfo}>
                    <Text style={styles.timeName}>{TIME_LABELS[timeOfDay]}</Text>
                    <Text style={styles.timeValue}>{displayTime}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Common Times',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.foreground,
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -8, padding: 8 }}>
                            <Ionicons name="arrow-back" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                <Text style={styles.description}>
                    Set default times for different parts of the day. These will be used as quick options when adding reminders.
                </Text>

                {(Object.keys(TIME_LABELS) as TimeOfDay[]).map(renderTimeCard)}

                {showTimePicker && (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                        style={Platform.OS === 'ios' ? styles.iosTimePicker : undefined}
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
    content: {
        flex: 1,
        padding: spacing.xl,
    },
    description: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        marginBottom: spacing.xl,
        lineHeight: 20,
    },
    timeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    timeInfo: {
        flex: 1,
    },
    timeName: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.md,
        color: colors.foreground,
        marginBottom: 4,
    },
    timeValue: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.primary,
    },
    iosTimePicker: {
        marginTop: spacing.lg,
    },
});
