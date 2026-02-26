try {
    const { addDays, addWeeks, addMonths, format } = require('date-fns');

    const getNextDate = (dateStr, repeat) => {
        const now = new Date(); // In actual code we use new Date() which uses current time
        // For consistency with the metadata date 2026-02-22
        const todayStr = format(now, 'yyyy-MM-dd');

        let baseDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
        if (isNaN(baseDate.getTime())) return undefined;

        let nextDate = baseDate;

        const addInterval = (d, r) => {
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

    const today = format(new Date(), 'yyyy-MM-dd');
    console.log('--- Testing Recurrence Logic ---');
    console.log('Current Date (Local):', today);

    const tests = [
        { date: '2026-02-20', repeat: 'daily', desc: 'Daily (2 days ago)' },
        { date: '2026-02-22', repeat: 'daily', desc: 'Daily (today)' },
        { date: '2026-02-15', repeat: 'weekly', desc: 'Weekly (last Sunday)' },
        { date: '2026-02-22', repeat: 'weekly', desc: 'Weekly (today)' },
        { date: '2026-01-22', repeat: 'monthly', desc: 'Monthly (last month)' },
        { date: '2026-02-22', repeat: 'monthly', desc: 'Monthly (today)' }
    ];

    tests.forEach(t => {
        const result = getNextDate(t.date, t.repeat);
        console.log(`${t.desc}: Input=${t.date} -> Next=${result}`);
    });

} catch (e) {
    console.error('Error:', e);
}
