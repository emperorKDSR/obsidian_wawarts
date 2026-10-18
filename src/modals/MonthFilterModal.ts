import { App, Modal, setIcon } from 'obsidian';
import { TransactionFilterOptions } from '../types';
import { BillIndexService } from '../services/BillIndexService';
import { getCurrentMonthStr } from '../utils/dateUtils';

const MONTH_NAMES = [
    { num: '01', short: 'Jan', full: 'January' },
    { num: '02', short: 'Feb', full: 'February' },
    { num: '03', short: 'Mar', full: 'March' },
    { num: '04', short: 'Apr', full: 'April' },
    { num: '05', short: 'May', full: 'May' },
    { num: '06', short: 'Jun', full: 'June' },
    { num: '07', short: 'Jul', full: 'July' },
    { num: '08', short: 'Aug', full: 'August' },
    { num: '09', short: 'Sep', full: 'September' },
    { num: '10', short: 'Oct', full: 'October' },
    { num: '11', short: 'Nov', full: 'November' },
    { num: '12', short: 'Dec', full: 'December' },
];

function stepMonth(monthStr: string, delta: number): string {
    if (!monthStr || monthStr === 'all') return getCurrentMonthStr();
    const [yStr, mStr] = monthStr.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    while (m > 12) {
        m -= 12;
        y += 1;
    }
    while (m < 1) {
        m += 12;
        y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
}

function formatMonthLabel(monthStr: string): string {
    if (!monthStr || monthStr === 'all') return 'All Months';
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return monthStr;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatMonthShort(monthStr: string): string {
    if (!monthStr || monthStr === 'all') return 'All';
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return monthStr;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short' });
}

function triggerHaptic(ms = 10): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(ms);
        } catch {
            // Ignore unsupported platforms
        }
    }
}

export class MonthFilterModal extends Modal {
    private indexService: BillIndexService;
    private filterOptions: TransactionFilterOptions;
    private onMonthSelected: (selectedMonth: string) => void;
    private viewYear: number;

