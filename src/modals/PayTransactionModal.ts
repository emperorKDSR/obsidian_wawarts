import { App, Modal, Setting, Notice } from 'obsidian';
import { BillTransaction, PayTransactionInput, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { getTodayDateStr } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currencyUtils';

export class PayTransactionModal extends Modal {
    private transaction: BillTransaction;
    private vaultService: BillVaultService;
    private settings: RecurringBillsSettings;
    private onPaid?: () => void;

    private paidDate: string;
    private amountPaid: number;
    private paymentMethod: string;
    private referenceNo: string = '';
    private notes: string = '';

    constructor(
        app: App,
        transaction: BillTransaction,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onPaid?: () => void
    ) {
        super(app);
        this.transaction = transaction;
        this.vaultService = vaultService;
        this.settings = settings;
        this.onPaid = onPaid;

        this.paidDate = getTodayDateStr();
        this.amountPaid = transaction.amountDue ?? 0;
        this.paymentMethod = transaction.paymentMethod || settings.paymentMethods[0] || 'Credit Card';
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--pay');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: `Record Payment: ${this.transaction.masterBillName}`, cls: 'bills-modal-title' });

        const billCurrency = this.transaction.currency || this.settings.currencySymbol || this.settings.currencyCode || '$';

        const summaryRow = headerEl.createEl('div', { cls: 'bills-modal-payment-summary' });
        summaryRow.createEl('span', {
            text: `Due: ${formatCurrency(this.transaction.amountDue, billCurrency)}`,
            cls: 'bill-badge bill-badge--neutral',
        });
        summaryRow.createEl('span', {
            text: `Scheduled Date: ${this.transaction.dueDate}`,
            cls: 'bill-badge bill-badge--neutral',
        });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });

        // Paid Date
        new Setting(bodyEl)
            .setName('Payment Date')
            .setDesc('When was this transaction settled?')
            .addText((text) => {
                text.inputEl.type = 'date';
                text.setValue(this.paidDate);
                text.onChange((val) => {
                    this.paidDate = val;
                });
            });

        // Amount Paid
        new Setting(bodyEl)
            .setName('Amount Paid')
            .setDesc(`Actual amount paid (${billCurrency})`)
            .addText((text) =>
                text.setValue(String(this.amountPaid)).onChange((val) => {
                    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
                    this.amountPaid = isNaN(parsed) ? 0 : parsed;
                })
            );

        // Payment Method
        new Setting(bodyEl)
            .setName('Payment Source / Method')
            .addDropdown((dropdown) => {
                for (const method of this.settings.paymentMethods) {
                    dropdown.addOption(method, method);
                }
                dropdown.setValue(this.paymentMethod);
                dropdown.onChange((val) => {
                    this.paymentMethod = val;
                });
            });

        // Reference Number
        new Setting(bodyEl)
            .setName('Confirmation / Ref Code')
            .setDesc('Optional bank reference or confirmation number')
            .addText((text) =>
                text
                    .setPlaceholder('CONF-987654')
                    .setValue(this.referenceNo)
                    .onChange((val) => {
                        this.referenceNo = val;
                    })
            );

        // Notes
        new Setting(bodyEl)
            .setName('Payment Notes')
            .setDesc('Appends directly to this transaction file')
            .addTextArea((textarea) => {
                textarea.inputEl.rows = 2;
                textarea
                    .setPlaceholder('Notes, discount details, or reconciliation info...')
                    .setValue(this.notes)
                    .onChange((val) => {
                        this.notes = val;
                    });
            });

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        const cancelBtn = footerEl.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const confirmBtn = footerEl.createEl('button', {
            text: 'Confirm & Mark Paid',
            cls: 'mod-cta bills-btn-success',
        });
        confirmBtn.addEventListener('click', () => this.handleSave());

        modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleSave();
            }
        });
    }

    private async handleSave(): Promise<void> {
        if (!this.paidDate) {
            new Notice('Please select a payment date.');
            return;
        }

        const input: PayTransactionInput = {
            paidDate: this.paidDate,
            amountPaid: this.amountPaid,
            paymentMethod: this.paymentMethod,
            referenceNo: this.referenceNo.trim() || undefined,
            notes: this.notes.trim() || undefined,
        };

        try {
            await this.vaultService.payTransaction(this.transaction.file, input);
            new Notice(`Marked ${this.transaction.masterBillName} as paid on ${this.paidDate}`);
            this.close();
            if (this.onPaid) this.onPaid();
        } catch (e) {
            console.error('Failed to record payment on file:', e);
            new Notice('Error updating transaction file.');
        }
    }
}
