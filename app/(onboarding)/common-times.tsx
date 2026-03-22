import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, shadows, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_LABELS: Record<TimeOfDay, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
};

const TIME_ICONS: Record<TimeOfDay, keyof typeof Ionicons.glyphMap> = {
    morning: 'sunny-outline',
    afternoon: 'sunny',
    evening: 'partly-sunny-outline',
    night: 'moon-outline',
};

export default function CommonTimesScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { draft, updateDraft, saveStep } = useOnboarding();
    const { user } = useAuth();

    const [showTimePicker, setShowTimePicker] = useState<TimeOfDay | null>(null);
    const [tempTime, setTempTime] = useState(new Date());

    const handleNext = async () => {
        if (!user) {
            console.warn('[CommonTimes] No active user found!');
            Alert.alert('Not Logged In', 'Could not save common times because no active user session was found.');
            return;
        }

        try {
            console.log(`[CommonTimes] Updating common times for user ${user.id}`);
            const { error } = await supabase
                .from('common_times')
                .upsert({
                    user_id: user.id,
                    morning: format(draft.commonTimes.morning, 'HH:mm'),
                    afternoon: format(draft.commonTimes.afternoon, 'HH:mm'),
                    evening: format(draft.commonTimes.evening, 'HH:mm'),
                    night: format(draft.commonTimes.night, 'HH:mm'),
                }, { onConflict: 'user_id' });

            if (error) {
                console.error('[CommonTimes] Error updating DB:', error);
                Alert.alert('Database Error', 'Failed to save your preferences: ' + error.message);
                return;
            }

            await saveStep(5);
            router.push('/(onboarding)/tags'); // Next step is tags
        } catch (error: any) {
            console.error('[CommonTimes] Unexpected error:', error);
            Alert.alert('Unexpected Error', 'An error occurred while saving: ' + error.message);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)/appearance');
        }
    };

    const handleSkip = () => {
        router.push('/(onboarding)/tags');
    };

    const handleTimePress = (timeOfDay: TimeOfDay) => {
        if (showTimePicker === timeOfDay) {
            setShowTimePicker(null);
            return;
        }
        setTempTime(draft.commonTimes[timeOfDay] || new Date());
        setShowTimePicker(timeOfDay);
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(null);
        }

        if (selectedDate && showTimePicker) {
            updateDraft({
                commonTimes: {
                    ...draft.commonTimes,
                    [showTimePicker]: selectedDate,
                }
            });

            if (Platform.OS === 'ios') {
                setTempTime(selectedDate);
            }
        }
    };

    const renderTimeCard = (timeOfDay: TimeOfDay) => {
        const timeValue = draft.commonTimes[timeOfDay];
        const displayTime = timeValue ? format(timeValue, 'h:mm a') : '--:--';
        const isExpanded = showTimePicker === timeOfDay;

        return (
            <View key={timeOfDay} style={{ marginBottom: spacing.sm }}>
                <TouchableOpacity
                    style={[styles.timeCard, { marginBottom: 0 }]}
                    onPress={() => handleTimePress(timeOfDay)}
                    activeOpacity={0.7}
                >
                    <View style={styles.timeIconContainer}>
                        <Ionicons name={TIME_ICONS[timeOfDay]} size={24} color={colors.primary} />
                    </View>
                    <View style={styles.timeInfo}>
                        <Text style={styles.timeName}>{TIME_LABELS[timeOfDay]}</Text>
                        <Text style={styles.timeValue}>{displayTime}</Text>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                {isExpanded && (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                        style={Platform.OS === 'ios' ? styles.iosTimePicker : undefined}
                    />
                )}
            </View>
        );
    };

    return (
        <OnboardingShell
            currentStep={5}
            totalSteps={8}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            nextLabel="Next"
        >
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Your Daily Rhythm</Text>
                <Text style={styles.subtitle}>
                    Set default times for different parts of the day. These will be used as quick options when creating reminders.
                </Text>

                <View style={styles.cardsContainer}>
                    {(Object.keys(TIME_LABELS) as TimeOfDay[]).map(renderTimeCard)}
                </View>
            </ScrollView>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        marginBottom: spacing['2xl'],
        lineHeight: 20,
    },
    cardsContainer: {
        marginBottom: spacing['3xl'],
    },
    timeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.soft,
    },
    timeIconContainer: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: `${colors.primary}10`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    timeInfo: {
        flex: 1,
    },
    timeName: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
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
        alignSelf: 'center',
    },
});
