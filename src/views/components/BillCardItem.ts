import { App, Menu, setIcon, Notice } from 'obsidian';
import { BillTransaction, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { formatCurrency } from '../../utils/currencyUtils';
import { getRelativeDueDateLabel } from '../../utils/dateUtils';
import { PayTransactionModal } from '../../modals/PayTransactionModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { openNoteSafely, attachHoverPreview, openNoteActionContextMenu } from '../../utils/navigationUtils';

export class BillCardItem {
    static render(
        containerEl: HTMLElement,
        app: App,
        transaction: BillTransaction,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onRefreshNeeded: () => void,
        onSelect?: () => void
    ): HTMLElement {
        const isPaid = transaction.status === 'paid';
        const card = containerEl.createEl('div', {
            cls: `bill-card bill-card--${transaction.urgency} ${isPaid ? 'bill-card--paid' : ''}`,
        });

        // Tap on card to open inspector drawer / sheet
        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, select, input, a, .clickable-icon')) {
                return;
            }
            if (onSelect) {
                onSelect();
            }
        });

        // Context menu
        card.addEventListener('contextmenu', (e) => {
            openNoteActionContextMenu(app, e, transaction.file);
        });

        // Left Content
        const mainContent = card.createEl('div', { cls: 'bill-card-content' });

        // Top Row: Bill Name & Auto-pay Badge
        const topRow = mainContent.createEl('div', { cls: 'bill-card-toprow' });
        const titleGroup = topRow.createEl('div', { cls: 'bill-card-title-group' });

        const nameLink = titleGroup.createEl('a', {
            text: transaction.masterBillName,
            cls: 'internal-link bill-card-name',
        });
        attachHoverPreview(app, nameLink, transaction.file.path, this);
        nameLink.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await openNoteSafely(app, transaction.file, e);
        });

        if (transaction.autoPay) {
            const autoPayBadge = titleGroup.createEl('span', {
                cls: 'bill-card-autopay-icon',
                attr: { 'aria-label': 'Auto-Pay Active' },
            });
            setIcon(autoPayBadge, 'zap');
        }

        // Meta Row: Category, Due Date, Payment Method
        const metaRow = mainContent.createEl('div', { cls: 'bill-card-metarow' });

        // Category Pill
        metaRow.createEl('span', { text: transaction.category, cls: 'bill-badge bill-badge--category' });

        // Due Date / Paid Date
        if (isPaid && transaction.paidDate) {
            metaRow.createEl('span', {
                text: `Settled on ${transaction.paidDate} ✓`,
                cls: 'bill-badge bill-badge--success',
            });
        } else {
            metaRow.createEl('span', {
                text: `Due: ${transaction.dueDate}`,
                cls: 'bill-card-due-date',
            });
        }

        if (transaction.paymentMethod) {
            metaRow.createEl('span', {
                text: transaction.paymentMethod,
                cls: 'bill-badge bill-badge--neutral bill-badge--method',
            });
        }

        // Right Section: Due Status Badge & Quick Actions
        const rightSection = card.createEl('div', { cls: 'bill-card-right-section' });

        const priceBlock = rightSection.createEl('div', { cls: 'bill-card-price-block' });

        if (transaction.amountDue !== undefined && transaction.amountDue > 0) {
            const amountEl = priceBlock.createEl('div', { cls: 'bill-card-amount' });
            amountEl.createEl('span', {
                text: formatCurrency(transaction.amountDue, transaction.currency || settings.currencySymbol, settings.currencyCode),
                cls: 'bill-card-amount-number',
            });
        }

        // Relative Due Status Badge
        const dueStatusBadge = priceBlock.createEl('div', {
            cls: `bill-badge bill-badge--due-status bill-badge--${isPaid ? 'success' : (transaction.urgency === 'overdue' ? 'danger' : transaction.urgency === 'due_soon' ? 'warning' : 'neutral')}`,
        });
        dueStatusBadge.setText(getRelativeDueDateLabel(transaction.daysUntilDue, transaction.status));

        // Actions Group
        const actionsGroup = rightSection.createEl('div', { cls: 'bill-card-actions-group' });

        // Quick Pay Button
        if (!isPaid) {
            const payBtn = actionsGroup.createEl('button', {
                text: 'Pay',
                cls: 'bills-btn-action bills-btn-pay',
                attr: { 'aria-label': 'Record payment' },
            });
            const payIcon = payBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(payIcon, 'check-circle-2');

            payBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new PayTransactionModal(app, transaction, vaultService, settings, onRefreshNeeded).open();
            });
        }

        // Inspect Button
        const inspectBtn = actionsGroup.createEl('button', {
            cls: 'bills-btn-action bills-btn-more',
            attr: { 'aria-label': 'Inspect details' },
        });
        setIcon(inspectBtn, 'sidebar-close');
        inspectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onSelect) onSelect();
        });

        // 3-Dots Action Menu
        const moreBtn = actionsGroup.createEl('button', {
            cls: 'bills-btn-action bills-btn-more',
            attr: { 'aria-label': 'Options' },
        });
        setIcon(moreBtn, 'more-vertical');

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openNoteActionContextMenu(app, e, transaction.file, (menu) => {
                menu.addItem((item) => {
                    item.setTitle('Inspect in Drawer')
                        .setIcon('sidebar-close')
                        .onClick(() => {
                            if (onSelect) onSelect();
                        });
                });

                if (isPaid) {
                    menu.addItem((item) => {
                        item.setTitle('Mark as Pending')
                            .setIcon('rotate-ccw')
                            .onClick(async () => {
                                await vaultService.toggleTransactionStatus(transaction.file, 'pending');
                                new Notice(`Reset ${transaction.masterBillName} to pending.`);
                                onRefreshNeeded();
                            });
                    });
                } else {
                    menu.addItem((item) => {
                        item.setTitle('Record Payment')
                            .setIcon('check')
                            .onClick(() => {
                                new PayTransactionModal(app, transaction, vaultService, settings, onRefreshNeeded).open();
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
                                `Are you sure you want to delete "${transaction.file.name}"?`,
                                'Delete',
                                true,
                                async () => {
                                    await vaultService.deleteTransaction(transaction.file);
                                    new Notice(`Deleted ${transaction.file.name}`);
                                    onRefreshNeeded();
                                }
                            ).open();
                        });
                });
            });
        });

        return card;
    }
}
