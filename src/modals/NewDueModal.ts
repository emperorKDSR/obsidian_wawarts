import { App, Modal, Setting, Notice } from 'obsidian';
import { MasterBill, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { BillIndexService } from '../services/BillIndexService';
import { getCurrentMonthStr, computeDueDateForMonth } from '../utils/dateUtils';
import { GenerateTransactionsModal } from './GenerateTransactionsModal';

export class NewDueModal extends Modal {
    private vaultService: BillVaultService;
    private indexService: BillIndexService;
    private settings: RecurringBillsSettings;
    private onCreated?: () => void;

    private selectedMasterId: string = '';
    private dueName: string = '';
    private dueDate: string = '';
    private amountDue: number = 0;
    private currency: string = '';
    private category: string = '';
    private paymentMethod: string = '';
    private notes: string = '';

    constructor(
        app: App,
        vaultService: BillVaultService,
        indexService: BillIndexService,
        settings: RecurringBillsSettings,
        onCreated?: () => void
    ) {
        super(app);
        this.vaultService = vaultService;
        this.indexService = indexService;
        this.settings = settings;
        this.onCreated = onCreated;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        this.dueDate = `${yyyy}-${mm}-${dd}`;

        this.currency = settings.currencyCode || settings.currencySymbol || 'USD';
        this.category = settings.defaultCategory || settings.categories[0] || 'General';
        this.paymentMethod = settings.paymentMethods[0] || 'Credit Card';

        const activeBills = indexService.getAllMasterBills().filter((b) => b.active);
        if (activeBills.length > 0) {
            this.selectedMasterId = activeBills[0].id;
            this.applyMasterBill(activeBills[0]);
        }
    }

    private applyMasterBill(bill: MasterBill): void {
        this.dueName = bill.name;
        this.amountDue = bill.defaultAmount ?? 0;
        if (bill.currency) this.currency = bill.currency;
        if (bill.category) this.category = bill.category;
        if (bill.paymentMethod) this.paymentMethod = bill.paymentMethod;
        const currentMonth = getCurrentMonthStr();
        this.dueDate = computeDueDateForMonth(currentMonth, bill.dueDay, bill.frequency);
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--due');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: 'Add New Due', cls: 'bills-modal-title' });
        headerEl.createEl('p', {
            text: 'Create an individual due note for an upcoming payment or one-off expense.',
            cls: 'bills-modal-desc',
        });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });
        const activeBills = this.indexService.getAllMasterBills().filter((b) => b.active);

        // 1. Master Bill Source Dropdown
        const masterSetting = new Setting(bodyEl)
            .setName('Master Bill Template')
            .setDesc('Select an existing recurring bill or choose One-off Expense')
            .addDropdown((dropdown) => {
                if (activeBills.length > 0) {
                    for (const b of activeBills) {
                        dropdown.addOption(b.id, `${b.name} (${b.category})`);
                    }
                }
                dropdown.addOption('custom', '-- One-off / Ad-hoc Due --');
                dropdown.setValue(this.selectedMasterId || 'custom');

                dropdown.onChange((val) => {
                    this.selectedMasterId = val;
                    if (val === 'custom') {
                        this.dueName = '';
                        this.amountDue = 0;
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        this.dueDate = `${yyyy}-${mm}-${dd}`;
                    } else {
                        const bill = activeBills.find((b) => b.id === val);
                        if (bill) this.applyMasterBill(bill);
                    }
                    this.onOpen();
                });
            });

        // 2. Bill / Due Name
        new Setting(bodyEl)
            .setName('Due Name')
            .setDesc('Name of the bill item')
            .addText((text) => {
                text.setPlaceholder('e.g. Netflix, Rent, Groceries')
                    .setValue(this.dueName)
                    .onChange((val) => {
                        this.dueName = val.trim();
                    });
            });

        // 3. Due Date
        new Setting(bodyEl)
            .setName('Due Date')
            .setDesc('Target due date (YYYY-MM-DD)')
            .addText((text) => {
                text.inputEl.type = 'date';
                text.setValue(this.dueDate);
                text.onChange((val) => {
                    this.dueDate = val;
                });
            });

        // 4. Amount Due
        new Setting(bodyEl)
            .setName('Amount Due')
            .setDesc(`Amount payable in ${this.currency}`)
            .addText((text) => {
                text.setPlaceholder('0.00')
                    .setValue(this.amountDue > 0 ? String(this.amountDue) : '')
                    .onChange((val) => {
                        const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
                        this.amountDue = isNaN(parsed) ? 0 : parsed;
                    });
            });

        // 5. Category
        new Setting(bodyEl)
            .setName('Category')
            .setDesc('Expense classification')
            .addDropdown((dropdown) => {
                const cats = Array.from(
                    new Set([...(this.settings.categories || []), this.category, 'General'])
                ).filter(Boolean);
                for (const cat of cats) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.setValue(this.category);
                dropdown.onChange((val) => {
                    this.category = val;
                });
            });

        // 6. Payment Method
        new Setting(bodyEl)
            .setName('Payment Method')
            .setDesc('Intended payment source')
            .addDropdown((dropdown) => {
                const methods = Array.from(
                    new Set([...(this.settings.paymentMethods || []), this.paymentMethod, 'Other'])
                ).filter(Boolean);
                for (const m of methods) {
                    dropdown.addOption(m, m);
                }
                dropdown.setValue(this.paymentMethod);
                dropdown.onChange((val) => {
                    this.paymentMethod = val;
                });
            });

        // 7. Notes
        new Setting(bodyEl)
            .setName('Notes (Optional)')
            .setDesc('Additional context or reference')
            .addTextArea((textarea) => {
                textarea.setValue(this.notes).onChange((val) => {
                    this.notes = val;
                });
                textarea.inputEl.rows = 2;
            });

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });

        // Left button: Batch Generator shortcut
        const batchBtn = footerEl.createEl('button', {
            text: 'Batch Generate Month...',
            cls: 'bills-btn-secondary bills-modal-extra-btn',
        });
        batchBtn.addEventListener('click', () => {
            this.close();
            new GenerateTransactionsModal(
                this.app,
                this.vaultService,
                this.indexService,
                this.settings,
                this.onCreated
            ).open();
        });

        const rightBtns = footerEl.createEl('div', { cls: 'bills-modal-footer-right' });
        const cancelBtn = rightBtns.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const createBtn = rightBtns.createEl('button', {
            text: 'Create Due',
            cls: 'mod-cta bills-btn-primary',
        });
        createBtn.addEventListener('click', () => this.handleCreate());
    }

    private async handleCreate(): Promise<void> {
        if (!this.dueName) {
            new Notice('Please specify a due name.');
            return;
        }
        if (!this.dueDate) {
            new Notice('Please specify a due date.');
            return;
        }

        const activeBills = this.indexService.getAllMasterBills().filter((b) => b.active);
        const masterBill = activeBills.find((b) => b.id === this.selectedMasterId);

        try {
            await this.vaultService.createTransactionFile({
                masterBillName: this.dueName,
                masterBillPath: masterBill ? masterBill.filePath : undefined,
                dueDate: this.dueDate,
                amountDue: this.amountDue,
                currency: this.currency,
                category: this.category,
                paymentMethod: this.paymentMethod,
                notes: this.notes,
            });

            new Notice(`Created due: ${this.dueName} (${this.dueDate})`);
            this.close();
            if (this.onCreated) {
                this.onCreated();
            }
        } catch (e) {
            console.error('Failed to create due file:', e);
            new Notice('Error creating due file.');
        }
    }
}
