import { setIcon } from 'obsidian';
import { HubTab, TransactionFilterOptions, TransactionFilterTab, TransactionSortOption } from '../../types';
import { BillIndexService } from '../../services/BillIndexService';

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

        // Left: Navigation Tabs
        const tabsGroup = topRow.createEl('div', { cls: 'bills-nav-tabs' });

        const navTabs: Array<{ id: HubTab; label: string; icon: string; count?: number }> = [
            { id: 'transactions', label: 'Due Ledger', icon: 'list-checks', count: indexService.getAllTransactions().filter((t) => t.status === 'pending').length },
            { id: 'master', label: 'Master Catalog', icon: 'layers', count: indexService.getAllMasterBills().length },
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
            cls: 'mod-cta bills-btn-primary bills-gen-btn',
        });
        const zapIcon = genBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(zapIcon, 'sparkles');
        genBtn.createEl('span', { text: 'Generate Due Files' });
        genBtn.addEventListener('click', onOpenGenerateModal);

        // Add Master Bill Button
        const addMasterBtn = actionGroup.createEl('button', {
            cls: 'bills-btn-secondary',
        });
        const plusIcon = addMasterBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(plusIcon, 'plus');
        addMasterBtn.createEl('span', { text: 'New Master Bill' });
        addMasterBtn.addEventListener('click', onOpenNewMasterModal);

        // Folder & Settings Button
        if (onOpenSettingsModal) {
            const settingsBtn = actionGroup.createEl('button', {
                cls: 'bills-btn-secondary bills-btn-icon-only',
                attr: { 'aria-label': 'Folder Locations & Settings' },
            });
            const settingsIcon = settingsBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(settingsIcon, 'settings');
            settingsBtn.addEventListener('click', onOpenSettingsModal);
        }

        // Second Row: Search + Status Filter Pills (Only visible in 'transactions' tab)
        if (currentTab === 'transactions') {
            const subRow = containerEl.createEl('div', { cls: 'bills-filter-bottomrow' });

            // Month Selector
            const monthSelect = subRow.createEl('select', { cls: 'dropdown bills-select' });
            const allMonthOpt = monthSelect.createEl('option', { text: 'All Months', value: 'all' });
            if (filterOptions.selectedMonth === 'all') allMonthOpt.selected = true;

            const availableMonths = indexService.getAvailableMonths();
            for (const m of availableMonths) {
                const opt = monthSelect.createEl('option', { text: m, value: m });
                if (filterOptions.selectedMonth === m) opt.selected = true;
            }
            monthSelect.addEventListener('change', () => {
                filterOptions.selectedMonth = monthSelect.value;
                onOptionsChanged(filterOptions);
            });

            // Filter Pills
            const pillsCarousel = subRow.createEl('div', { cls: 'bills-pills-carousel' });
            const monthTrans = indexService.getAllTransactions().filter((t) => filterOptions.selectedMonth === 'all' || t.dueDate.startsWith(filterOptions.selectedMonth));

            const filterTabs: Array<{ id: TransactionFilterTab; label: string; count: number; countCls?: string }> = [
                { id: 'all', label: 'All Due Files', count: monthTrans.length },
                { id: 'pending', label: 'Pending', count: monthTrans.filter((t) => t.status === 'pending').length },
                { id: 'due_soon', label: 'Due Soon', count: monthTrans.filter((t) => t.status === 'pending' && (t.urgency === 'due_soon' || t.urgency === 'due_today')).length, countCls: 'bill-count--warning' },
                { id: 'overdue', label: 'Overdue', count: monthTrans.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0)).length, countCls: 'bill-count--danger' },
                { id: 'paid', label: 'Settled / Paid', count: monthTrans.filter((t) => t.status === 'paid').length },
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

            // Search Bar
            const searchWrapper = subRow.createEl('div', { cls: 'bills-search-wrapper' });
            const searchIcon = searchWrapper.createEl('span', { cls: 'bills-search-icon' });
            setIcon(searchIcon, 'search');

            const searchInput = searchWrapper.createEl('input', {
                type: 'text',
                placeholder: 'Search files, notes...',
                cls: 'bills-search-input',
            });
            searchInput.value = filterOptions.searchQuery;

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
