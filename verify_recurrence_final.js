const { addDays, addWeeks, addMonths, format } = require('date-fns');

const getNextDate = (dateStr, repeat, todayStr) => {
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

const TODAY = '2026-02-22';
console.log('MOCK TODAY: ' + TODAY);

const results = [
    ['2026-02-20', 'daily', '2026-02-23'],
    ['2026-02-22', 'daily', '2026-02-23'],
    ['2026-02-15', 'weekly', '2026-02-23'], // Sunday to next Monday (Sunday + 1 week = 22nd, still <= today, so + 1 week = March 1st?) 
    // Wait, if 15th is Sunday, then 22nd is Sunday. 
    // nextDate = 22nd. 22nd <= 22nd is True.
    // nextDate = March 1st.
    ['2026-01-22', 'monthly', '2026-03-22'],
    ['2026-02-22', 'monthly', '2026-03-22']
].map(([d, r, expected]) => {
    const actual = getNextDate(d, r, TODAY);
    return `${r.padEnd(8)} | Input: ${d} | Actual: ${actual} | Expected: ${expected}`;
});

console.log(results.join('\n'));
