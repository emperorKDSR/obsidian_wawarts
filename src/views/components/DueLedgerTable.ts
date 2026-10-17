import { App, Menu, Notice, setIcon } from 'obsidian';
import { BillTransaction, RecurringBillsSettings, TransactionFilterOptions, TransactionSortOption } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { BillIndexService } from '../../services/BillIndexService';
import { formatCurrency } from '../../utils/currencyUtils';
import { getRelativeDueDateLabel } from '../../utils/dateUtils';
import { PayTransactionModal } from '../../modals/PayTransactionModal';
import { TransactionDetailsModal } from '../../modals/TransactionDetailsModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { BillCardItem } from './BillCardItem';
import { openNoteSafely, attachHoverPreview, openNoteActionContextMenu } from '../../utils/navigationUtils';

export class DueLedgerTable {
    static render(
        containerEl: HTMLElement,
        app: App,
        indexService: BillIndexService,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        filterOptions: TransactionFilterOptions,
        onFilterChanged: (newOptions: TransactionFilterOptions) => void,
        onRefreshNeeded: () => void,
        selectedTransactionId?: string,
        onSelectTransaction?: (trans: BillTransaction | null) => void
    ): void {
        containerEl.empty();
        containerEl.addClass('bills-due-table-wrapper');

        const filtered = indexService.getFilteredTransactions(filterOptions);

        // Check if there are overdue items to display urgent banner
        const overdue = filtered.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0));
        if (overdue.length > 0 && filterOptions.activeTab !== 'overdue') {
            const banner = containerEl.createEl('div', { cls: 'bills-urgent-banner' });
            const bIcon = banner.createEl('span', { cls: 'bills-urgent-icon' });
            setIcon(bIcon, 'alert-triangle');
            banner.createEl('span', {
                text: `${overdue.length} overdue bill${overdue.length === 1 ? '' : 's'} require payment action.`,
                cls: 'bills-urgent-text',
            });
            const filterOverdueBtn = banner.createEl('button', {
                text: 'Filter Overdue',
                cls: 'bills-urgent-btn',
            });
            filterOverdueBtn.addEventListener('click', () => {
                filterOptions.activeTab = 'overdue';
                onFilterChanged(filterOptions);
            });
        }

        if (filtered.length === 0) {
            const emptyBox = containerEl.createEl('div', { cls: 'bills-empty-state-box' });
            const icon = emptyBox.createEl('div', { cls: 'bills-empty-icon' });
            setIcon(icon, 'calendar-check-2');

            const masterBills = indexService.getAllMasterBills();
            if (masterBills.length === 0) {
                emptyBox.createEl('h3', { text: 'No Master Bills Configured', cls: 'bills-empty-title' });
                emptyBox.createEl('p', {
                    text: 'First create master bill definitions, then generate due instances for the month.',
                    cls: 'bills-empty-desc',
                });
            } else {
                emptyBox.createEl('h3', {
                    text: filterOptions.selectedMonth !== 'all' ? `No Due Files for ${filterOptions.selectedMonth}` : 'No Matching Due Files',
                    cls: 'bills-empty-title',
                });
                emptyBox.createEl('p', {
                    text: 'Generate scheduled due files from your master catalog or adjust filter options.',
                    cls: 'bills-empty-desc',
                });
            }
            return;
        }

        // =========================================================================
        // 1. DESKTOP / TABLET DENSE DATA TABLE
        // =========================================================================
        const tableContainer = containerEl.createEl('div', { cls: 'bills-table-container bills-due-table-container' });
        const tableEl = tableContainer.createEl('table', { cls: 'bills-compact-table' });

        // Table Header
        const theadEl = tableEl.createEl('thead');
        const headerRow = theadEl.createEl('tr');

        const columns: Array<{ id: TransactionSortOption; label: string; cls?: string; sortable: boolean }> = [
            { id: 'status', label: 'Status', cls: 'col-status', sortable: true },
            { id: 'name', label: 'Bill Item', cls: 'col-name', sortable: true },
            { id: 'category', label: 'Category', cls: 'col-category', sortable: true },
            { id: 'due_date', label: 'Due Date & Urgency', cls: 'col-due', sortable: true },
            { id: 'amount', label: 'Amount Due', cls: 'col-amount', sortable: true },
            { id: 'name', label: 'Payment / Ref', cls: 'col-method', sortable: false },
            { id: 'status', label: 'Settlement', cls: 'col-settled', sortable: false },
            { id: 'name', label: 'Actions', cls: 'col-actions', sortable: false },
        ];

        for (const col of columns) {
            const th = headerRow.createEl('th', { cls: col.cls || '' });
            const titleWrap = th.createEl('div', { cls: 'bills-th-content' });
            titleWrap.createEl('span', { text: col.label });

            if (col.sortable) {
                th.addClass('bills-th--sortable');
                const sortIndicator = titleWrap.createEl('span', { cls: 'bills-sort-indicator' });
                const isCurrentSort = filterOptions.sortBy === col.id;
                const isAsc = filterOptions.sortAsc !== undefined ? filterOptions.sortAsc : true;

                if (isCurrentSort) {
                    th.addClass('bills-th--active-sort');
                    setIcon(sortIndicator, isAsc ? 'chevron-up' : 'chevron-down');
                } else {
                    setIcon(sortIndicator, 'chevrons-up-down');
                }

                th.addEventListener('click', () => {
                    if (filterOptions.sortBy === col.id) {
                        filterOptions.sortAsc = !isAsc;
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

        for (const trans of filtered) {
            const isPaid = trans.status === 'paid';
            const isOverdue = trans.urgency === 'overdue';
            const isSelected = selectedTransactionId === trans.file.path;

            const tr = tbodyEl.createEl('tr', {
                cls: `bills-table-row ${isPaid ? 'is-paid' : ''} ${isOverdue ? 'is-overdue' : ''} ${isSelected ? 'is-selected' : ''}`,
            });

            // Click row to inspect (DIWA cockpit pattern)
            tr.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button, input, select, a, .clickable-icon')) {
                    return;
                }
                if (onSelectTransaction) {
                    if (isSelected) {
                        onSelectTransaction(null);
                    } else {
                        onSelectTransaction(trans);
                    }
                }
            });

            // Context menu for the whole row
            tr.addEventListener('contextmenu', (e) => {
                openNoteActionContextMenu(app, e, trans.file, (menu) => {
                    if (isPaid) {
                        menu.addItem((item) => {
                            item.setTitle('Mark as Pending')
                                .setIcon('rotate-ccw')
                                .onClick(async () => {
                                    await vaultService.toggleTransactionStatus(trans.file, 'pending');
                                    new Notice(`Reset ${trans.masterBillName} to pending.`);
                                    onRefreshNeeded();
                                });
                        });
                    } else {
                        menu.addItem((item) => {
                            item.setTitle('Record Payment')
                                .setIcon('check-circle-2')
                                .onClick(() => {
                                    new PayTransactionModal(app, trans, vaultService, settings, onRefreshNeeded).open();
                                });
                        });
                    }
                });
            });

            // 1. Status Toggle Column
            const tdStatus = tr.createEl('td', { cls: 'col-status' });
            const statusWrap = tdStatus.createEl('div', { cls: 'bills-status-toggle-wrap' });

            const statusToggleBtn = statusWrap.createEl('button', {
                cls: `bills-status-checkbox ${isPaid ? 'is-checked' : ''}`,
                attr: { 'aria-label': isPaid ? 'Settled (Click to mark pending)' : 'Pending (Click to record payment)' },
            });

            const checkIcon = statusToggleBtn.createEl('span', { cls: 'bills-checkbox-icon' });
            setIcon(checkIcon, isPaid ? 'check' : 'clock');

            statusToggleBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (isPaid) {
                    await vaultService.toggleTransactionStatus(trans.file, 'pending');
                    new Notice(`Reset ${trans.masterBillName} to pending.`);
                    onRefreshNeeded();
                } else {
                    new PayTransactionModal(app, trans, vaultService, settings, onRefreshNeeded).open();
                }
            });

            if (trans.autoPay) {
                const autoPayChip = statusWrap.createEl('span', {
                    cls: 'bills-autopay-chip',
                    attr: { 'aria-label': 'Auto-Pay Enabled' },
                });
                setIcon(autoPayChip, 'zap');
            }

            // 2. Bill Item (Safe Wikilink & Hover Preview)
            const tdName = tr.createEl('td', { cls: 'col-name' });
            const nameWrap = tdName.createEl('div', { cls: 'bills-name-cell-wrap' });

            const nameLink = nameWrap.createEl('a', {
                cls: 'internal-link bills-table-bill-name',
                text: trans.masterBillName,
                attr: { 'aria-label': `Open due note safely (${trans.file.name})` },
            });
            attachHoverPreview(app, nameLink, trans.file.path, this);
            nameLink.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await openNoteSafely(app, trans.file, e);
            });

            // Secondary subtitle showing master ref or file code
            if (trans.masterBillPath) {
                const masterSub = nameWrap.createEl('a', {
                    cls: 'internal-link bills-table-master-sub',
                    text: `[[${trans.masterBillName}]]`,
                    attr: { 'aria-label': 'Preview master bill template' },
                });
                attachHoverPreview(app, masterSub, trans.masterBillPath, this);
                masterSub.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await openNoteSafely(app, trans.masterBillPath!, e);
                });
            }

            // 3. Category (Inline Interactive Select)
            const tdCat = tr.createEl('td', { cls: 'col-category' });

            const catSelect = tdCat.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-cat-select',
                attr: { 'aria-label': 'Change Category' },
            });

            for (const cat of settings.categories) {
                const opt = catSelect.createEl('option', { text: cat, value: cat });
                if (trans.category === cat) opt.selected = true;
            }
            if (!settings.categories.includes(trans.category)) {
                const customOpt = catSelect.createEl('option', { text: trans.category, value: trans.category });
                customOpt.selected = true;
            }

            catSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newCat = catSelect.value;
                await vaultService.updateTransactionCategory(trans.file, newCat);
                new Notice(`Updated ${trans.masterBillName} category to "${newCat}"`);
                onRefreshNeeded();
            });

            // 4. Due Date & Relative Urgency
            const tdDue = tr.createEl('td', { cls: 'col-due' });
            const dueWrap = tdDue.createEl('div', { cls: 'bills-table-due-wrap' });

            dueWrap.createEl('span', {
                text: trans.dueDate,
                cls: 'bills-table-due-date-text',
            });

            dueWrap.createEl('span', {
                cls: `bill-badge bill-badge--due-status bill-badge--${isPaid ? 'success' : isOverdue ? 'danger' : trans.urgency === 'due_soon' ? 'warning' : 'neutral'} bills-table-badge`,
                text: getRelativeDueDateLabel(trans.daysUntilDue, trans.status),
            });

            // 5. Amount Due (Inline Quick Input)
            const tdAmount = tr.createEl('td', { cls: 'col-amount' });
            const amountWrap = tdAmount.createEl('div', { cls: 'bills-inline-amount-wrap' });

            const amountInput = amountWrap.createEl('input', {
                type: 'text',
                cls: 'bills-inline-amount-input',
                placeholder: '0.00',
                attr: { 'aria-label': 'Click to edit amount due' },
            });
            amountInput.value = trans.amountDue !== undefined && trans.amountDue > 0 ? String(trans.amountDue) : '';

            amountWrap.createEl('span', {
                cls: 'bills-inline-currency-tag',
                text: trans.currency || settings.currencySymbol,
            });

            const saveAmount = async () => {
                const parsed = parseFloat(amountInput.value.replace(/[^0-9.-]/g, ''));
                const newAmt = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
                if (newAmt !== trans.amountDue) {
                    await vaultService.updateTransactionAmount(trans.file, newAmt);
                    new Notice(`Updated amount for ${trans.masterBillName}.`);
                    onRefreshNeeded();
                }
            };

            amountInput.addEventListener('blur', saveAmount);
            amountInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    amountInput.blur();
                }
            });

            // 6. Payment Method & Ref
            const tdMethod = tr.createEl('td', { cls: 'col-method' });
            const methodWrap = tdMethod.createEl('div', { cls: 'bills-table-method-wrap' });

            const methodSelect = methodWrap.createEl('select', {
                cls: 'dropdown bills-inline-select bills-inline-method-select',
                attr: { 'aria-label': 'Change Payment Method' },
            });
            const unassignedMethodOpt = methodSelect.createEl('option', { text: '— None —', value: '' });
            if (!trans.paymentMethod) unassignedMethodOpt.selected = true;

            for (const method of settings.paymentMethods) {
                const opt = methodSelect.createEl('option', { text: method, value: method });
                if (trans.paymentMethod === method) opt.selected = true;
            }
            if (trans.paymentMethod && !settings.paymentMethods.includes(trans.paymentMethod)) {
                const customMethodOpt = methodSelect.createEl('option', { text: trans.paymentMethod, value: trans.paymentMethod });
                customMethodOpt.selected = true;
            }

            methodSelect.addEventListener('change', async (e) => {
                e.stopPropagation();
                const newMethod = methodSelect.value || undefined;
                await vaultService.updateTransactionPaymentMethod(trans.file, newMethod);
                new Notice(`Updated ${trans.masterBillName} payment method.`);
                onRefreshNeeded();
            });

            if (trans.referenceNo) {
                methodWrap.createEl('span', {
                    text: `#${trans.referenceNo}`,
                    cls: 'bills-table-acc-text',
                });
            }

            // 7. Settlement Info
            const tdSettled = tr.createEl('td', { cls: 'col-settled' });
            if (isPaid && trans.paidDate) {
                const settledWrap = tdSettled.createEl('div', { cls: 'bills-table-settled-wrap' });
                settledWrap.createEl('span', { text: trans.paidDate, cls: 'bills-table-settled-date' });
                if (trans.amountPaid !== undefined && trans.amountPaid > 0) {
                    settledWrap.createEl('span', {
                        text: formatCurrency(trans.amountPaid, trans.currency || settings.currencySymbol, settings.currencyCode),
                        cls: 'bills-table-settled-amount',
                    });
                }
            } else {
                tdSettled.createEl('span', { text: '—', cls: 'bills-table-unsettled-dash' });
            }

            // 8. Actions Toolbar
            const tdActions = tr.createEl('td', { cls: 'col-actions' });
            const actionsWrap = tdActions.createEl('div', { cls: 'bills-table-actions-wrap' });

            // Quick Pay Button
            if (!isPaid) {
                const payActionBtn = actionsWrap.createEl('button', {
                    cls: 'clickable-icon bills-table-icon-btn bills-action-btn--pay',
                    attr: { 'aria-label': 'Record payment' },
                });
                setIcon(payActionBtn, 'check-circle-2');
                payActionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    new PayTransactionModal(app, trans, vaultService, settings, onRefreshNeeded).open();
                });
            }

            // Inspect / Details Button
            const detailsBtn = actionsWrap.createEl('button', {
                cls: `clickable-icon bills-table-icon-btn ${isSelected ? 'is-active' : ''}`,
                attr: { 'aria-label': 'Inspect details & live notes' },
            });
            setIcon(detailsBtn, 'sidebar-close');
            detailsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onSelectTransaction) {
                    onSelectTransaction(isSelected ? null : trans);
                }
            });

            // Safe External Split Jump
            const jumpBtn = actionsWrap.createEl('button', {
                cls: 'clickable-icon bills-table-icon-btn',
                attr: { 'aria-label': 'Open in adjacent split' },
            });
            setIcon(jumpBtn, 'arrow-up-right');
            jumpBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await openNoteSafely(app, trans.file, e, { fallbackLeaf: 'split' });
            });

            // More Menu
            const moreBtn = actionsWrap.createEl('button', {
                cls: 'clickable-icon bills-table-icon-btn',
                attr: { 'aria-label': 'More options' },
            });
            setIcon(moreBtn, 'more-vertical');
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNoteActionContextMenu(app, e, trans.file, (menu) => {
                    if (trans.masterBillPath) {
                        menu.addItem((item) => {
                            item.setTitle('Open Master Bill Profile')
                                .setIcon('layers')
                                .onClick(async () => {
                                    await openNoteSafely(app, trans.masterBillPath!, undefined, { fallbackLeaf: 'split' });
                                });
                        });
                    }

                    menu.addSeparator();

                    menu.addItem((item) => {
                        item.setTitle('Delete Due File')
                            .setIcon('trash')
                            .setWarning(true)
                            .onClick(() => {
                                new ConfirmModal(
                                    app,
                                    'Delete Due File',
                                    `Are you sure you want to delete "${trans.file.name}"?`,
                                    'Delete',
                                    true,
                                    async () => {
                                        await vaultService.deleteTransaction(trans.file);
                                        new Notice(`Deleted ${trans.file.name}`);
                                        if (isSelected && onSelectTransaction) onSelectTransaction(null);
                                        onRefreshNeeded();
                                    }
                                ).open();
                            });
                    });
                });
            });
        }

        // =========================================================================
        // 2. MOBILE TOUCH CARDS LIST (Rendered for mobile phones)
        // =========================================================================
        const mobileListContainer = containerEl.createEl('div', { cls: 'bills-due-mobile-list' });
        for (const trans of filtered) {
            BillCardItem.render(mobileListContainer, app, trans, vaultService, settings, onRefreshNeeded, () => {
                if (onSelectTransaction) onSelectTransaction(trans);
            });
        }
    }
}