    constructor(
        app: App,
        indexService: BillIndexService,
        filterOptions: TransactionFilterOptions,
        onMonthSelected: (selectedMonth: string) => void
    ) {
        super(app);
        this.indexService = indexService;
        this.filterOptions = filterOptions;
        this.onMonthSelected = onMonthSelected;

        const todayMonthStr = getCurrentMonthStr();
        const initialYear =
            filterOptions.selectedMonth && filterOptions.selectedMonth !== 'all'
                ? parseInt(filterOptions.selectedMonth.split('-')[0], 10)
                : parseInt(todayMonthStr.split('-')[0], 10);
        this.viewYear = isNaN(initialYear) ? new Date().getFullYear() : initialYear;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--month-picker');
        contentEl.empty();

        const todayMonthStr = getCurrentMonthStr();

        // Header
        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header bills-month-modal-header' });
        const titleGroup = headerEl.createEl('div', { cls: 'bills-sheet-title-group' });
        titleGroup.createEl('h2', { text: 'Select Due Month', cls: 'bills-modal-title' });
        const currentDisplay = formatMonthLabel(this.filterOptions.selectedMonth);
        titleGroup.createEl('span', { text: `Currently showing: ${currentDisplay}`, cls: 'bills-sheet-current-label' });

        const closeBtn = headerEl.createEl('button', {
            cls: 'clickable-icon bills-modal-close-icon',
            attr: { 'aria-label': 'Close' },
        });
        setIcon(closeBtn, 'x');
        closeBtn.addEventListener('click', () => this.close());

        // Body
        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body bills-month-modal-body' });

        // 1. Year Navigator Row (< 2026 >)
        const yearNav = bodyEl.createEl('div', { cls: 'bills-month-grid-year-nav' });

        const prevYearBtn = yearNav.createEl('button', {
            cls: 'clickable-icon bills-year-nav-btn',
            attr: { 'aria-label': 'Previous Year' },
        });
        setIcon(prevYearBtn, 'chevron-left');

        const yearDisplay = yearNav.createEl('span', {
            cls: 'bills-year-nav-display',
            text: String(this.viewYear),
        });

        const nextYearBtn = yearNav.createEl('button', {
            cls: 'clickable-icon bills-year-nav-btn',
            attr: { 'aria-label': 'Next Year' },
        });
        setIcon(nextYearBtn, 'chevron-right');

        // 2. 12-Month Calendar Grid Container
        const gridContainer = bodyEl.createEl('div', { cls: 'bills-month-grid' });

        const selectAndClose = (monthKey: string) => {
            triggerHaptic(10);
            this.onMonthSelected(monthKey);
            this.close();
        };

        const renderGrid = () => {
            gridContainer.empty();
            const allTransactions = this.indexService.getAllTransactions();

            for (const m of MONTH_NAMES) {
                const monthKey = `${this.viewYear}-${m.num}`;
                const isSelected = this.filterOptions.selectedMonth === monthKey;
                const isToday = todayMonthStr === monthKey;
                const dueCount = allTransactions.filter((t) => t.dueDate && t.dueDate.startsWith(monthKey)).length;

                const btn = gridContainer.createEl('button', {
                    cls: `bills-month-grid-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`,
                    attr: { 'aria-label': `${m.full} ${this.viewYear} (${dueCount} dues)` },
                });

                const labelWrap = btn.createEl('div', { cls: 'bills-month-cell-label-wrap' });
                labelWrap.createEl('span', { text: m.short, cls: 'bills-month-cell-name' });
                if (dueCount > 0) {
                    labelWrap.createEl('span', { text: String(dueCount), cls: 'bills-month-cell-count' });
                }

                if (isToday) {
                    btn.createEl('span', { cls: 'bills-month-today-dot', attr: { 'aria-label': 'Current Month' } });
                }

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectAndClose(monthKey);
                });
            }
        };

        prevYearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic(10);
            this.viewYear -= 1;
            yearDisplay.textContent = String(this.viewYear);
            renderGrid();
        });

        nextYearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic(10);
            this.viewYear += 1;
            yearDisplay.textContent = String(this.viewYear);
            renderGrid();
        });

        // Initial Grid Render
        renderGrid();

        // 3. Quick Shortcuts Section
        const quickSec = bodyEl.createEl('div', { cls: 'bills-sheet-section' });
        quickSec.createEl('div', { text: 'Quick Period Jump', cls: 'bills-sheet-section-title' });

        const chipsWrap = quickSec.createEl('div', { cls: 'bills-sheet-chips-wrap' });

        // Shortcut 1: Current Month
        const thisMonthBtn = chipsWrap.createEl('button', {
            cls: `bills-sheet-chip ${this.filterOptions.selectedMonth === todayMonthStr ? 'is-selected' : ''}`,
            text: `This Month (${formatMonthShort(todayMonthStr)} ${todayMonthStr.split('-')[0]})`,
        });
        thisMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAndClose(todayMonthStr);
        });

        // Shortcut 2: Next Month
        const nextMonthStr = stepMonth(todayMonthStr, 1);
        const nextMonthBtn = chipsWrap.createEl('button', {
            cls: `bills-sheet-chip ${this.filterOptions.selectedMonth === nextMonthStr ? 'is-selected' : ''}`,
            text: `Next Month (${formatMonthShort(nextMonthStr)})`,
        });
        nextMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAndClose(nextMonthStr);
        });

        // Shortcut 3: All Months
        const allMonthsBtn = chipsWrap.createEl('button', {
            cls: `bills-sheet-chip ${this.filterOptions.selectedMonth === 'all' ? 'is-selected' : ''}`,
            text: 'All Months (Show All Dues)',
        });
        allMonthsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAndClose('all');
        });

        // 4. Custom Month Input (Native Wheel)
        const customSec = bodyEl.createEl('div', { cls: 'bills-sheet-section' });
        customSec.createEl('div', { text: 'Custom Month Picker', cls: 'bills-sheet-section-title' });
        const monthInput = customSec.createEl('input', {
            type: 'month',
            cls: 'bills-sheet-month-input',
        });
        if (this.filterOptions.selectedMonth !== 'all') {
            monthInput.value = this.filterOptions.selectedMonth;
        }
        monthInput.addEventListener('change', () => {
            if (monthInput.value) {
                selectAndClose(monthInput.value);
            }
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
