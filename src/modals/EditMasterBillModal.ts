import { App, Modal, Setting, Notice } from 'obsidian';
import { MasterBill, BillFrequency, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { FREQUENCY_LABELS, COMMON_CURRENCIES } from '../constants';
import { getCurrencySymbol } from '../utils/currencyUtils';

export class EditMasterBillModal extends Modal {
    private bill: MasterBill;
    private vaultService: BillVaultService;
    private settings: RecurringBillsSettings;
    private onUpdated?: () => void;

    private name: string;
    private defaultAmount: number;
    private currency: string;
    private customCurrency: string = '';
    private frequency: BillFrequency;
    private dueDay: number;
    private category: string;
    private paymentMethod: string;
    private autoPay: boolean;
    private reminderDays: number;
    private accountNumber: string;
    private url: string;
    private active: boolean;

    constructor(
        app: App,
        bill: MasterBill,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onUpdated?: () => void
    ) {
        super(app);
        this.bill = bill;
        this.vaultService = vaultService;
        this.settings = settings;
        this.onUpdated = onUpdated;

        this.name = bill.name;
        this.defaultAmount = bill.defaultAmount ?? 0;
        this.currency = bill.currency || settings.currencyCode || settings.currencySymbol || 'USD';
        this.frequency = bill.frequency;
        this.dueDay = bill.dueDay || 1;
        this.category = bill.category;
        this.paymentMethod = bill.paymentMethod || settings.paymentMethods[0] || 'Credit Card';
        this.autoPay = bill.autoPay;
        this.reminderDays = bill.reminderDays;
        this.accountNumber = bill.accountNumber || '';
        this.url = bill.url || '';
        this.active = bill.active;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--edit-master');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: `Edit Master: ${this.bill.name}`, cls: 'bills-modal-title' });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });

        // Name
        new Setting(bodyEl)
            .setName('Bill Item Name')
            .addText((text) =>
                text.setValue(this.name).onChange((val) => {
                    this.name = val;
                })
            );

        // Currency Selector
        const matchedCurrency = COMMON_CURRENCIES.find(
            (c) => c.code.toLowerCase() === this.currency.toLowerCase() || c.symbol === this.currency
        );
        let selectedDropdownCode = matchedCurrency ? matchedCurrency.code : 'CUSTOM';
        if (selectedDropdownCode === 'CUSTOM' && !matchedCurrency) {
            this.customCurrency = this.currency;
        }

        const currencySetting = new Setting(bodyEl)
            .setName('Currency')
            .setDesc('Select or specify the currency for this specific bill')
            .addDropdown((dropdown) => {
                for (const curr of COMMON_CURRENCIES) {
                    dropdown.addOption(curr.code, curr.label);
                }
                dropdown.setValue(selectedDropdownCode);
                dropdown.onChange((val) => {
                    selectedDropdownCode = val;
                    if (val === 'CUSTOM') {
                        customCurrSetting.settingEl.style.display = 'flex';
                        this.currency = this.customCurrency || 'USD';
                    } else {
                        customCurrSetting.settingEl.style.display = 'none';
                        this.currency = val;
                    }
                    amountSetting.setDesc(`Amount in ${getCurrencySymbol(this.currency)}`);
                });
            });

        const customCurrSetting = new Setting(bodyEl)
            .setName('Custom Currency Code / Symbol')
            .setDesc('Enter custom currency code or symbol (e.g. KRW, HKD, ₪, ฿)')
            .addText((text) => {
                text.setPlaceholder('e.g. ₱, EUR, USD').setValue(this.customCurrency).onChange((val) => {
                    this.customCurrency = val.trim();
                    this.currency = this.customCurrency;
                    amountSetting.setDesc(`Amount in ${getCurrencySymbol(this.currency)}`);
                });
            });
        if (selectedDropdownCode !== 'CUSTOM') {
            customCurrSetting.settingEl.style.display = 'none';
        }

        // Default Amount
        const amountSetting = new Setting(bodyEl)
            .setName('Default / Estimated Amount')
            .setDesc(`Amount in ${getCurrencySymbol(this.currency)}`)
            .addText((text) =>
                text.setValue(String(this.defaultAmount)).onChange((val) => {
                    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
                    this.defaultAmount = isNaN(parsed) ? 0 : parsed;
                })
            );

        // Frequency
        new Setting(bodyEl)
            .setName('Frequency')
            .addDropdown((dropdown) => {
                for (const [k, v] of Object.entries(FREQUENCY_LABELS)) {
                    dropdown.addOption(k, v);
                }
                dropdown.setValue(this.frequency);
                dropdown.onChange((val) => {
                    this.frequency = val as BillFrequency;
                });
            });

        // Due Day
        new Setting(bodyEl)
            .setName('Scheduled Due Day of Month')
            .addSlider((slider) =>
                slider
                    .setLimits(1, 31, 1)
                    .setValue(this.dueDay)
                    .setDynamicTooltip()
                    .onChange((val) => {
                        this.dueDay = val;
                    })
            );

        // Category
        new Setting(bodyEl)
            .setName('Category')
            .addDropdown((dropdown) => {
                for (const cat of this.settings.categories) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.setValue(this.category);
                dropdown.onChange((val) => {
                    this.category = val;
                });
            });

        // Payment Method
        new Setting(bodyEl)
            .setName('Payment Method')
            .addDropdown((dropdown) => {
                for (const m of this.settings.paymentMethods) {
                    dropdown.addOption(m, m);
                }
                dropdown.setValue(this.paymentMethod);
                dropdown.onChange((val) => {
                    this.paymentMethod = val;
                });
            });

        // Auto Pay
        new Setting(bodyEl)
            .setName('Auto-Pay')
            .addToggle((toggle) =>
                toggle.setValue(this.autoPay).onChange((val) => {
                    this.autoPay = val;
                })
            );

        // Active Status
        new Setting(bodyEl)
            .setName('Active (Generate in monthly cycles)')
            .addToggle((toggle) =>
                toggle.setValue(this.active).onChange((val) => {
                    this.active = val;
                })
            );

        // Account Number
        new Setting(bodyEl)
            .setName('Account Number')
            .addText((text) =>
                text.setValue(this.accountNumber).onChange((val) => {
                    this.accountNumber = val;
                })
            );

        // Portal URL
        new Setting(bodyEl)
            .setName('Portal URL')
            .addText((text) =>
                text.setValue(this.url).onChange((val) => {
                    this.url = val;
                })
            );

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        const cancelBtn = footerEl.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footerEl.createEl('button', {
            text: 'Save Changes',
            cls: 'mod-cta bills-btn-primary',
        });
        saveBtn.addEventListener('click', () => this.handleSave());
    }

    private async handleSave(): Promise<void> {
        const finalCurrency = (this.currency === 'CUSTOM' ? this.customCurrency.trim() : this.currency) || this.settings.currencyCode || 'USD';

        const updates: Partial<Record<string, any>> = {
            name: this.name.trim(),
            default_amount: this.defaultAmount,
            currency: finalCurrency,
            frequency: this.frequency,
            due_day: this.dueDay,
            category: this.category,
            payment_method: this.paymentMethod,
            auto_pay: this.autoPay,
            active: this.active,
            account_number: this.accountNumber.trim() || undefined,
            url: this.url.trim() || undefined,
        };

        try {
            await this.vaultService.updateMasterBill(this.bill.file, updates);
            new Notice(`Updated master bill: ${this.bill.name}`);
            this.close();
            if (this.onUpdated) this.onUpdated();
        } catch (e) {
            console.error('Failed to update master bill:', e);
            new Notice('Failed to update master bill file.');
        }
    }
}
