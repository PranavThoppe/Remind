import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const FREQUENCIES = [
    { label: 'Daily', value: 'DAILY' },
    { label: 'Weekly', value: 'WEEKLY' },
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Yearly', value: 'YEARLY' },
];

const DAYS_OF_WEEK = [
    { label: 'S', value: 'SU' },
    { label: 'M', value: 'MO' },
    { label: 'T', value: 'TU' },
    { label: 'W', value: 'WE' },
    { label: 'T', value: 'TH' },
    { label: 'F', value: 'FR' },
    { label: 'S', value: 'SA' },
];

interface InlineRepeatPickerProps {
    initialRepeat?: string | null;
    reminderDate?: string | null;
    onConfirm: (rrule: string | 'none') => void;
    onCancel: () => void;
}

const parseRRule = (rrule?: string | null) => {
    let freq = 'DAILY';
    let interval = 1;
    let byDay: string[] = [];

    if (!rrule || rrule === 'none') return { freq, interval, byDay };

    const parts = rrule.split(';');
    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key === 'FREQ') freq = value;
        if (key === 'INTERVAL') interval = parseInt(value, 10) || 1;
        if (key === 'BYDAY') byDay = value.split(',');
    });

    return { freq, interval, byDay };
};

const formatRRule = (freq: string, interval: number, byDay: string[]) => {
    let rrule = `FREQ=${freq}`;
    if (interval > 1) {
        rrule += `;INTERVAL=${interval}`;
    }
    if (freq === 'WEEKLY' && byDay.length > 0) {
        rrule += `;BYDAY=${byDay.join(',')}`;
    }
    return rrule;
};

export function InlineRepeatPicker({ initialRepeat, reminderDate, onConfirm, onCancel }: InlineRepeatPickerProps) {
    const { colors } = useTheme();
    const initialValues = parseRRule(initialRepeat);

    const [frequency, setFrequency] = useState(initialValues.freq);
    const [interval, setIntervalVal] = useState(initialValues.interval);
    const [byDay, setByDay] = useState<string[]>(initialValues.byDay);

    React.useEffect(() => {
        if (frequency === 'WEEKLY' && byDay.length === 0) {
            const dateToUse = reminderDate ? new Date(reminderDate + 'T00:00:00') : new Date();
            const dayIndex = dateToUse.getDay();
            const dayValue = DAYS_OF_WEEK[dayIndex].value;
            setByDay([dayValue]);
        }
    }, [frequency, reminderDate, byDay.length]);

    const toggleDay = (dayValue: string) => {
        setByDay(prev =>
            prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue]
        );
    }; const handleConfirm = () => {
        onConfirm(formatRRule(frequency, interval, byDay));
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="repeat" size={16} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.foreground }]}>Repeat Schedule</Text>
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
                {/* Frequency Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frequencyRow}>
                    {FREQUENCIES.map(freq => (
                        <TouchableOpacity
                            key={freq.value}
                            style={[
                                styles.frequencyChip,
                                {
                                    backgroundColor: frequency === freq.value ? colors.primary : colors.muted,
                                    borderColor: colors.border,
                                }
                            ]}
                            onPress={() => setFrequency(freq.value)}
                        >
                            <Text style={[
                                styles.frequencyText,
                                { color: frequency === freq.value ? colors.primaryForeground : colors.mutedForeground }
                            ]}>
                                {freq.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Interval Slider */}
                <View style={[styles.intervalSection, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                    <View style={styles.sliderLabelContainer}>
                        <Text style={[styles.sliderPrefixText, { color: colors.mutedForeground }]}>EVERY</Text>
                        <Text style={[styles.sliderValueText, { color: colors.foreground }]}>{interval}</Text>
                        <Text style={[styles.sliderSuffixText, { color: colors.mutedForeground }]}>
                            {frequency === 'DAILY' ? (interval === 1 ? 'DAY' : 'DAYS') :
                                frequency === 'WEEKLY' ? (interval === 1 ? 'WEEK' : 'WEEKS') :
                                    frequency === 'MONTHLY' ? (interval === 1 ? 'MONTH' : 'MONTHS') :
                                        (interval === 1 ? 'YEAR' : 'YEARS')}
                        </Text>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={30}
                        step={1}
                        value={interval}
                        onValueChange={setIntervalVal}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.primary}
                    />
                </View>

                {/* Days of Week (Only for Weekly) */}
                {frequency === 'WEEKLY' && (
                    <View style={styles.daysRow}>
                        {DAYS_OF_WEEK.map((day, index) => {
                            const isSelected = byDay.includes(day.value);
                            return (
                                <TouchableOpacity
                                    key={`${day.value}-${index}`}
                                    style={[
                                        styles.dayCircle,
                                        {
                                            backgroundColor: isSelected ? colors.primary : colors.muted,
                                            borderColor: colors.border,
                                        }
                                    ]}
                                    onPress={() => toggleDay(day.value)}
                                >
                                    <Text style={[
                                        styles.dayText,
                                        { color: isSelected ? colors.primaryForeground : colors.mutedForeground }
                                    ]}>
                                        {day.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            <View style={styles.bottomButtonsRow}>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary, flex: 1 }]}
                    onPress={handleConfirm}
                >
                    <Ionicons name="checkmark" size={24} color={colors.primaryForeground} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        marginTop: spacing.sm,
        ...shadows.soft,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize.lg,
    },
    contentContainer: {
        paddingVertical: spacing.lg,
    },
    frequencyRow: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    frequencyChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    frequencyText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
    },
    intervalSection: {
        marginTop: spacing.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        gap: spacing.sm,
    },
    sliderLabelContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 8,
    },
    sliderPrefixText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 12,
        letterSpacing: 1,
    },
    sliderSuffixText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 12,
        letterSpacing: 1,
    },
    sliderValueText: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['2xl'],
    },
    slider: {
        width: '100%',
        height: 40,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.lg,
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    dayText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
    },
    bottomButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    removeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    saveButton: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
    },
    removeText: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize.lg,
    },
});
