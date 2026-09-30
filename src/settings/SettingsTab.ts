import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type RecurringBillsPlugin from '../main';
import { DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS } from '../constants';

export class RecurringBillsSettingTab extends PluginSettingTab {
    private plugin: RecurringBillsPlugin;

    constructor(app: App, plugin: RecurringBillsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('bills-settings-root');

        containerEl.createEl('h2', { text: 'Wawarts Settings' });

        // Storage & Folder Settings
        containerEl.createEl('h3', { text: 'Master Data & Transaction Folders' });

        new Setting(containerEl)
            .setName('Master Bills Folder')
            .setDesc('Folder where master bill definitions and profiles are stored.')
            .addText((text) =>
                text
                    .setPlaceholder('Bills/Master')
                    .setValue(this.plugin.settings.masterFolder)
                    .onChange(async (val) => {
                        this.plugin.settings.masterFolder = val.trim() || 'Bills/Master';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Transactions Folder')
            .setDesc('Folder where individual monthly bill due files and receipts are created.')
            .addText((text) =>
                text
                    .setPlaceholder('Bills/Transactions')
                    .setValue(this.plugin.settings.transactionsFolder)
                    .onChange(async (val) => {
                        this.plugin.settings.transactionsFolder = val.trim() || 'Bills/Transactions';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Transaction Folder Organization')
            .setDesc('How transaction files are partitioned.')
            .addDropdown((dropdown) => {
                dropdown.addOption('year-month', 'Year / Month (e.g. Transactions/2026/10/)');
                dropdown.addOption('by-bill', 'By Bill Item (e.g. Transactions/Netflix/)');
                dropdown.addOption('flat', 'Flat Folder (e.g. Transactions/)');
                dropdown.setValue(this.plugin.settings.folderStructure);
                dropdown.onChange(async (val) => {
                    this.plugin.settings.folderStructure = val as any;
                    await this.plugin.saveSettings();
                });
            });

        // Tags Configuration
        containerEl.createEl('h3', { text: 'Tags & Status Metadata' });

        new Setting(containerEl)
            .setName('Paid Status Tag')
            .setDesc('Tag applied to transactional files when paid (without #).')
            .addText((text) =>
                text
                    .setPlaceholder('bill/paid')
                    .setValue(this.plugin.settings.paidTag)
                    .onChange(async (val) => {
                        this.plugin.settings.paidTag = val.trim().replace(/^#/, '') || 'bill/paid';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Pending Status Tag')
            .setDesc('Tag applied to transactional files when due/pending (without #).')
            .addText((text) =>
                text
                    .setPlaceholder('bill/pending')
                    .setValue(this.plugin.settings.pendingTag)
                    .onChange(async (val) => {
                        this.plugin.settings.pendingTag = val.trim().replace(/^#/, '') || 'bill/pending';
                        await this.plugin.saveSettings();
                    })
            );

        // Currency & Regional
        containerEl.createEl('h3', { text: 'Currency & Display' });

        new Setting(containerEl)
            .setName('Currency Symbol')
            .setDesc('Prefix symbol for amounts (e.g. $, €, £, ¥, ₱)')
            .addText((text) =>
                text
                    .setPlaceholder('$')
                    .setValue(this.plugin.settings.currencySymbol)
                    .onChange(async (val) => {
                        this.plugin.settings.currencySymbol = val.trim() || '$';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Currency Code')
            .setDesc('ISO currency code (e.g. USD, EUR, GBP, JPY)')
            .addText((text) =>
                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.currencyCode)
                    .onChange(async (val) => {
                        this.plugin.settings.currencyCode = val.trim().toUpperCase() || 'USD';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Default Reminder Window (Days)')
            .setDesc('Days before due date to activate the warning alert.')
            .addSlider((slider) =>
                slider
                    .setLimits(1, 14, 1)
                    .setValue(this.plugin.settings.defaultReminderDays)
                    .setDynamicTooltip()
                    .onChange(async (val) => {
                        this.plugin.settings.defaultReminderDays = val;
                        await this.plugin.saveSettings();
                    })
            );

        // Status Bar & Display
        containerEl.createEl('h3', { text: 'Status Bar & Display' });

        new Setting(containerEl)
            .setName('Show Status Bar Item')
            .setDesc('Display yearly completion % and pending count in the Obsidian status bar.')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableStatusBar)
                    .onChange(async (val) => {
                        this.plugin.settings.enableStatusBar = val;
                        await this.plugin.saveSettings();
                        this.plugin.updateStatusBar();
                    })
            );

        // Taxonomy
        containerEl.createEl('h3', { text: 'Categories & Payment Methods' });

        new Setting(containerEl)
            .setName('Categories')
            .setDesc('Comma-separated list of categories.')
            .addTextArea((textarea) => {
                textarea.inputEl.rows = 3;
                textarea
                    .setValue(this.plugin.settings.categories.join(', '))
                    .onChange(async (val) => {
                        const cats = val
                            .split(',')
                            .map((c) => c.trim())
                            .filter(Boolean);
                        this.plugin.settings.categories = cats.length > 0 ? cats : DEFAULT_CATEGORIES;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Payment Methods')
            .setDesc('Comma-separated list of payment sources.')
            .addTextArea((textarea) => {
                textarea.inputEl.rows = 2;
                textarea
                    .setValue(this.plugin.settings.paymentMethods.join(', '))
                    .onChange(async (val) => {
                        const methods = val
                            .split(',')
                            .map((m) => m.trim())
                            .filter(Boolean);
                        this.plugin.settings.paymentMethods = methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
