import { App, Modal, Setting, Notice } from 'obsidian';
import { BillFrequency, NewMasterBillInput, RecurringBillsSettings } from '../types';
import { BillVaultService } from '../services/BillVaultService';
import { FREQUENCY_LABELS, COMMON_CURRENCIES } from '../constants';
import { getCurrencySymbol } from '../utils/currencyUtils';

export class NewMasterBillModal extends Modal {
    private vaultService: BillVaultService;
    private settings: RecurringBillsSettings;
    private onCreated?: (file: any) => void;

    private name: string = '';
    private defaultAmount: number = 0;
    private currency: string = 'USD';
    private customCurrency: string = '';
    private frequency: BillFrequency = 'monthly';
    private dueDay: number = 1;
    private category: string = '';
    private paymentMethod: string = '';
    private autoPay: boolean = false;
    private reminderDays: number = 3;
    private accountNumber: string = '';
    private url: string = '';
    private notes: string = '';
    private customCategory: string = '';

    constructor(
        app: App,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onCreated?: (file: any) => void
    ) {
        super(app);
        this.vaultService = vaultService;
        this.settings = settings;
        this.onCreated = onCreated;
        this.currency = settings.currencyCode || settings.currencySymbol || 'USD';
        this.category = settings.defaultCategory || settings.categories[0] || 'Subscriptions';
        this.paymentMethod = settings.paymentMethods[0] || 'Credit Card';
        this.reminderDays = settings.defaultReminderDays || 3;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--master');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: 'Add Master Bill Item', cls: 'bills-modal-title' });
        headerEl.createEl('p', {
            text: 'Define a recurring bill template in your master catalog. You will generate monthly due files from this profile.',
            cls: 'bills-modal-desc',
        });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });

        // Bill Name
        new Setting(bodyEl)
            .setName('Bill Item Name')
            .setDesc('e.g. Netflix, Electricity, Rent, Spotify, Internet')
            .addText((text) =>
                text
                    .setPlaceholder('Enter bill name...')
                    .setValue(this.name)
                    .onChange((val) => {
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
                    amountSetting.setDesc(`Estimated recurring cost (${getCurrencySymbol(this.currency)})`);
                });
            });

        const customCurrSetting = new Setting(bodyEl)
            .setName('Custom Currency Code / Symbol')
            .setDesc('Enter custom currency code or symbol (e.g. KRW, HKD, ₪, ฿)')
            .addText((text) => {
                text.setPlaceholder('e.g. ₱, EUR, USD').setValue(this.customCurrency).onChange((val) => {
                    this.customCurrency = val.trim();
                    this.currency = this.customCurrency;
                    amountSetting.setDesc(`Estimated recurring cost (${getCurrencySymbol(this.currency)})`);
                });
            });
        if (selectedDropdownCode !== 'CUSTOM') {
            customCurrSetting.settingEl.style.display = 'none';
        }

        // Default Amount
        const amountSetting = new Setting(bodyEl)
            .setName('Default / Estimated Amount')
            .setDesc(`Estimated recurring cost (${getCurrencySymbol(this.currency)})`)
            .addText((text) =>
                text
                    .setPlaceholder('0.00')
                    .setValue(this.defaultAmount > 0 ? String(this.defaultAmount) : '')
                    .onChange((val) => {
                        const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
                        this.defaultAmount = isNaN(parsed) ? 0 : parsed;
                    })
            );

        // Billing Frequency
        new Setting(bodyEl)
            .setName('Billing Frequency')
            .setDesc('How frequently is this bill charged?')
            .addDropdown((dropdown) => {
                for (const [key, label] of Object.entries(FREQUENCY_LABELS)) {
                    dropdown.addOption(key, label);
                }
                dropdown.setValue(this.frequency);
                dropdown.onChange((val) => {
                    this.frequency = val as BillFrequency;
                });
            });

        // Scheduled Due Day of Month
        new Setting(bodyEl)
            .setName('Scheduled Due Day of Month')
            .setDesc('Day of the month when this bill is typically due (1 - 31)')
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
            .setDesc('Group in financial breakdown')
            .addDropdown((dropdown) => {
                for (const cat of this.settings.categories) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.addOption('__custom__', '+ Add New Category...');
                dropdown.setValue(this.category);
                dropdown.onChange((val) => {
                    if (val === '__custom__') {
                        this.category = '__custom__';
                        customCatSetting.settingEl.style.display = 'flex';
                    } else {
                        this.category = val;
                        customCatSetting.settingEl.style.display = 'none';
                    }
                });
            });

        const customCatSetting = new Setting(bodyEl)
            .setName('New Category Name')
            .addText((text) => {
                text.setPlaceholder('Category name...').onChange((val) => {
                    this.customCategory = val;
                });
            });
        customCatSetting.settingEl.style.display = 'none';

        // Payment Method
        new Setting(bodyEl)
            .setName('Default Payment Method')
            .setDesc('Card or bank account used')
            .addDropdown((dropdown) => {
                for (const method of this.settings.paymentMethods) {
                    dropdown.addOption(method, method);
                }
                dropdown.setValue(this.paymentMethod);
                dropdown.onChange((val) => {
                    this.paymentMethod = val;
                });
            });

        // Auto Pay Toggle
        new Setting(bodyEl)
            .setName('Auto-Pay Enabled')
            .setDesc('Is this bill automatically debited?')
            .addToggle((toggle) =>
                toggle.setValue(this.autoPay).onChange((val) => {
                    this.autoPay = val;
                })
            );

        // Account Number / Reference
        new Setting(bodyEl)
            .setName('Account / Reference Number')
            .setDesc('Optional utility account number or customer ID')
            .addText((text) =>
                text
                    .setPlaceholder('ACC-12345')
                    .setValue(this.accountNumber)
                    .onChange((val) => {
                        this.accountNumber = val;
                    })
            );

        // Billing Portal URL
        new Setting(bodyEl)
            .setName('Payment Portal URL')
            .addText((text) =>
                text
                    .setPlaceholder('https://...')
                    .setValue(this.url)
                    .onChange((val) => {
                        this.url = val;
                    })
            );

        // Notes
        new Setting(bodyEl)
            .setName('Notes & Plan Details')
            .addTextArea((textarea) => {
                textarea.inputEl.rows = 2;
                textarea
                    .setPlaceholder('Plan terms, instructions, customer support contact...')
                    .setValue(this.notes)
                    .onChange((val) => {
                        this.notes = val;
                    });
            });

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        const cancelBtn = footerEl.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const createBtn = footerEl.createEl('button', {
            text: 'Save Master Bill',
            cls: 'mod-cta bills-btn-primary',
        });
        createBtn.addEventListener('click', () => this.handleSave());

        modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleSave();
            }
        });
    }

    private async handleSave(): Promise<void> {
        if (!this.name.trim()) {
            new Notice('Please enter a bill name.');
            return;
        }

        const finalCurrency = (this.currency === 'CUSTOM' ? this.customCurrency.trim() : this.currency) || this.settings.currencyCode || 'USD';
        const finalCategory = this.category === '__custom__' ? (this.customCategory.trim() || 'Other') : this.category;

        const input: NewMasterBillInput = {
            name: this.name.trim(),
            defaultAmount: this.defaultAmount,
            currency: finalCurrency,
            category: finalCategory,
            frequency: this.frequency,
            dueDay: this.dueDay,
            paymentMethod: this.paymentMethod,
            autoPay: this.autoPay,
            reminderDays: this.reminderDays,
            accountNumber: this.accountNumber.trim(),
            url: this.url.trim(),
            notes: this.notes.trim(),
            active: true,
        };

        try {
            const file = await this.vaultService.createMasterBill(input);
            new Notice(`Added master bill: ${input.name}`);
            this.close();
            if (this.onCreated) this.onCreated(file);
        } catch (e) {
            console.error('Failed to create master bill:', e);
            new Notice('Failed to create master bill file.');
        }
    }
}
