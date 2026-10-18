import { App, setIcon, Notice } from 'obsidian';
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
            cls: `bill-card bill-card--compact bill-card--${transaction.urgency} ${isPaid ? 'bill-card--paid' : ''}`,
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

        // Long-press / Context menu
        card.addEventListener('contextmenu', (e) => {
            openNoteActionContextMenu(app, e, transaction.file, (menu) => {
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

        // -----------------------------------------------------------------
        // LEFT COLUMN: Bill Name (Line 1) + Dot-separated Metadata (Line 2)
        // -----------------------------------------------------------------
        const leftCol = card.createEl('div', { cls: 'bill-card-left' });

        // Line 1: Primary Title + Auto-pay Icon
        const primaryRow = leftCol.createEl('div', { cls: 'bill-card-primary-row' });
        const nameLink = primaryRow.createEl('span', {
            text: transaction.masterBillName,
            cls: 'bill-card-name',
        });
        attachHoverPreview(app, nameLink, transaction.file.path, this);

        if (transaction.autoPay) {
            const autoPayBadge = primaryRow.createEl('span', {
                cls: 'bill-card-autopay-icon',
                attr: { 'aria-label': 'Auto-Pay Active' },
            });
            setIcon(autoPayBadge, 'zap');
        }

        // Line 2: Secondary Metadata (Due/Paid Date • Category • Payment Method)
        const secondaryRow = leftCol.createEl('div', { cls: 'bill-card-secondary-row' });

        const metaParts: string[] = [];
        if (isPaid) {
            metaParts.push(transaction.paidDate ? `Settled ${transaction.paidDate}` : 'Settled');
        } else {
            metaParts.push(`Due ${transaction.dueDate}`);
        }

        if (transaction.category) {
            metaParts.push(transaction.category);
        }

        if (transaction.paymentMethod) {
            metaParts.push(transaction.paymentMethod);
        }

        secondaryRow.createEl('span', {
            text: metaParts.join(' • '),
            cls: 'bill-card-meta-text',
        });

        // -----------------------------------------------------------------
        // RIGHT COLUMN: Amount (Line 1) + Status Pill / Text (Line 2)
        // -----------------------------------------------------------------
        const rightCol = card.createEl('div', { cls: 'bill-card-right' });

        // Line 1: Amount
        const amountEl = rightCol.createEl('div', { cls: 'bill-card-amount' });
        if (transaction.amountDue !== undefined && transaction.amountDue > 0) {
            amountEl.createEl('span', {
                text: formatCurrency(transaction.amountDue, transaction.currency || settings.currencySymbol, settings.currencyCode),
                cls: 'bill-card-amount-number',
            });
        } else {
            amountEl.createEl('span', {
                text: '—',
                cls: 'bill-card-amount-empty',
            });
        }

        // Line 2: Relative Status / Action Badge
        const statusRow = rightCol.createEl('div', { cls: 'bill-card-status-row' });
        if (isPaid) {
            statusRow.createEl('span', {
                text: '✓ Settled',
                cls: 'bill-card-status-text is-paid',
            });
        } else if (transaction.urgency === 'overdue') {
            statusRow.createEl('span', {
                text: 'Overdue',
                cls: 'bill-card-status-badge is-overdue',
            });
        } else if (transaction.urgency === 'due_soon' || transaction.urgency === 'due_today') {
            statusRow.createEl('span', {
                text: getRelativeDueDateLabel(transaction.daysUntilDue, transaction.status),
                cls: 'bill-card-status-badge is-due-soon',
            });
        } else {
            statusRow.createEl('span', {
                text: getRelativeDueDateLabel(transaction.daysUntilDue, transaction.status),
                cls: 'bill-card-status-text',
            });
        }

        return card;
    }
}
