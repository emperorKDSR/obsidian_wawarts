import { App, setIcon } from 'obsidian';
import { BillIndexService } from '../../services/BillIndexService';
import { RecurringBillsSettings } from '../../types';
import { getCurrentYearStr } from '../../utils/dateUtils';

export class AnalyticsDashboard {
    static render(
        containerEl: HTMLElement,
        app: App,
        indexService: BillIndexService,
        settings: RecurringBillsSettings
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-analytics-container');

        const currentYear = getCurrentYearStr();
        const yearlySummary = indexService.getYearlySummary(currentYear);
        const categoryProgress = indexService.getCategoryProgress(currentYear);

        // Header
        const headerEl = containerEl.createEl('div', { cls: 'bills-analytics-header' });
        headerEl.createEl('h2', { text: `${currentYear} Yearly Settlement & Cadence Insights`, cls: 'bills-analytics-title' });
        headerEl.createEl('p', {
            text: 'Monitoring recurring dues completion, 12-month annual cadence, and category settlement progress.',
            cls: 'bills-analytics-desc',
        });

        // 1. Hero Card: Annual Settlement Rate
        const heroCard = containerEl.createEl('div', { cls: 'bills-analytics-card bills-yearly-hero-card' });
        const heroHeader = heroCard.createEl('div', { cls: 'bills-analytics-card-header' });
        heroHeader.createEl('h3', { text: `${currentYear} Annual Progress`, cls: 'bills-analytics-card-title' });
        heroHeader.createEl('span', {
            text: `${yearlySummary.percentagePaid}% Paid YTD`,
            cls: 'bill-badge bill-badge--success bills-hero-badge',
        });

        const heroStatsRow = heroCard.createEl('div', { cls: 'bills-hero-stats-row' });
        heroStatsRow.createEl('div', {
            text: `${yearlySummary.paidCount} Settled of ${yearlySummary.totalBills} Total Scheduled Bills (${yearlySummary.pendingCount} Pending, ${yearlySummary.overdueCount} Overdue)`,
            cls: 'bills-hero-stat-text',
        });

        const heroTrack = heroCard.createEl('div', { cls: 'bills-progress-track bills-hero-progress-track' });
        const heroFill = heroTrack.createEl('div', { cls: 'bills-progress-fill' });
        heroFill.style.width = `${yearlySummary.percentagePaid}%`;
        heroFill.style.backgroundColor = 'var(--color-green, #10b981)';

        // 2. 12-Month Annual Matrix Grid
        const matrixCard = containerEl.createEl('div', { cls: 'bills-analytics-card' });
        matrixCard.createEl('h3', { text: `${currentYear} 12-Month Settlement Matrix`, cls: 'bills-analytics-card-title' });

        const matrixGrid = matrixCard.createEl('div', { cls: 'bills-annual-matrix-grid' });
        for (const m of yearlySummary.monthlyStats) {
            const mCell = matrixGrid.createEl('div', {
                cls: `bills-matrix-cell ${m.total > 0 ? (m.percentage === 100 ? 'bills-matrix-cell--complete' : 'bills-matrix-cell--active') : 'bills-matrix-cell--empty'}`,
            });
            mCell.createEl('div', { text: m.monthName, cls: 'bills-matrix-month-name' });

            if (m.total > 0) {
                mCell.createEl('div', { text: `${m.percentage}%`, cls: 'bills-matrix-percent' });
                mCell.createEl('div', { text: `${m.paid}/${m.total} Paid`, cls: 'bills-matrix-counts' });

                const miniTrack = mCell.createEl('div', { cls: 'bills-progress-track bills-matrix-track' });
                const miniFill = miniTrack.createEl('div', { cls: 'bills-progress-fill' });
                miniFill.style.width = `${m.percentage}%`;
                miniFill.style.backgroundColor = m.percentage === 100 ? 'var(--color-green, #10b981)' : 'var(--interactive-accent)';
            } else {
                mCell.createEl('div', { text: '—', cls: 'bills-matrix-empty-text' });
                mCell.createEl('div', { text: 'No Dues', cls: 'bills-matrix-counts' });
            }
        }

        // 3. 2-Column Section: Category Progress & Master Items
        const grid = containerEl.createEl('div', { cls: 'bills-analytics-grid' });

        // Left Column: Category Settlement
        const catCard = grid.createEl('div', { cls: 'bills-analytics-card' });
        catCard.createEl('h3', { text: 'Settlement Progress by Category', cls: 'bills-analytics-card-title' });

        const catList = catCard.createEl('div', { cls: 'bills-category-list' });
        if (categoryProgress.length > 0) {
            for (const item of categoryProgress) {
                const row = catList.createEl('div', { cls: 'bills-category-row' });

                const labelRow = row.createEl('div', { cls: 'bills-category-row-label' });
                const leftLabel = labelRow.createEl('div', { cls: 'bills-category-name-group' });
                const dot = leftLabel.createEl('span', { cls: 'bills-category-dot' });
                dot.style.backgroundColor = item.color || 'var(--interactive-accent)';
                leftLabel.createEl('span', { text: item.category, cls: 'bills-category-name' });
                leftLabel.createEl('span', { text: `(${item.paidCount}/${item.totalCount} Settled)`, cls: 'bills-category-count' });

                const rightPct = labelRow.createEl('div', { cls: 'bills-category-amount-group' });
                rightPct.createEl('span', { text: `${item.percentagePaid}%`, cls: 'bills-category-amount' });

                const progressTrack = row.createEl('div', { cls: 'bills-progress-track' });
                const progressBar = progressTrack.createEl('div', { cls: 'bills-progress-fill' });
                progressBar.style.width = `${item.percentagePaid}%`;
                progressBar.style.backgroundColor = item.color || 'var(--interactive-accent)';
            }
        } else {
            catList.createEl('div', { text: 'No due instances recorded yet for this year.', cls: 'bills-empty-state-text' });
        }

        // Right Column: Master Schedule Overview
        const masterOverviewCard = grid.createEl('div', { cls: 'bills-analytics-card' });
        masterOverviewCard.createEl('h3', { text: 'Master Catalog Schedule Summary', cls: 'bills-analytics-card-title' });

        const masterBills = indexService.getAllMasterBills();
        const masterList = masterOverviewCard.createEl('div', { cls: 'bills-method-list' });

        if (masterBills.length > 0) {
            for (const b of masterBills) {
                const mRow = masterList.createEl('div', { cls: 'bills-method-row' });
                const left = mRow.createEl('div', { cls: 'bills-method-left' });
                const icon = left.createEl('span', { cls: 'bills-method-icon' });
                setIcon(icon, 'calendar');
                left.createEl('span', { text: b.name, cls: 'bills-method-name' });

                const right = mRow.createEl('div', { cls: 'bills-method-right' });
                right.createEl('span', {
                    text: b.dueDay ? `Day ${b.dueDay} (${b.frequency})` : b.frequency,
                    cls: 'bill-badge bill-badge--neutral',
                });
            }
        } else {
            masterList.createEl('div', { text: 'No master bills configured.', cls: 'bills-empty-state-text' });
        }
    }
}
