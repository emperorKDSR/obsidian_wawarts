import { BillIndexService } from '../../services/BillIndexService';
import { RecurringBillsSettings } from '../../types';
import { getCurrentMonthStr, getCurrentYearStr } from '../../utils/dateUtils';

export class BillsSummaryCards {
    static render(
        containerEl: HTMLElement,
        indexService: BillIndexService,
        settings: RecurringBillsSettings,
        selectedMonth: string,
        onOverdueClick?: () => void,
        onPendingClick?: () => void
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-summary-grid');

        const activeMonth = selectedMonth && selectedMonth !== 'all' ? selectedMonth : getCurrentMonthStr();
        const activeYear = activeMonth.substring(0, 4) || getCurrentYearStr();

        const yearlySummary = indexService.getYearlySummary(activeYear);
        const monthSummary = indexService.getMonthSummary(activeMonth);
        const dueSoon = indexService.getDueSoonTransactions(7);
        const overdue = indexService.getOverdueTransactions();

        // 1. Hero Metric: Yearly Percentage Paid
        const yearlyCard = containerEl.createEl('div', { cls: 'bills-metric-card bills-metric-card--primary' });
        yearlyCard.createEl('div', { text: `${activeYear} Yearly Completion`, cls: 'bills-metric-label' });
        yearlyCard.createEl('div', {
            text: `${yearlySummary.percentagePaid}% Paid`,
            cls: 'bills-metric-value bills-metric-value--success',
        });
        yearlyCard.createEl('div', {
            text: `${yearlySummary.paidCount} of ${yearlySummary.totalBills} bills settled in ${activeYear}`,
            cls: 'bills-metric-subtext',
        });

        // 2. Month Status Card
        const monthCard = containerEl.createEl('div', { cls: 'bills-metric-card' });
        monthCard.createEl('div', { text: `${activeMonth} Status`, cls: 'bills-metric-label' });
        monthCard.createEl('div', {
            text: `${monthSummary.percentagePaid}% Settled`,
            cls: 'bills-metric-value',
        });
        monthCard.createEl('div', {
            text: `${monthSummary.paidCount} paid, ${monthSummary.pendingCount} pending`,
            cls: 'bills-metric-subtext',
        });

        // 3. Due Soon Card
        const dueSoonCard = containerEl.createEl('div', { cls: 'bills-metric-card bills-metric-card--warning bills-metric-card--clickable' });
        dueSoonCard.createEl('div', { text: 'Due Next 7 Days', cls: 'bills-metric-label' });
        dueSoonCard.createEl('div', {
            text: `${dueSoon.length} Bill${dueSoon.length === 1 ? '' : 's'}`,
            cls: 'bills-metric-value',
        });
        dueSoonCard.createEl('div', {
            text: dueSoon.length > 0 ? 'Upcoming due dates approaching' : 'No bills due this week',
            cls: 'bills-metric-subtext',
        });
        if (onPendingClick) dueSoonCard.addEventListener('click', onPendingClick);

        // 4. Overdue or All Caught Up Card
        if (overdue.length > 0) {
            const overdueCard = containerEl.createEl('div', { cls: 'bills-metric-card bills-metric-card--danger bills-metric-card--clickable' });
            overdueCard.createEl('div', { text: '⚠️ Overdue Bills', cls: 'bills-metric-label' });
            overdueCard.createEl('div', {
                text: `${overdue.length} Overdue`,
                cls: 'bills-metric-value',
            });
            overdueCard.createEl('div', {
                text: 'Action required on past due bills',
                cls: 'bills-metric-subtext',
            });
            if (onOverdueClick) overdueCard.addEventListener('click', onOverdueClick);
        } else {
            const currentCard = containerEl.createEl('div', { cls: 'bills-metric-card' });
            currentCard.createEl('div', { text: 'Schedule Health', cls: 'bills-metric-label' });
            currentCard.createEl('div', {
                text: '100% On Schedule',
                cls: 'bills-metric-value bills-metric-value--success',
            });
            currentCard.createEl('div', {
                text: 'Zero overdue bills ✓',
                cls: 'bills-metric-subtext bills-metric-subtext--success',
            });
        }
    }
}
