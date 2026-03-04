import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { Reminder } from '../types/reminder';

// No horizontal scroll hooks needed anymore.

interface InlineNotificationPickerProps {
    initialOffsets: number[];
    onConfirm: (offsets: number[]) => void;
    onCancel: () => void;
    baseTime?: string | null; // e.g., '14:30'
}

export function InlineNotificationPicker({ initialOffsets, onConfirm, onCancel, baseTime }: InlineNotificationPickerProps) {
    const { colors, isDark } = useTheme();
    const initialOffset = initialOffsets.length > 0 ? initialOffsets[0] : 15;

    const initialHours = Math.floor(initialOffset / 60);
    const initialMins = initialOffset % 60;

    const [hours, setHours] = useState<number>(initialHours);
    const [minutes, setMinutes] = useState<number>(initialMins);

    // Custom Time Modal State
    const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
    const [customTime, setCustomTime] = useState<Date | null>(null);

    // No auto-save here, wait for save button
    const handleSliderComplete = (h: number, m: number) => {
        const totalMinutes = (h * 60) + m;
        console.log("Notification setting changed to:", totalMinutes, "minutes");
    };

    // Derived absolute time based on the baseTime of the reminder and the chosen offsets.
    const getAbsoluteNotificationTime = () => {
        let baseDate = new Date();
        baseDate.setSeconds(0);
        baseDate.setMilliseconds(0);

        if (baseTime) {
            const [h, m] = baseTime.split(':').map(Number);
            baseDate.setHours(h, m);
        } else {
            // Default to noon if no time exists
            baseDate.setHours(12, 0);
        }

        const totalOffsetMinutes = (hours * 60) + minutes;
        baseDate.setMinutes(baseDate.getMinutes() - totalOffsetMinutes);
        return baseDate;
    };

    const displayTime = getAbsoluteNotificationTime();

    // Formatting helper for absolute time string
    const formatTime = (date: Date) => {
        let h = date.getHours();
        const m = date.getMinutes().toString().padStart(2, '0');
        const period = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${period}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="notifications" size={16} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.foreground }]}>Notification Setting</Text>
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </TouchableOpacity>
            </View>

            <View style={[styles.slidersContainer]}>
                {/* Hours Slider */}
                <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelContainer}>
                        <Text style={[styles.sliderValueText, { color: colors.foreground }]}>{hours}</Text>
                        <Text style={[styles.sliderSufixText, { color: colors.mutedForeground }]}>HOURS</Text>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={24}
                        step={1}
                        value={hours}
                        onValueChange={setHours}
                        onSlidingComplete={(val) => handleSliderComplete(val, minutes)}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.primary}
                    />
                </View>

                {/* Minutes Slider */}
                <View style={[styles.sliderRow, { marginTop: spacing.md }]}>
                    <View style={styles.sliderLabelContainer}>
                        <Text style={[styles.sliderValueText, { color: colors.foreground }]}>{minutes}</Text>
                        <Text style={[styles.sliderSufixText, { color: colors.mutedForeground }]}>MINS</Text>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={59}
                        step={1}
                        value={minutes}
                        onValueChange={setMinutes}
                        onSlidingComplete={(val) => handleSliderComplete(hours, val)}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.primary}
                    />
                </View>
            </View>

            <View style={styles.bottomButtonsRow}>
                <TouchableOpacity
                    style={[styles.customTimeButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={() => {
                        setCustomTime(displayTime);
                        setShowCustomTimePicker(true);
                    }}
                >
                    <Ionicons name="notifications-outline" size={18} color={colors.foreground} />
                    <Text style={[styles.customTimeText, { color: colors.foreground }]}>
                        {formatTime(displayTime)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        const totalMinutes = (hours * 60) + minutes;
                        onConfirm([totalMinutes]);
                    }}
                >
                    <Ionicons name="checkmark" size={24} color={colors.primaryForeground} />
                </TouchableOpacity>
            </View>

            {showCustomTimePicker && (
                <View style={[styles.nativePickerWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <DateTimePicker
                        value={customTime || new Date()}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_event: any, selectedTime?: Date) => {
                            if (Platform.OS !== 'ios') setShowCustomTimePicker(false);
                            if (selectedTime) {
                                setCustomTime(selectedTime);

                                // Translate absolute time to an offset based on baseTime, and auto-confirm it
                                let baseDate = new Date();
                                baseDate.setSeconds(0);
                                baseDate.setMilliseconds(0);
                                if (baseTime) {
                                    const [h, m] = baseTime.split(':').map(Number);
                                    baseDate.setHours(h, m);
                                } else {
                                    baseDate.setHours(12, 0);
                                }

                                const diffMs = baseDate.getTime() - selectedTime.getTime();
                                let diffMins = Math.round(diffMs / 60000);

                                // Simple bounds check/wrapping for offset. If diff is negative, it's pushed to the next day relative diff.
                                if (diffMins < 0) {
                                    diffMins += 24 * 60;
                                }

                                const newH = Math.floor(diffMins / 60);
                                const newM = diffMins % 60;
                                setHours(newH);
                                setMinutes(newM);
                                handleSliderComplete(newH, newM);
                            }
                        }}
                        textColor={colors.foreground}
                        themeVariant={isDark ? 'dark' : 'light'}
                    />
                    {Platform.OS === 'ios' && (
                        <TouchableOpacity style={[styles.pickerDoneBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCustomTimePicker(false)}>
                            <Text style={styles.pickerDoneText}>Done</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

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
    slidersContainer: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sliderLabelContainer: {
        width: 70,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    sliderValueText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.xl,
    },
    sliderSufixText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 10,
        letterSpacing: 1,
    },
    slider: {
        flex: 1,
        height: 40,
        marginLeft: spacing.md,
    },
    bottomButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    customTimeButton: {
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
    customTimeText: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize.lg,
    },
    nativePickerWrapper: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    pickerDoneBtn: {
        padding: spacing.md,
        alignItems: 'center',
    },
    pickerDoneText: {
        color: '#FFF',
        fontFamily: typography.fontFamily.bold,
    }
});
