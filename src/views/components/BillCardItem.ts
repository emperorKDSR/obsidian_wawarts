import { App, Menu, setIcon, Notice } from 'obsidian';
import { BillTransaction, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { formatCurrency } from '../../utils/currencyUtils';
import { CATEGORY_COLORS } from '../../constants';
import { getRelativeDueDateLabel } from '../../utils/dateUtils';
import { PayTransactionModal } from '../../modals/PayTransactionModal';
import { TransactionDetailsModal } from '../../modals/TransactionDetailsModal';
import { ConfirmModal } from '../../modals/ConfirmModal';

export class BillCardItem {
    static render(
        containerEl: HTMLElement,
        app: App,
        transaction: BillTransaction,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onRefreshNeeded: () => void
    ): HTMLElement {
        const isPaid = transaction.status === 'paid';
        const card = containerEl.createEl('div', {
            cls: `bill-card bill-card--${transaction.urgency} ${isPaid ? 'bill-card--paid' : ''}`,
        });

        // Urgency color stripe indicator
        card.createEl('div', { cls: 'bill-card-indicator' });

        // Left Content
        const mainContent = card.createEl('div', { cls: 'bill-card-content' });

        // Top Row: Bill Name & Auto-pay Badge
        const topRow = mainContent.createEl('div', { cls: 'bill-card-toprow' });
        const titleGroup = topRow.createEl('div', { cls: 'bill-card-title-group' });

        titleGroup.createEl('span', { text: transaction.masterBillName, cls: 'bill-card-name' });

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
        const catColor = CATEGORY_COLORS[transaction.category] || 'var(--interactive-accent)';
        const catPill = metaRow.createEl('span', { text: transaction.category, cls: 'bill-badge bill-badge--category' });
        catPill.style.borderColor = catColor;
        catPill.style.color = catColor;

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
                text: 'Record Pay',
                cls: 'bills-btn-action bills-btn-pay',
                attr: { 'aria-label': 'Mark Bill as Settled' },
            });
            const payIcon = payBtn.createEl('span', { cls: 'bills-btn-icon' });
            setIcon(payIcon, 'check-circle-2');

            payBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new PayTransactionModal(app, transaction, vaultService, settings, onRefreshNeeded).open();
            });
        }

        // 3-Dots Action Menu
        const moreBtn = actionsGroup.createEl('button', {
            cls: 'bills-btn-action bills-btn-more',
            attr: { 'aria-label': 'Options' },
        });
        setIcon(moreBtn, 'more-vertical');

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = new Menu();

            menu.addItem((item) => {
                item.setTitle('View Details & Notes')
                    .setIcon('file-text')
                    .onClick(() => {
                        new TransactionDetailsModal(app, transaction, vaultService, settings, onRefreshNeeded).open();
                    });
            });

            menu.addItem((item) => {
                item.setTitle('Open Transaction Note')
                    .setIcon('external-link')
                    .onClick(async () => {
                        await app.workspace.getLeaf(false).openFile(transaction.file);
                    });
            });

            menu.addSeparator();

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

            menu.addItem((item) => {
                item.setTitle('Delete Due File')
                    .setIcon('trash')
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

            menu.showAtMouseEvent(e);
        });

        card.addEventListener('click', () => {
            new TransactionDetailsModal(app, transaction, vaultService, settings, onRefreshNeeded).open();
        });

        return card;
    }
}
