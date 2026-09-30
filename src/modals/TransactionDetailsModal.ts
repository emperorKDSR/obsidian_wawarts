import { App, Modal, Notice, setIcon } from 'obsidian';
import { BillTransaction, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { formatCurrency } from '../utils/currencyUtils';
import { getRelativeDueDateLabel } from '../utils/dateUtils';
import { PayTransactionModal } from './PayTransactionModal';
import { ConfirmModal } from './ConfirmModal';

export class TransactionDetailsModal extends Modal {
    private transaction: BillTransaction;
    private vaultService: BillVaultService;
    private settings: RecurringBillsSettings;
    private onAction?: () => void;

    constructor(
        app: App,
        transaction: BillTransaction,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onAction?: () => void
    ) {
        super(app);
        this.transaction = transaction;
        this.vaultService = vaultService;
        this.settings = settings;
        this.onAction = onAction;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--details');
        contentEl.empty();

        const topBar = contentEl.createEl('div', { cls: 'bills-details-topbar' });
        const titleArea = topBar.createEl('div', { cls: 'bills-details-title-area' });

        titleArea.createEl('h2', { text: this.transaction.masterBillName, cls: 'bills-details-title' });

        const badgeRow = titleArea.createEl('div', { cls: 'bills-details-badge-row' });
        
        // Status Badge
        const statusBadge = badgeRow.createEl('span', {
            text: this.transaction.status === 'paid' ? 'Paid ✓' : (this.transaction.urgency === 'overdue' ? 'Overdue ⚠️' : 'Pending ⏳'),
            cls: `bill-badge bill-badge--${this.transaction.status === 'paid' ? 'success' : (this.transaction.urgency === 'overdue' ? 'danger' : 'warning')}`,
        });

        // Category Badge
        badgeRow.createEl('span', {
            text: this.transaction.category,
            cls: 'bill-badge bill-badge--neutral',
        });

        if (this.transaction.autoPay) {
            badgeRow.createEl('span', {
                text: '⚡ Auto-Pay',
                cls: 'bill-badge bill-badge--purple',
            });
        }

        // Hero Amount Box
        const heroBox = contentEl.createEl('div', { cls: 'bills-details-herobox' });
        const heroLeft = heroBox.createEl('div', { cls: 'bills-details-hero-left' });
        
        heroLeft.createEl('div', {
            text: formatCurrency(this.transaction.amountDue, this.transaction.currency || this.settings.currencySymbol || this.settings.currencyCode),
            cls: 'bills-details-hero-amount',
        });
        heroLeft.createEl('div', {
            text: `Due: ${this.transaction.dueDate} (${getRelativeDueDateLabel(this.transaction.daysUntilDue, this.transaction.status)})`,
            cls: 'bills-details-hero-freq',
        });

        const heroRight = heroBox.createEl('div', { cls: 'bills-details-hero-right' });
        if (this.transaction.status !== 'paid') {
            const payBtn = heroRight.createEl('button', {
                text: 'Record Payment',
                cls: 'mod-cta bills-btn-success bills-details-pay-btn',
            });
            payBtn.addEventListener('click', () => {
                this.close();
                new PayTransactionModal(this.app, this.transaction, this.vaultService, this.settings, this.onAction).open();
            });
        } else {
            const undoBtn = heroRight.createEl('button', {
                text: 'Mark as Pending',
                cls: 'bills-btn-secondary',
            });
            undoBtn.addEventListener('click', async () => {
                await this.vaultService.toggleTransactionStatus(this.transaction.file, 'pending');
                new Notice(`Reset ${this.transaction.masterBillName} to pending.`);
                this.close();
                if (this.onAction) this.onAction();
            });
        }

        // Details Grid
        const grid = contentEl.createEl('div', { cls: 'bills-details-grid' });
        this.renderGridItem(grid, 'Due Date', this.transaction.dueDate);
        this.renderGridItem(grid, 'Paid Date', this.transaction.paidDate || 'Not paid yet');
        this.renderGridItem(grid, 'Amount Paid', this.transaction.amountPaid !== undefined ? formatCurrency(this.transaction.amountPaid, this.settings.currencySymbol) : '—');
        this.renderGridItem(grid, 'Payment Method', this.transaction.paymentMethod || 'Unspecified');
        if (this.transaction.referenceNo) {
            this.renderGridItem(grid, 'Reference Code', this.transaction.referenceNo);
        }
        this.renderGridItem(grid, 'Note File', this.transaction.file.name);

        // Action Toolbar
        const actionToolbar = contentEl.createEl('div', { cls: 'bills-details-action-toolbar' });

        const openFileBtn = actionToolbar.createEl('button', { text: 'Open Transaction Note', cls: 'bills-btn-secondary' });
        openFileBtn.addEventListener('click', async () => {
            this.close();
            await this.app.workspace.getLeaf(false).openFile(this.transaction.file);
        });

        const deleteBtn = actionToolbar.createEl('button', { text: 'Delete Due File', cls: 'bills-btn-danger' });
        deleteBtn.addEventListener('click', () => {
            new ConfirmModal(
                this.app,
                'Delete Due File',
                `Are you sure you want to delete this bill instance note "${this.transaction.file.name}"?`,
                'Delete',
                true,
                async () => {
                    await this.vaultService.deleteTransaction(this.transaction.file);
                    new Notice(`Deleted ${this.transaction.file.name}`);
                    this.close();
                    if (this.onAction) this.onAction();
                }
            ).open();
        });
    }

    private renderGridItem(container: HTMLElement, label: string, value: string): void {
        const item = container.createEl('div', { cls: 'bills-details-grid-item' });
        item.createEl('div', { text: label, cls: 'bills-details-grid-label' });
        item.createEl('div', { text: value, cls: 'bills-details-grid-value' });
    }
}
