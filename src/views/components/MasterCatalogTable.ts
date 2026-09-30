import { App, Menu, Notice, setIcon } from 'obsidian';
import { MasterBill, MasterFilterOptions, MasterSortField, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { BillIndexService } from '../../services/BillIndexService';
import { formatCurrency } from '../../utils/currencyUtils';
import { FREQUENCY_LABELS, CATEGORY_COLORS } from '../../constants';
import { getCurrentMonthStr, computeDueDateForMonth } from '../../utils/dateUtils';
import { EditMasterBillModal } from '../../modals/EditMasterBillModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { NewMasterBillModal } from '../../modals/NewMasterBillModal';

export class MasterCatalogTable {
    static render(
        containerEl: HTMLElement,
        app: App,
        indexService: BillIndexService,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        filterOptions: MasterFilterOptions,
        onFilterChanged: (newOptions: MasterFilterOptions) => void,
        onRefreshNeeded: () => void
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-master-table-wrapper');

        const allBills = indexService.getAllMasterBills();

        // 1. Master Toolbar: Search, Filters, Stats & CTA
        const toolbarEl = containerEl.createEl('div', { cls: 'bills-master-toolbar' });

        // Left Controls: Search & Dropdowns
        const controlsLeft = toolbarEl.createEl('div', { cls: 'bills-master-controls-left' });

        // Search Input
        const searchBox = controlsLeft.createEl('div', { cls: 'bills-table-search-box' });
        const searchIcon = searchBox.createEl('span', { cls: 'bills-table-search-icon' });
        setIcon(searchIcon, 'search');

        const searchInput = searchBox.createEl('input', {
            type: 'text',
            cls: 'bills-table-search-input',
            placeholder: 'Search master bills...',
        });
        searchInput.value = filterOptions.searchQuery;
        searchInput.addEventListener('input', () => {
            filterOptions.searchQuery = searchInput.value;
            onFilterChanged(filterOptions);
        });

        if (filterOptions.searchQuery) {
            const clearBtn = searchBox.createEl('button', {
                cls: 'clickable-icon bills-search-clear-btn',
                attr: { 'aria-label': 'Clear search' },
            });
            setIcon(clearBtn, 'x');
            clearBtn.addEventListener('click', () => {
                filterOptions.searchQuery = '';
                searchInput.value = '';
                onFilterChanged(filterOptions);
            });
        }

        // Category Filter
        const catSelect = controlsLeft.createEl('select', { cls: 'dropdown bills-select bills-table-select' });
        const allCatOpt = catSelect.createEl('option', { text: 'All Categories', value: 'all' });
        if (filterOptions.categoryFilter === 'all') allCatOpt.selected = true;

        const uniqueCategories = Array.from(new Set(allBills.map((b) => b.category))).filter(Boolean).sort();
        for (const cat of uniqueCategories) {
            const opt = catSelect.createEl('option', { text: cat, value: cat });
            if (filterOptions.categoryFilter === cat) opt.selected = true;
        }
        catSelect.addEventListener('change', () => {
            filterOptions.categoryFilter = catSelect.value;
            onFilterChanged(filterOptions);
        });

        // Frequency Filter
        const freqSelect = controlsLeft.createEl('select', { cls: 'dropdown bills-select bills-table-select' });
        const allFreqOpt = freqSelect.createEl('option', { text: 'All Cadences', value: 'all' });
        if (filterOptions.frequencyFilter === 'all') allFreqOpt.selected = true;

        for (const [k, label] of Object.entries(FREQUENCY_LABELS)) {
            const opt = freqSelect.createEl('option', { text: label, value: k });
            if (filterOptions.frequencyFilter === k) opt.selected = true;
        }
        freqSelect.addEventListener('change', () => {
            filterOptions.frequencyFilter = freqSelect.value;
            onFilterChanged(filterOptions);
        });

        // Status Filter Pills / Dropdown
        const statusSelect = controlsLeft.createEl('select', { cls: 'dropdown bills-select bills-table-select' });
        const allStatOpt = statusSelect.createEl('option', { text: 'All Statuses', value: 'all' });
        const actOpt = statusSelect.createEl('option', { text: 'Active Only', value: 'active' });
        const inactOpt = statusSelect.createEl('option', { text: 'Paused Only', value: 'inactive' });

        if (filterOptions.statusFilter === 'all') allStatOpt.selected = true;
        else if (filterOptions.statusFilter === 'active') actOpt.selected = true;
        else if (filterOptions.statusFilter === 'inactive') inactOpt.selected = true;

        statusSelect.addEventListener('change', () => {
            filterOptions.statusFilter = statusSelect.value as 'all' | 'active' | 'inactive';
            onFilterChanged(filterOptions);
        });

        // Right Controls: Count & CTA
        const controlsRight = toolbarEl.createEl('div', { cls: 'bills-master-controls-right' });

        // Filter and Sort Data
        let filtered = allBills.filter((bill) => {
            // Search query
            if (filterOptions.searchQuery) {
                const q = filterOptions.searchQuery.toLowerCase();
                const matchName = bill.name.toLowerCase().includes(q);
                const matchCat = bill.category.toLowerCase().includes(q);
                const matchMethod = (bill.paymentMethod || '').toLowerCase().includes(q);
                const matchAcc = (bill.accountNumber || '').toLowerCase().includes(q);
                if (!matchName && !matchCat && !matchMethod && !matchAcc) return false;
            }
            // Category
            if (filterOptions.categoryFilter !== 'all' && bill.category !== filterOptions.categoryFilter) {
                return false;
            }
            // Frequency
            if (filterOptions.frequencyFilter !== 'all' && bill.frequency !== filterOptions.frequencyFilter) {
                return false;
            }
            // Status
            if (filterOptions.statusFilter === 'active' && !bill.active) return false;
            if (filterOptions.statusFilter === 'inactive' && bill.active) return false;

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let res = 0;
            switch (filterOptions.sortBy) {
                case 'name':
                    res = a.name.localeCompare(b.name);
                    break;
                case 'category':
                    res = a.category.localeCompare(b.category);
                    break;
                case 'dueDay':
                    res = (a.dueDay || 0) - (b.dueDay || 0);
                    break;
                case 'frequency':
                    res = a.frequency.localeCompare(b.frequency);
                    break;
                case 'amount':
                    res = (a.defaultAmount || 0) - (b.defaultAmount || 0);
                    break;
                case 'status':
                    res = (a.active ? 1 : 0) - (b.active ? 1 : 0);
                    break;
                case 'autoPay':
                    res = (a.autoPay ? 1 : 0) - (b.autoPay ? 1 : 0);
                    break;
                default:
                    res = a.name.localeCompare(b.name);
            }
            return filterOptions.sortAsc ? res : -res;
        });

        // Count Badge
        const countBadge = controlsRight.createEl('span', {
            cls: 'bills-table-count-badge',
            text: `${filtered.length} of ${allBills.length} items`,
        });

        // Quick New Master Button
        const addBtn = controlsRight.createEl('button', {
            cls: 'mod-cta bills-btn-primary bills-btn-compact',
        });
        const plusIcon = addBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(plusIcon, 'plus');
        addBtn.createEl('span', { text: 'New Bill' });
        addBtn.addEventListener('click', () => {
            new NewMasterBillModal(app, vaultService, settings, onRefreshNeeded).open();
        });

        // 2. Empty State Handling
        if (filtered.length === 0) {
            const emptyBox = containerEl.createEl('div', { cls: 'bills-empty-state-box' });
            const emptyIcon = emptyBox.createEl('div', { cls: 'bills-empty-icon' });
            setIcon(emptyIcon, 'search');
            emptyBox.createEl('h3', {
                text: allBills.length === 0 ? 'No Master Bills Configured' : 'No Matching Master Bills',
                cls: 'bills-empty-title',
            });
            emptyBox.createEl('p', {
                text: allBills.length === 0
                    ? `Add your recurring bill items to configure schedules and generate monthly due files.`
                    : 'Try clearing your search query or changing filter options.',
                cls: 'bills-empty-desc',
            });
            return;
        }

        // 3. Compact Data Table Container
        const tableContainer = containerEl.createEl('div', { cls: 'bills-table-container' });
        const tableEl = tableContainer.createEl('table', { cls: 'bills-compact-table' });

        // Table Header with Sort Triggers
        const theadEl = tableEl.createEl('thead');
        const headerRow = theadEl.createEl('tr');

        const columns: Array<{ id: MasterSortField; label: string; cls?: string; sortable: boolean }> = [
            { id: 'status', label: 'Status', cls: 'col-status', sortable: true },
            { id: 'name', label: 'Bill Item', cls: 'col-name', sortable: true },
            { id: 'category', label: 'Category', cls: 'col-category', sortable: true },
            { id: 'dueDay', label: 'Schedule Due', cls: 'col-due', sortable: true },
            { id: 'frequency', label: 'Cadence', cls: 'col-frequency', sortable: true },
            { id: 'amount', label: 'Est. Amount', cls: 'col-amount', sortable: true },
            { id: 'name', label: 'Payment / Ref', cls: 'col-method', sortable: false },
            { id: 'name', label: 'Actions', cls: 'col-actions', sortable: false },
        ];

        for (const col of columns) {
            const th = headerRow.createEl('th', { cls: col.cls || '' });
            const titleWrap = th.createEl('div', { cls: 'bills-th-content' });
            titleWrap.createEl('span', { text: col.label });

            if (col.sortable) {
                th.addClass('bills-th--sortable');
                const sortIndicator = titleWrap.createEl('span', { cls: 'bills-sort-indicator' });
                if (filterOptions.sortBy === col.id) {
                    th.addClass('bills-th--active-sort');
                    setIcon(sortIndicator, filterOptions.sortAsc ? 'chevron-up' : 'chevron-down');
                } else {
                    setIcon(sortIndicator, 'chevrons-up-down');
                }

                th.addEventListener('click', () => {
                    if (filterOptions.sortBy === col.id) {
                        filterOptions.sortAsc = !filterOptions.sortAsc;
                    } else {
                        filterOptions.sortBy = col.id;
                        filterOptions.sortAsc = true;
                    }
                    onFilterChanged(filterOptions);
                });
            }
        }

        // Table Body
        const tbodyEl = tableEl.createEl('tbody');

        for (const bill of filtered) {
            const tr = tbodyEl.createEl('tr', {
                cls: `bills-table-row ${!bill.active ? 'bills-table-row--inactive' : ''}`,
            });

            // 1. Status & AutoPay Indicator (Interactive Toggles)
            const tdStatus = tr.createEl('td', { cls: 'col-status' });
            const statusWrap = tdStatus.createEl('div', { cls: 'bills-status-cell' });

            const statusToggleBtn = statusWrap.createEl('button', {
                cls: `bills-status-toggle-btn ${bill.active ? 'bills-status-toggle--active' : 'bills-status-toggle--paused'}`,
                attr: { 'aria-label': `Status: ${bill.active ? 'Active' : 'Paused'} (Click to toggle)` },
            });
            const activeDot = statusToggleBtn.createEl('span', {
                cls: `bills-status-dot ${bill.active ? 'bills-status-dot--active' : 'bills-status-dot--paused'}`,
            });
            statusToggleBtn.createEl('span', {
                text: bill.active ? 'Active' : 'Paused',
                cls: 'bills-status-toggle-text',
            });
            statusToggleBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await vaultService.updateMasterBill(bill.file, { active: !bill.active });
                new Notice(`${bill.name} is now ${bill.active ? 'Paused' : 'Active'}.`);
                onRefreshNeeded();
            });

            const autoPayBtn = statusWrap.createEl('button', {
                cls: `clickable-icon bills-autopay-toggle-btn ${bill.autoPay ? 'bills-autopay--on' : 'bills-autopay--off'}`,
                attr: { 'aria-label': `Auto-Pay: ${bill.autoPay ? 'Enabled' : 'Disabled'} (Click to toggle)` },
            });
            setIcon(autoPayBtn, 'zap');
            autoPayBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await vaultService.updateMasterBill(bill.file, { auto_pay: !bill.autoPay });
                new Notice(`Auto-Pay for ${bill.name} ${bill.autoPay ? 'disabled' : 'enabled'}.`);
                onRefreshNeeded();
            });

            // 2. Bill Item Name (Clickable link)
            const tdName = tr.createEl('td', { cls: 'col-name' });
            const nameLink = tdName.createEl('a', {
                cls: 'bills-table-bill-name',
                text: bill.name,
                attr: { 'aria-label': 'Click to open master note' },
            });
            nameLink.addEventListener('click', (e) => {
                e.preventDefault();
                app.workspace.openLinkText(bill.filePath, '', false);
            });

            // 3. Category (Inline Interactive Dropdown)
            const tdCat = tr.createEl('td', { cls: 'col-category' });
            const catColor = CATEGORY_COLORS[bill.category] || 'var(--interactive-accent)';

            const catSelect = tdCat.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-cat-select',
                attr: { 'aria-label': 'Change Category' },
            });
            catSelect.style.borderColor = catColor;
            catSelect.style.color = catColor;

            for (const cat of settings.categories) {
                const opt = catSelect.createEl('option', { text: cat, value: cat });
                if (bill.category === cat) opt.selected = true;
            }
            if (!settings.categories.includes(bill.category)) {
                const customOpt = catSelect.createEl('option', { text: bill.category, value: bill.category });
                customOpt.selected = true;
            }

            catSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newCat = catSelect.value;
                await vaultService.updateMasterBill(bill.file, { category: newCat });
                new Notice(`Updated ${bill.name} category to "${newCat}"`);
                onRefreshNeeded();
            });

            // 4. Due Schedule Day (Inline Interactive Dropdown)
            const tdDue = tr.createEl('td', { cls: 'col-due' });
            const dueSelect = tdDue.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-due-select',
                attr: { 'aria-label': 'Change Scheduled Due Day' },
            });

            const unassignedDueOpt = dueSelect.createEl('option', { text: 'Unset', value: '' });
            if (!bill.dueDay) unassignedDueOpt.selected = true;

            for (let d = 1; d <= 31; d++) {
                const opt = dueSelect.createEl('option', { text: `Day ${d}`, value: String(d) });
                if (bill.dueDay === d) opt.selected = true;
            }

            dueSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newDay = dueSelect.value ? parseInt(dueSelect.value, 10) : undefined;
                await vaultService.updateMasterBill(bill.file, { due_day: newDay });
                new Notice(`Updated ${bill.name} due day to ${newDay ? `Day ${newDay}` : 'Unset'}`);
                onRefreshNeeded();
            });

            // 5. Cadence / Frequency (Inline Interactive Dropdown)
            const tdFreq = tr.createEl('td', { cls: 'col-frequency' });
            const freqSelect = tdFreq.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-freq-select',
                attr: { 'aria-label': 'Change Cadence Frequency' },
            });

            for (const [k, label] of Object.entries(FREQUENCY_LABELS)) {
                const opt = freqSelect.createEl('option', { text: label, value: k });
                if (bill.frequency === k) opt.selected = true;
            }

            freqSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newFreq = freqSelect.value;
                await vaultService.updateMasterBill(bill.file, { frequency: newFreq });
                new Notice(`Updated ${bill.name} cadence to "${FREQUENCY_LABELS[newFreq as keyof typeof FREQUENCY_LABELS] || newFreq}"`);
                onRefreshNeeded();
            });

            // 6. Est. Amount & Currency (Inline Quick Editor)
            const tdAmount = tr.createEl('td', { cls: 'col-amount' });
            const amountWrap = tdAmount.createEl('div', { cls: 'bills-inline-amount-wrap' });

            const amountInput = amountWrap.createEl('input', {
                type: 'text',
                cls: 'bills-inline-amount-input',
                placeholder: '0.00',
                attr: { 'aria-label': 'Click to edit default amount' },
            });
            amountInput.value = bill.defaultAmount !== undefined && bill.defaultAmount > 0 ? String(bill.defaultAmount) : '';

            const currTag = amountWrap.createEl('span', {
                cls: 'bills-inline-currency-tag',
                text: bill.currency || settings.currencySymbol,
                attr: { 'aria-label': 'Bill currency' },
            });

            const saveAmount = async () => {
                const parsed = parseFloat(amountInput.value.replace(/[^0-9.-]/g, ''));
                const newAmt = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
                if (newAmt !== bill.defaultAmount) {
                    await vaultService.updateMasterBill(bill.file, { default_amount: newAmt });
                    new Notice(`Updated ${bill.name} estimated amount.`);
                    onRefreshNeeded();
                }
            };

            amountInput.addEventListener('blur', saveAmount);
            amountInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    amountInput.blur();
                }
            });

            // 7. Payment Method / Reference (Inline Dropdown)
            const tdMethod = tr.createEl('td', { cls: 'col-method' });
            const methodWrap = tdMethod.createEl('div', { cls: 'bills-table-method-wrap' });

            const methodSelect = methodWrap.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-method-select',
                attr: { 'aria-label': 'Change Payment Method' },
            });
            const unassignedMethodOpt = methodSelect.createEl('option', { text: '— None —', value: '' });
            if (!bill.paymentMethod) unassignedMethodOpt.selected = true;

            for (const method of settings.paymentMethods) {
                const opt = methodSelect.createEl('option', { text: method, value: method });
                if (bill.paymentMethod === method) opt.selected = true;
            }
            if (bill.paymentMethod && !settings.paymentMethods.includes(bill.paymentMethod)) {
                const customMethodOpt = methodSelect.createEl('option', { text: bill.paymentMethod, value: bill.paymentMethod });
                customMethodOpt.selected = true;
            }

            methodSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newMethod = methodSelect.value || undefined;
                await vaultService.updateMasterBill(bill.file, { payment_method: newMethod });
                new Notice(`Updated ${bill.name} payment method.`);
                onRefreshNeeded();
            });

            if (bill.accountNumber) {
                methodWrap.createEl('span', {
                    text: `#${bill.accountNumber}`,
                    cls: 'bills-table-acc-text',
                });
            }

            // 8. Actions Group (Create Due File, Edit, More Menu)
            const tdActions = tr.createEl('td', { cls: 'col-actions' });
            const actionsWrap = tdActions.createEl('div', { cls: 'bills-table-actions-cell' });

            // Create Due File CTA
            const genBtn = actionsWrap.createEl('button', {
                cls: 'bills-table-action-btn bills-table-btn-cta',
                attr: { 'aria-label': 'Generate Due File for Current Month' },
            });
            const plusIco = genBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(plusIco, 'plus-circle');
            genBtn.createEl('span', { text: 'Due File' });

            genBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMonth = getCurrentMonthStr();
                const dueDate = computeDueDateForMonth(currentMonth, bill.dueDay, bill.frequency);
                try {
                    await vaultService.createTransactionFile({
                        masterBillName: bill.name,
                        masterBillPath: bill.filePath,
                        dueDate,
                        amountDue: bill.defaultAmount,
                        currency: bill.currency,
                        category: bill.category,
                        paymentMethod: bill.paymentMethod,
                        autoPay: bill.autoPay,
                        notes: bill.notes,
                    });
                    new Notice(`Created due file for ${bill.name} (${dueDate})`);
                    onRefreshNeeded();
                } catch (err) {
                    console.error(err);
                    new Notice('Failed to create due file.');
                }
            });

            // Edit Button
            const editBtn = actionsWrap.createEl('button', {
                cls: 'clickable-icon bills-table-icon-btn',
                attr: { 'aria-label': 'Edit Master Profile' },
            });
            setIcon(editBtn, 'pencil');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new EditMasterBillModal(app, bill, vaultService, settings, onRefreshNeeded).open();
            });

            // More Options Dropdown
            const moreBtn = actionsWrap.createEl('button', {
                cls: 'clickable-icon bills-table-icon-btn',
                attr: { 'aria-label': 'More options' },
            });
            setIcon(moreBtn, 'more-vertical');
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = new Menu();

                menu.addItem((item) => {
                    item.setTitle('Open Master Note')
                        .setIcon('external-link')
                        .onClick(() => {
                            app.workspace.openLinkText(bill.filePath, '', false);
                        });
                });

                menu.addItem((item) => {
                    item.setTitle(bill.active ? 'Pause Bill Profile' : 'Resume Bill Profile')
                        .setIcon(bill.active ? 'pause-circle' : 'play-circle')
                        .onClick(async () => {
                            await vaultService.updateMasterBill(bill.file, { active: !bill.active });
                            new Notice(`${bill.name} is now ${bill.active ? 'paused' : 'active'}.`);
                            onRefreshNeeded();
                        });
                });

                menu.addSeparator();

                menu.addItem((item) => {
                    item.setTitle('Delete Master Profile')
                        .setIcon('trash-2')
                        .setWarning(true)
                        .onClick(() => {
                            new ConfirmModal(
                                app,
                                `Delete Master Bill: "${bill.name}"?`,
                                'This will move the master profile to trash. Existing generated transaction files will not be deleted.',
                                'Delete Profile',
                                true,
                                async () => {
                                    await vaultService.deleteMasterBill(bill.file);
                                    new Notice(`Deleted ${bill.name}`);
                                    onRefreshNeeded();
                                }
                            ).open();
                        });
                });

                menu.showAtMouseEvent(e);
            });
        }

        // 4. Mobile Compact Touch Tiles List (Rendered for mobile phones)
        const mobileListContainer = containerEl.createEl('div', { cls: 'bills-mobile-tiles-list' });
        for (const bill of filtered) {
            const tile = mobileListContainer.createEl('div', {
                cls: `bills-mobile-tile ${!bill.active ? 'bills-mobile-tile--paused' : ''}`,
            });

            // Top Row: Status Dot + Name + AutoPay + Category Pill + More Menu
            const tileTop = tile.createEl('div', { cls: 'bills-mobile-tile-top' });

            const topLeft = tileTop.createEl('div', { cls: 'bills-mobile-tile-left' });
            
            // Status toggle dot
            const statusDot = topLeft.createEl('span', {
                cls: `bills-status-dot ${bill.active ? 'bills-status-dot--active' : 'bills-status-dot--paused'}`,
                attr: { 'aria-label': bill.active ? 'Active (Tap to pause)' : 'Paused (Tap to activate)' },
            });
            statusDot.style.cursor = 'pointer';
            statusDot.addEventListener('click', async (e) => {
                e.stopPropagation();
                await vaultService.updateMasterBill(bill.file, { active: !bill.active });
                new Notice(`${bill.name} is now ${bill.active ? 'Paused' : 'Active'}.`);
                onRefreshNeeded();
            });

            // Name
            const nameEl = topLeft.createEl('span', { text: bill.name, cls: 'bills-mobile-tile-name' });
            nameEl.addEventListener('click', () => {
                app.workspace.openLinkText(bill.filePath, '', false);
            });

            if (bill.autoPay) {
                const zap = topLeft.createEl('span', { cls: 'bills-autopay-chip' });
                setIcon(zap, 'zap');
            }

            const topRight = tileTop.createEl('div', { cls: 'bills-mobile-tile-right' });
            
            // Category Pill
            const catColor = CATEGORY_COLORS[bill.category] || 'var(--interactive-accent)';
            const catBadge = topRight.createEl('span', {
                text: bill.category,
                cls: 'bill-badge bill-badge--category bills-table-badge',
            });
            catBadge.style.borderColor = catColor;
            catBadge.style.color = catColor;

            // More Menu Button
            const moreBtn = topRight.createEl('button', {
                cls: 'clickable-icon bills-table-icon-btn',
                attr: { 'aria-label': 'More options' },
            });
            setIcon(moreBtn, 'more-vertical');
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = new Menu();
                menu.addItem((item) => {
                    item.setTitle('Edit Profile').setIcon('pencil').onClick(() => {
                        new EditMasterBillModal(app, bill, vaultService, settings, onRefreshNeeded).open();
                    });
                });
                menu.addItem((item) => {
                    item.setTitle('Open Note').setIcon('external-link').onClick(() => {
                        app.workspace.openLinkText(bill.filePath, '', false);
                    });
                });
                menu.addItem((item) => {
                    item.setTitle(bill.active ? 'Pause Profile' : 'Resume Profile')
                        .setIcon(bill.active ? 'pause-circle' : 'play-circle')
                        .onClick(async () => {
                            await vaultService.updateMasterBill(bill.file, { active: !bill.active });
                            onRefreshNeeded();
                        });
                });
                menu.addItem((item) => {
                    item.setTitle('Delete Profile').setIcon('trash-2').setWarning(true).onClick(() => {
                        new ConfirmModal(app, `Delete "${bill.name}"?`, 'Move master profile to trash.', 'Delete', true, async () => {
                            await vaultService.deleteMasterBill(bill.file);
                            onRefreshNeeded();
                        }).open();
                    });
                });
                menu.showAtMouseEvent(e);
            });

            // Bottom Row: Due Day + Cadence + Est Amount + Due File Button
            const tileBottom = tile.createEl('div', { cls: 'bills-mobile-tile-bottom' });
            
            const scheduleInfo = tileBottom.createEl('div', { cls: 'bills-mobile-tile-schedule' });
            scheduleInfo.createEl('span', {
                text: bill.dueDay ? `Day ${bill.dueDay} • ${FREQUENCY_LABELS[bill.frequency] || bill.frequency}` : (FREQUENCY_LABELS[bill.frequency] || bill.frequency),
                cls: 'bills-mobile-tile-cadence',
            });

            if (bill.defaultAmount !== undefined && bill.defaultAmount > 0) {
                scheduleInfo.createEl('span', {
                    text: formatCurrency(bill.defaultAmount, bill.currency || settings.currencySymbol, settings.currencyCode),
                    cls: 'bills-mobile-tile-amount',
                });
            }

            // Quick Create Due File CTA
            const genBtn = tileBottom.createEl('button', {
                cls: 'bills-table-action-btn bills-table-btn-cta',
                attr: { 'aria-label': 'Generate Due File for Current Month' },
            });
            const plusIco = genBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(plusIco, 'plus-circle');
            genBtn.createEl('span', { text: '+ Due' });

            genBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMonth = getCurrentMonthStr();
                const dueDate = computeDueDateForMonth(currentMonth, bill.dueDay, bill.frequency);
                try {
                    await vaultService.createTransactionFile({
                        masterBillName: bill.name,
                        masterBillPath: bill.filePath,
                        dueDate,
                        amountDue: bill.defaultAmount,
                        currency: bill.currency,
                        category: bill.category,
                        paymentMethod: bill.paymentMethod,
                        autoPay: bill.autoPay,
                        notes: bill.notes,
                    });
                    new Notice(`Created due file for ${bill.name} (${dueDate})`);
                    onRefreshNeeded();
                } catch (err) {
                    console.error(err);
                    new Notice('Failed to create due file.');
                }
            });
        }
    }
}
