import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import React from 'react';

// ---------------------------------------------------------------------------
// Custom chart tooltip — dark-themed, used across all report charts
// ---------------------------------------------------------------------------
export const ChartTooltip = ({ active, payload, label, formatter }: any) => {
    if (!active || !payload?.length) return null;
    return React.createElement('div', {
        style: {
            backgroundColor: 'hsl(222, 47%, 9%)',
            border: '1px solid hsl(217, 33%, 20%)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        },
    }, [
        label && React.createElement('p', {
            key: 'label',
            style: { color: 'hsl(215, 20%, 55%)', marginBottom: '4px', fontWeight: 500 },
        }, label),
        ...payload.map((entry: any, i: number) =>
            React.createElement('p', {
                key: i,
                style: { color: entry.color || 'hsl(210, 40%, 96%)', margin: '2px 0' },
            }, `${entry.name}: ${formatter ? formatter(entry.value) : entry.value}`)
        ),
    ]);
};

// ---------------------------------------------------------------------------
// Due-date classification
// ---------------------------------------------------------------------------
export type DueDateClass = 'overdue' | 'due-today' | 'due-2d' | 'approaching' | 'normal';

export function classifyDueDate(dueDateStr: string | null | undefined): DueDateClass {
    if (!dueDateStr) return 'normal';
    try {
        const due = parseISO(dueDateStr);
        const days = differenceInCalendarDays(due, new Date());
        if (days < 0) return 'overdue';
        if (days === 0) return 'due-today';
        if (days <= 2) return 'due-2d';
        if (days <= 15) return 'approaching';
        return 'normal';
    } catch {
        return 'normal';
    }
}

export const DUE_DATE_ROW_CLASSES: Record<DueDateClass, string> = {
    overdue: 'bg-red-950/40 hover:bg-red-950/50',
    'due-today': 'bg-amber-950/40 hover:bg-amber-950/50',
    'due-2d': 'bg-orange-950/30 hover:bg-orange-950/40',
    approaching: 'bg-blue-950/20 hover:bg-blue-950/30',
    normal: '',
};

export const DUE_DATE_BADGE_CLASSES: Record<DueDateClass, string> = {
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    'due-today': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'due-2d': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    approaching: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    normal: 'bg-muted/20 text-muted-foreground border-muted/30',
};

// ---------------------------------------------------------------------------
// Invoice aging buckets (exact from spec R40)
// DUE_15: 8–15 days | DUE_7: 1–7 days | DUE_TODAY: 0
// OVR_1_15: -1 to -15 | OVR_16_30: -16 to -30 | OVR_31_45: -31 to -45
// OVR_46_60: -46 to -60 | OVR_60PLUS: < -60
// ---------------------------------------------------------------------------
export type AgingBucket =
    | 'DUE_15'
    | 'DUE_7'
    | 'DUE_TODAY'
    | 'OVR_1_15'
    | 'OVR_16_30'
    | 'OVR_31_45'
    | 'OVR_46_60'
    | 'OVR_60PLUS';

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
    DUE_15: 'DUE IN 15 DAYS',
    DUE_7: 'DUE IN 7 DAYS',
    DUE_TODAY: 'DUE TODAY',
    OVR_1_15: 'OVERDUE 1–15 DAYS',
    OVR_16_30: 'OVERDUE 16–30 DAYS',
    OVR_31_45: 'OVERDUE 31–45 DAYS',
    OVR_46_60: 'OVERDUE 46–60 DAYS',
    OVR_60PLUS: 'OVERDUE >60 DAYS',
};

export const AGING_BUCKET_ORDER: AgingBucket[] = [
    'DUE_15', 'DUE_7', 'DUE_TODAY',
    'OVR_1_15', 'OVR_16_30', 'OVR_31_45', 'OVR_46_60', 'OVR_60PLUS',
];

export function getAgingBucket(dueDateStr: string): AgingBucket {
    try {
        const days = differenceInCalendarDays(parseISO(dueDateStr), new Date());
        if (days > 15) return 'DUE_15'; // more than 15 days away — not in a bucket, but we show it as DUE_15
        if (days >= 8) return 'DUE_15';
        if (days >= 1) return 'DUE_7';
        if (days === 0) return 'DUE_TODAY';
        if (days >= -15) return 'OVR_1_15';
        if (days >= -30) return 'OVR_16_30';
        if (days >= -45) return 'OVR_31_45';
        if (days >= -60) return 'OVR_46_60';
        return 'OVR_60PLUS';
    } catch {
        return 'OVR_60PLUS';
    }
}

// ---------------------------------------------------------------------------
// WYSE export — only visible columns, in current order
// ---------------------------------------------------------------------------
export function buildExportRows(
    rows: any[],
    visibleCols: { key: string; label: string }[]
): Record<string, any>[] {
    return rows.map(row => {
        const out: Record<string, any> = {};
        for (const col of visibleCols) {
            out[col.label] = row[col.key] ?? '';
        }
        return out;
    });
}

// ---------------------------------------------------------------------------
// Monthly grouping for charts
// ---------------------------------------------------------------------------
export function groupByMonth(
    items: any[],
    dateField: string
): { name: string; count: number }[] {
    const map: Record<string, number> = {};
    for (const item of items) {
        const val = item[dateField];
        if (!val) continue;
        try {
            const d = typeof val === 'string' ? parseISO(val) : new Date(val);
            const key = format(d, 'MMM yy');
            map[key] = (map[key] || 0) + 1;
        } catch {
            // skip invalid dates
        }
    }
    // Sort chronologically
    return Object.entries(map)
        .sort((a, b) => {
            try {
                return new Date('01 ' + a[0]).getTime() - new Date('01 ' + b[0]).getTime();
            } catch {
                return 0;
            }
        })
        .map(([name, count]) => ({ name, count }));
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------
export function fmtUSD(val: number | null | undefined): string {
    if (val == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(val);
}

// ---------------------------------------------------------------------------
// Days between two date strings (returns null if either is missing)
// ---------------------------------------------------------------------------
export function daysBetween(
    fromDate: string | null | undefined,
    toDate: string | null | undefined
): number | null {
    if (!fromDate || !toDate) return null;
    try {
        return differenceInCalendarDays(parseISO(toDate), parseISO(fromDate));
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Format a date string as DD/MM/YYYY (spec default)
// ---------------------------------------------------------------------------
export function fmtDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
        return dateStr;
    }
}

// ---------------------------------------------------------------------------
// Days from today to a date (positive = future, negative = past)
// ---------------------------------------------------------------------------
export function daysFromToday(dueDateStr: string | null | undefined): number | null {
    if (!dueDateStr) return null;
    try {
        return differenceInCalendarDays(parseISO(dueDateStr), new Date());
    } catch {
        return null;
    }
}

// Format days for display: "+5 days" / "Today" / "-3 days (overdue)"
export function fmtDaysToDue(days: number | null): string {
    if (days === null) return '—';
    if (days === 0) return 'Today';
    if (days > 0) return `In ${days}d`;
    return `${Math.abs(days)}d overdue`;
}
