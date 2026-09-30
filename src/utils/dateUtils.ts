import { moment } from 'obsidian';
import { BillFrequency, UrgencyStatus, TransactionStatus } from '../types';

export function parseDate(dateStr: string | undefined): import('moment').Moment | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.replace(/^\[\[|\]\]$/g, '').trim();
    if (!clean) return null;
    const m = moment(clean, ['YYYY-MM-DD', 'YYYY/MM/DD', moment.ISO_8601], true);
    return m.isValid() ? m : null;
}

export function formatDate(date: import('moment').Moment | Date | string, format: string = 'YYYY-MM-DD'): string {
    return moment(date).format(format);
}

export function getTodayDateStr(): string {
    return moment().format('YYYY-MM-DD');
}

export function getCurrentMonthStr(): string {
    return moment().format('YYYY-MM');
}

export function getCurrentYearStr(): string {
    return moment().format('YYYY');
}

export function getDaysUntilDue(dueDateStr: string): number {
    const due = parseDate(dueDateStr);
    if (!due) return 999999;
    const today = moment().startOf('day');
    const dueDay = due.clone().startOf('day');
    return dueDay.diff(today, 'days');
}

export function getTransactionUrgency(
    dueDateStr: string,
    status: TransactionStatus,
    reminderDays: number = 3
): UrgencyStatus {
    if (status === 'paid') return 'paid';
    if (status === 'skipped') return 'skipped';

    const daysUntil = getDaysUntilDue(dueDateStr);

    if (daysUntil < 0) {
        return 'overdue';
    }
    if (daysUntil === 0) {
        return 'due_today';
    }
    if (daysUntil <= reminderDays) {
        return 'due_soon';
    }
    return 'upcoming';
}

export function computeDueDateForMonth(
    targetMonth: string, // YYYY-MM
    dueDay: number | undefined,
    frequency: BillFrequency = 'monthly'
): string {
    const monthMoment = moment(targetMonth, 'YYYY-MM');
    if (!monthMoment.isValid()) {
        return `${targetMonth}-01`;
    }

    const maxDays = monthMoment.daysInMonth();
    const safeDay = Math.min(Math.max(1, dueDay || 1), maxDays);
    return `${targetMonth}-${String(safeDay).padStart(2, '0')}`;
}

export function getRelativeDueDateLabel(daysUntil: number, status: TransactionStatus): string {
    if (status === 'paid') return 'Paid ✓';
    if (status === 'skipped') return 'Skipped';
    if (daysUntil < -1) return `Overdue by ${Math.abs(daysUntil)} days`;
    if (daysUntil === -1) return `Overdue by 1 day`;
    if (daysUntil === 0) return `Due Today`;
    if (daysUntil === 1) return `Due Tomorrow`;
    return `Due in ${daysUntil} days`;
}
