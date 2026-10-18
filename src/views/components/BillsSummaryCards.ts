import { BillIndexService } from '../../services/BillIndexService';
import { RecurringBillsSettings } from '../../types';
import { getCurrentMonthStr } from '../../utils/dateUtils';

export class BillsSummaryCards {
    static render(
        containerEl: HTMLElement,
        indexService: BillIndexService,
        settings: RecurringBillsSettings,
        selectedMonth: string,
        activeFilterTab?: string,
        onOverdueClick?: () => void,
        onPendingClick?: () => void,
        onSettledClick?: () => void
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-summary-grid');

        const activeMonth = selectedMonth && selectedMonth !== 'all' ? selectedMonth : getCurrentMonthStr();
        const monthSummary = indexService.getMonthSummary(activeMonth);
        const overdue = indexService.getOverdueTransactions();
        const dueIn3Days = indexService.getDueSoonTransactions(3);

        const totalBills = monthSummary.totalBills;
        const paidCount = monthSummary.paidCount;
        const percentagePaid = monthSummary.percentagePaid;

        // 1. Stat 1: % Settled
        const isSettledActive = activeFilterTab === 'paid';
        const settledCard = containerEl.createEl('div', {
            cls: `bills-metric-card ${onSettledClick ? 'bills-metric-card--clickable' : ''} ${isSettledActive ? 'bills-metric-card--active' : ''}`,
            attr: { 'aria-label': `${percentagePaid}% Settled (${paidCount} of ${totalBills} bills)` },
        });
        settledCard.createEl('div', { text: '% Settled', cls: 'bills-metric-label' });
        settledCard.createEl('div', {
            text: `${percentagePaid}%`,
            cls: 'bills-metric-value',
        });
        settledCard.createEl('div', {
            text: `${paidCount} of ${totalBills}`,
            cls: 'bills-metric-subtext',
        });
        if (onSettledClick) {
            settledCard.addEventListener('click', onSettledClick);
        }

        // 2. Stat 2: # of Bills Overdue
        const isOverdueActive = activeFilterTab === 'overdue';
        const overdueCard = containerEl.createEl('div', {
            cls: `bills-metric-card ${onOverdueClick ? 'bills-metric-card--clickable' : ''} ${isOverdueActive ? 'bills-metric-card--active' : ''} ${overdue.length > 0 ? 'bills-metric-card--alert' : ''}`,
            attr: { 'aria-label': `${overdue.length} Overdue Bills` },
        });
        overdueCard.createEl('div', { text: 'Overdue', cls: 'bills-metric-label' });
        overdueCard.createEl('div', {
            text: String(overdue.length),
            cls: 'bills-metric-value',
        });
        overdueCard.createEl('div', {
            text: overdue.length > 0 ? (overdue.length === 1 ? '1 Bill' : `${overdue.length} Bills`) : 'All Clear',
            cls: 'bills-metric-subtext',
        });
        if (onOverdueClick) {
            overdueCard.addEventListener('click', onOverdueClick);
        }

        // 3. Stat 3: # of Bills Due in the next 3 days
        const isDueSoonActive = activeFilterTab === 'pending';
        const dueSoonCard = containerEl.createEl('div', {
            cls: `bills-metric-card ${onPendingClick ? 'bills-metric-card--clickable' : ''} ${isDueSoonActive ? 'bills-metric-card--active' : ''}`,
            attr: { 'aria-label': `${dueIn3Days.length} Bills Due Next 3 Days` },
        });
        dueSoonCard.createEl('div', { text: 'Due in 3d', cls: 'bills-metric-label' });
        dueSoonCard.createEl('div', {
            text: String(dueIn3Days.length),
            cls: 'bills-metric-value',
        });
        dueSoonCard.createEl('div', {
            text: dueIn3Days.length > 0 ? (dueIn3Days.length === 1 ? '1 Bill' : `${dueIn3Days.length} Bills`) : 'None',
            cls: 'bills-metric-subtext',
        });
        if (onPendingClick) {
            dueSoonCard.addEventListener('click', onPendingClick);
        }
    }
}
