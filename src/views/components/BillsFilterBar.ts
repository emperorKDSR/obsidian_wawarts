import { setIcon } from 'obsidian';
import { HubTab, TransactionFilterOptions, TransactionFilterTab } from '../../types';
import { BillIndexService } from '../../services/BillIndexService';
import { getCurrentMonthStr } from '../../utils/dateUtils';

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

export class BillsFilterBar {
    static render(
        containerEl: HTMLElement,
        indexService: BillIndexService,
        currentTab: HubTab,
        filterOptions: TransactionFilterOptions,
        onTabChanged: (tab: HubTab) => void,
        onOptionsChanged: (newOptions: TransactionFilterOptions) => void,
        onOpenGenerateModal: () => void,
        onOpenNewMasterModal: () => void,
        onOpenSettingsModal?: () => void
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-filter-bar-container');

        // Top Navigation Row: Hub Tabs + Action Buttons
        const topRow = containerEl.createEl('div', { cls: 'bills-nav-tab-row' });

        // Left: Navigation Tabs with counter badges
        const tabsGroup = topRow.createEl('div', { cls: 'bills-nav-tabs' });

        const pendingCount = indexService.getAllTransactions().filter((t) => t.status === 'pending').length;
        const masterCount = indexService.getAllMasterBills().length;

        const navTabs: Array<{ id: HubTab; label: string; icon: string; count?: number }> = [
            { id: 'transactions', label: 'Due Ledger', icon: 'list-checks', count: pendingCount },
            { id: 'master', label: 'Master Catalog', icon: 'layers', count: masterCount },
            { id: 'insights', label: 'Insights', icon: 'pie-chart' },
        ];

        for (const tab of navTabs) {
            const tabBtn = tabsGroup.createEl('button', {
                cls: `bills-nav-tab ${currentTab === tab.id ? 'bills-nav-tab--active' : ''}`,
            });
            const iconEl = tabBtn.createEl('span', { cls: 'bills-nav-tab-icon' });
            setIcon(iconEl, tab.icon);
            tabBtn.createEl('span', { text: tab.label });
            if (tab.count !== undefined && tab.count > 0) {
                tabBtn.createEl('span', { text: String(tab.count), cls: 'bills-pill-badge' });
            }
            tabBtn.addEventListener('click', () => onTabChanged(tab.id));
        }

        // Right: Primary Action Buttons
        const actionGroup = topRow.createEl('div', { cls: 'bills-filter-actions-group' });

        // Generate Monthly Bills Button
        const genBtn = actionGroup.createEl('button', {
            cls: 'mod-cta bills-btn-primary bills-gen-btn pos-header-text-btn',
        });
        const zapIcon = genBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(zapIcon, 'sparkles');
        genBtn.createEl('span', { text: 'Generate Due Files' });
        genBtn.addEventListener('click', onOpenGenerateModal);

        // Add Master Bill Button
        const addMasterBtn = actionGroup.createEl('button', {
            cls: 'bills-btn-secondary pos-header-text-btn',
        });
        const plusIcon = addMasterBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(plusIcon, 'plus');
        addMasterBtn.createEl('span', { text: 'New Master Bill' });
        addMasterBtn.addEventListener('click', onOpenNewMasterModal);

        // Folder & Settings Button
        if (onOpenSettingsModal) {
            const settingsBtn = actionGroup.createEl('button', {
                cls: 'bills-btn-secondary bills-btn-icon-only clickable-icon',
                attr: { 'aria-label': 'Folder Locations & Settings' },
            });
            const settingsIcon = settingsBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(settingsIcon, 'settings');
            settingsBtn.addEventListener('click', onOpenSettingsModal);
        }

        // Second Row: Month Nav + Horizon Chips + Search (Only visible in 'transactions' tab)
        if (currentTab === 'transactions') {
            const subRow = containerEl.createEl('div', { cls: 'bills-filter-bottomrow' });

            // Month Navigation Capsule
            const monthNavWrap = subRow.createEl('div', { cls: 'bills-month-nav-wrap' });

            const prevMonthBtn = monthNavWrap.createEl('button', {
                cls: 'clickable-icon bills-month-step-btn',
                attr: { 'aria-label': 'Previous Month' },
            });
            setIcon(prevMonthBtn, 'chevron-left');
            prevMonthBtn.addEventListener('click', () => {
                filterOptions.selectedMonth = stepMonth(filterOptions.selectedMonth, -1);
                onOptionsChanged(filterOptions);
            });

            // Month Selector Dropdown
            const monthSelect = monthNavWrap.createEl('select', { cls: 'dropdown bills-select bills-month-select' });
            const allMonthOpt = monthSelect.createEl('option', { text: 'All Months', value: 'all' });
            if (filterOptions.selectedMonth === 'all') allMonthOpt.selected = true;

            const availableMonths = indexService.getAvailableMonths();
            if (filterOptions.selectedMonth !== 'all' && !availableMonths.includes(filterOptions.selectedMonth)) {
                availableMonths.unshift(filterOptions.selectedMonth);
            }
            for (const m of availableMonths) {
                const opt = monthSelect.createEl('option', { text: m, value: m });
                if (filterOptions.selectedMonth === m) opt.selected = true;
            }
            monthSelect.addEventListener('change', () => {
                filterOptions.selectedMonth = monthSelect.value;
                onOptionsChanged(filterOptions);
            });

            const nextMonthBtn = monthNavWrap.createEl('button', {
                cls: 'clickable-icon bills-month-step-btn',
                attr: { 'aria-label': 'Next Month' },
            });
            setIcon(nextMonthBtn, 'chevron-right');
            nextMonthBtn.addEventListener('click', () => {
                filterOptions.selectedMonth = stepMonth(filterOptions.selectedMonth, 1);
                onOptionsChanged(filterOptions);
            });

            // "Today / Current Month" Quick Jump Button
            const currentMonthStr = getCurrentMonthStr();
            if (filterOptions.selectedMonth !== currentMonthStr) {
                const todayJumpBtn = monthNavWrap.createEl('button', {
                    cls: 'pos-header-text-btn bills-today-jump-btn',
                    text: 'Current',
                    attr: { 'aria-label': `Jump to ${currentMonthStr}` },
                });
                todayJumpBtn.addEventListener('click', () => {
                    filterOptions.selectedMonth = currentMonthStr;
                    onOptionsChanged(filterOptions);
                });
            }

            // Filter Pills (Horizon Chips)
            const pillsCarousel = subRow.createEl('div', { cls: 'bills-pills-carousel' });
            const monthTrans = indexService.getAllTransactions().filter(
                (t) => filterOptions.selectedMonth === 'all' || t.dueDate.startsWith(filterOptions.selectedMonth)
            );

            const filterTabs: Array<{ id: TransactionFilterTab; label: string; count: number; countCls?: string }> = [
                { id: 'all', label: 'All Due Files', count: monthTrans.length },
                { id: 'pending', label: 'Pending', count: monthTrans.filter((t) => t.status === 'pending').length },
                {
                    id: 'due_soon',
                    label: 'Due Soon',
                    count: monthTrans.filter((t) => t.status === 'pending' && (t.urgency === 'due_soon' || t.urgency === 'due_today')).length,
                    countCls: 'bill-count--warning',
                },
                {
                    id: 'overdue',
                    label: 'Overdue',
                    count: monthTrans.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0)).length,
                    countCls: 'bill-count--danger',
                },
                { id: 'paid', label: 'Settled', count: monthTrans.filter((t) => t.status === 'paid').length, countCls: 'bill-count--success' },
            ];

