import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { rrulestr } from 'rrule';
import { supabase } from './supabase';
import { cancelReminderNotifications } from './notifications';
import { Reminder } from '../types/reminder';

export const getNextDate = (dateStr: string | undefined, repeatStr: string | undefined): string | undefined => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Default baseDate to today if not provided
    let baseDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();

    if (isNaN(baseDate.getTime())) return undefined;

    if (!repeatStr || repeatStr === 'none') return undefined;

    let repeat = 'none';
    if (repeatStr) {
        if (repeatStr.includes('FREQ=DAILY') || repeatStr === 'daily') repeat = 'daily';
        else if (repeatStr.includes('FREQ=WEEKLY') || repeatStr === 'weekly') repeat = 'weekly';
        else if (repeatStr.includes('FREQ=MONTHLY') || repeatStr === 'monthly') repeat = 'monthly';
        else if (repeatStr.includes('FREQ=YEARLY') || repeatStr === 'yearly') repeat = 'yearly';
    }

    try {
        let ruleString = repeatStr;
        if (repeatStr === 'daily') ruleString = 'FREQ=DAILY';
        else if (repeatStr === 'weekly') ruleString = 'FREQ=WEEKLY';
        else if (repeatStr === 'monthly') ruleString = 'FREQ=MONTHLY';
        else if (repeatStr === 'yearly') ruleString = 'FREQ=YEARLY';

        const dtstart = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
        const rule = rrulestr(ruleString, { dtstart });

        const endOfTodayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
        const nextOccurrenceUTC = rule.after(endOfTodayUTC);

        if (nextOccurrenceUTC) {
            const nextLocal = new Date(nextOccurrenceUTC.getUTCFullYear(), nextOccurrenceUTC.getUTCMonth(), nextOccurrenceUTC.getUTCDate());
            return format(nextLocal, 'yyyy-MM-dd');
        }
        return undefined;
    } catch (e) {
        console.error('[lib/reminders] Error parsing rrule:', e);
    }

    // Fallback logic for basic repeats
    let nextDate = baseDate;
    const addInterval = (d: Date, r: string): Date => {
        switch (r) {
            case 'daily': return addDays(d, 1);
            case 'weekly': return addWeeks(d, 1);
            case 'monthly': return addMonths(d, 1);
            case 'yearly': return addMonths(d, 12);
            default: return d;
        }
    };

    do {
        nextDate = addInterval(nextDate, repeat);
    } while (format(nextDate, 'yyyy-MM-dd') <= todayStr);

    return format(nextDate, 'yyyy-MM-dd');
};

export const handleCompleteBackground = async (id: string, title?: string) => {
    try {
        console.log(`[lib/reminders] Executing headless complete for ${id} ("${title || 'Unknown'}")`);

        // We don't necessarily have a session active in memory, but Supabase client will automatically
        // load it from AsyncStorage on init, or we can just call getSession to ensure it's loaded.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.error('[lib/reminders] No session found during background task');
            return { error: new Error('No active session') };
        }

        // 1. Fetch the reminder to know its repeat details
        const { data: reminder, error: fetchError } = await supabase
            .from('reminders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !reminder) {
            console.error('[lib/reminders] Error fetching reminder for background complete:', fetchError);
            return { error: fetchError || new Error('Reminder not found') };
        }

        if (reminder.completed) {
            console.log(`[lib/reminders] Reminder ${id} is already completed. Ignoring.`);
            return { error: null };
        }

        // 2. Mark as completed
        const { error: updateError } = await supabase
            .from('reminders')
            .update({ completed: true })
            .eq('id', id);

        if (updateError) {
            console.error('[lib/reminders] Supabase update error:', updateError);
            return { error: updateError };
        }

        console.log(`[lib/reminders] Successfully updated database for ${id}`);

        // Cancel notifications
        await cancelReminderNotifications(id).catch(err =>
            console.error('[lib/reminders] Failed to cancel notification after complete:', err)
        );

        // 3. Handle repeating
        if (reminder.repeat && reminder.repeat !== 'none') {
            const nextDate = getNextDate(reminder.date || undefined, reminder.repeat);

            if (reminder.repeat_until && nextDate) {
                const nextDateObj = new Date(nextDate + 'T00:00:00');
                const untilDateObj = new Date(reminder.repeat_until + 'T00:00:00');
                if (nextDateObj > untilDateObj) {
                    console.log('[lib/reminders] Repeat ended: next date is past repeat_until');
                    return { error: null };
                }
            }

            if (nextDate) {
                const nextReminder = {
                    title: reminder.title,
                    date: nextDate,
                    time: reminder.time,
                    repeat: reminder.repeat,
                    repeat_until: reminder.repeat_until || null,
                    tag_id: reminder.tag_id,
                    priority_id: reminder.priority_id,
                    user_id: session.user.id,
                    completed: false,
                };

                const { error: insertError } = await supabase
                    .from('reminders')
                    .insert([nextReminder]);

                if (insertError) {
                    console.error('[lib/reminders] Failed to insert next repeating reminder:', insertError);
                } else {
                    console.log('[lib/reminders] Inserted next repeating reminder for date:', nextDate);
                }
            }
        }

        return { error: null };
    } catch (error) {
        console.error('[lib/reminders] Unexpected error in handleCompleteBackground:', error);
        return { error };
    }
};
