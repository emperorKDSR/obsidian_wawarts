import { App, Modal, Setting, Notice } from 'obsidian';
import { MasterBill, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { BillIndexService } from '../services/BillIndexService';
import { getCurrentMonthStr, computeDueDateForMonth } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currencyUtils';

export class GenerateTransactionsModal extends Modal {
    private appInstance: App;
    private vaultService: BillVaultService;
    private indexService: BillIndexService;
    private settings: RecurringBillsSettings;
    private onGenerated?: () => void;

    private targetMonth: string;
    private selectedMasterBills: Set<string> = new Set();
    private amountOverrides: Map<string, number> = new Map();

    constructor(
        app: App,
        vaultService: BillVaultService,
        indexService: BillIndexService,
        settings: RecurringBillsSettings,
        onGenerated?: () => void
    ) {
        super(app);
        this.appInstance = app;
        this.vaultService = vaultService;
        this.indexService = indexService;
        this.settings = settings;
        this.onGenerated = onGenerated;

        this.targetMonth = getCurrentMonthStr();
        // Default select all active master bills
        for (const bill of indexService.getAllMasterBills().filter((b) => b.active)) {
            this.selectedMasterBills.add(bill.id);
            this.amountOverrides.set(bill.id, bill.defaultAmount ?? 0);
        }
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--generate');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: 'Generate Monthly Bill Due Files', cls: 'bills-modal-title' });
        headerEl.createEl('p', {
            text: 'Creates individual transactional markdown notes for each selected master bill for the target month.',
            cls: 'bills-modal-desc',
        });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });

        // Target Month Selector
        new Setting(bodyEl)
            .setName('Target Month')
            .setDesc('Select billing month (YYYY-MM)')
            .addText((text) => {
                text.inputEl.type = 'month';
                text.setValue(this.targetMonth);
                text.onChange((val) => {
                    this.targetMonth = val;
                    this.renderBillList(tableContainer);
                });
            });

        // Bills Checklist Container
        const listHeader = bodyEl.createEl('div', { cls: 'bills-gen-list-header' });
        listHeader.createEl('h3', { text: 'Master Bills to Generate', cls: 'bills-gen-list-title' });

        const selectAllBtn = listHeader.createEl('button', { text: 'Toggle All', cls: 'bills-btn-secondary' });
        selectAllBtn.addEventListener('click', () => {
            const allActive = this.indexService.getAllMasterBills().filter((b) => b.active);
            if (this.selectedMasterBills.size === allActive.length) {
                this.selectedMasterBills.clear();
            } else {
                for (const b of allActive) this.selectedMasterBills.add(b.id);
            }
            this.renderBillList(tableContainer);
        });

        const tableContainer = bodyEl.createEl('div', { cls: 'bills-gen-table-container' });
        this.renderBillList(tableContainer);

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        const cancelBtn = footerEl.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const generateBtn = footerEl.createEl('button', {
            text: `Generate Bills`,
            cls: 'mod-cta bills-btn-primary',
        });
        generateBtn.addEventListener('click', () => this.handleGenerate());
    }

    private renderBillList(container: HTMLElement): void {
        container.empty();
        const activeBills = this.indexService.getAllMasterBills().filter((b) => b.active);

        if (activeBills.length === 0) {
            container.createEl('div', {
                text: 'No active master bills found. Please create master bills first.',
                cls: 'bills-empty-state-text',
            });
            return;
        }

        for (const bill of activeBills) {
            const isChecked = this.selectedMasterBills.has(bill.id);
            const computedDueDate = computeDueDateForMonth(this.targetMonth, bill.dueDay, bill.frequency);
            const currentAmount = this.amountOverrides.get(bill.id) ?? bill.defaultAmount;

            const row = container.createEl('div', {
                cls: `bills-gen-row ${isChecked ? 'bills-gen-row--selected' : ''}`,
            });

            // Checkbox
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = isChecked;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedMasterBills.add(bill.id);
                    row.addClass('bills-gen-row--selected');
                } else {
                    this.selectedMasterBills.delete(bill.id);
                    row.removeClass('bills-gen-row--selected');
                }
            });

            // Bill Info
            const infoGroup = row.createEl('div', { cls: 'bills-gen-info' });
            infoGroup.createEl('div', { text: bill.name, cls: 'bills-gen-name' });
            infoGroup.createEl('div', {
                text: `Scheduled Due: ${computedDueDate} (${bill.category})`,
                cls: 'bills-gen-meta',
            });

            // Amount Input
            const amountWrapper = row.createEl('div', { cls: 'bills-gen-amount-wrapper' });
            amountWrapper.createEl('span', { text: this.settings.currencySymbol, cls: 'bills-gen-currency' });
            const amountInput = amountWrapper.createEl('input', {
                type: 'text',
                cls: 'bills-gen-amount-input',
            });
            amountInput.value = String(currentAmount);
            amountInput.addEventListener('input', () => {
                const parsed = parseFloat(amountInput.value.replace(/[^0-9.-]/g, ''));
                this.amountOverrides.set(bill.id, isNaN(parsed) ? 0 : parsed);
            });
        }
    }

    private async handleGenerate(): Promise<void> {
        if (!this.targetMonth) {
            new Notice('Please select a target month.');
            return;
        }

        const activeBills = this.indexService.getAllMasterBills().filter((b) => b.active);
        const selected = activeBills.filter((b) => this.selectedMasterBills.has(b.id));

        if (selected.length === 0) {
            new Notice('Please select at least one bill to generate.');
            return;
        }

        try {
            const files = await this.vaultService.batchGenerateMonthTransactions(selected, {
                targetMonth: this.targetMonth,
                selectedMasterIds: Array.from(this.selectedMasterBills),
            });

            new Notice(`Generated ${files.length} bill due files for ${this.targetMonth}`);
            this.close();
            if (this.onGenerated) this.onGenerated();
        } catch (e) {
            console.error('Failed to generate transaction files:', e);
            new Notice('Error generating transaction files.');
        }
    }
}