            for (const fTab of filterTabs) {
                const pill = pillsCarousel.createEl('button', {
                    cls: `bills-pill ${filterOptions.activeTab === fTab.id ? 'bills-pill--active' : ''}`,
                });
                pill.createEl('span', { text: fTab.label });
                if (fTab.count > 0) {
                    pill.createEl('span', { text: String(fTab.count), cls: `bills-pill-badge ${fTab.countCls || ''}` });
                }
                pill.addEventListener('click', () => {
                    filterOptions.activeTab = fTab.id;
                    onOptionsChanged(filterOptions);
                });
            }

            // Centered Search Capsule with DIWA [ / ] Hotkey Indicator
            const searchWrapper = subRow.createEl('div', { cls: 'pos-search-container bills-search-wrapper' });
            const searchIcon = searchWrapper.createEl('span', { cls: 'pos-search-inline-icon bills-search-icon' });
            setIcon(searchIcon, 'search');

            const searchInput = searchWrapper.createEl('input', {
                type: 'text',
                placeholder: 'Search bills...',
                cls: 'pos-search-input bills-search-input',
            });
            searchInput.value = filterOptions.searchQuery;

            // Keyboard shortcut badge hint
            if (!filterOptions.searchQuery) {
                const kbdHint = searchWrapper.createEl('span', {
                    text: '/',
                    cls: 'pos-header-kbd-hint bills-search-kbd-hint',
                });
                searchInput.addEventListener('focus', () => {
                    kbdHint.style.display = 'none';
                });
                searchInput.addEventListener('blur', () => {
                    if (!searchInput.value) kbdHint.style.display = 'inline-block';
                });
            }

            // Clear button if search has value
            if (filterOptions.searchQuery) {
                const clearBtn = searchWrapper.createEl('span', {
                    cls: 'pos-search-clear',
                    attr: { 'aria-label': 'Clear search' },
                });
                setIcon(clearBtn, 'x');
                clearBtn.addEventListener('click', () => {
                    filterOptions.searchQuery = '';
                    searchInput.value = '';
                    onOptionsChanged(filterOptions);
                });
            }

            let timer: ReturnType<typeof setTimeout> | null = null;
            searchInput.addEventListener('input', () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    filterOptions.searchQuery = searchInput.value;
                    onOptionsChanged(filterOptions);
                }, 180);
            });
        }
    }
}
