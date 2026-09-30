import { App, Modal, Setting, Notice, setIcon } from 'obsidian';
import { RecurringBillsSettings } from '../types';
import { BillIndexService } from '../services/BillIndexService';
import { BillVaultService } from '../services/BillVaultService';

export class FolderSettingsModal extends Modal {
    private settings: RecurringBillsSettings;
    private onSave: (updated: RecurringBillsSettings) => Promise<void>;
    private indexService: BillIndexService;
    private vaultService: BillVaultService;

    private masterFolderVal: string;
    private transactionFolderVal: string;
    private currencyVal: string;
    private reminderDaysVal: number;

    constructor(
        app: App,
        settings: RecurringBillsSettings,
        indexService: BillIndexService,
        vaultService: BillVaultService,
        onSave: (updated: RecurringBillsSettings) => Promise<void>
    ) {
        super(app);
        this.settings = settings;
        this.indexService = indexService;
        this.vaultService = vaultService;
        this.onSave = onSave;

        this.masterFolderVal = settings.masterFolder;
        this.transactionFolderVal = settings.transactionsFolder;
        this.currencyVal = settings.currencySymbol;
        this.reminderDaysVal = settings.defaultReminderDays;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bills-modal-content');

        // Header
        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        const iconWrap = headerEl.createEl('span', { cls: 'bills-modal-header-icon' });
        setIcon(iconWrap, 'folder-cog');
        headerEl.createEl('h2', { text: 'Folder Locations & Settings' });

        const desc = contentEl.createEl('p', {
            text: 'Customize where your Master Bill definitions and Monthly Transaction notes are stored in this vault.',
            cls: 'bills-modal-desc',
        });
        desc.style.marginBottom = '16px';

        // Master Bills Folder
        new Setting(contentEl)
            .setName('Master Bills Folder')
            .setDesc('Folder where recurring bill definitions (profiles) are saved.')
            .addText((text) =>
                text
                    .setPlaceholder('Bills/Master')
                    .setValue(this.masterFolderVal)
                    .onChange((val) => {
                        this.masterFolderVal = val.trim();
                    })
            );

        // Transaction Instances Folder
        new Setting(contentEl)
            .setName('Transactions Folder')
            .setDesc('Folder where monthly due instance files (e.g. 2026/10/...) are generated.')
            .addText((text) =>
                text
                    .setPlaceholder('Bills/Transactions')
                    .setValue(this.transactionFolderVal)
                    .onChange((val) => {
                        this.transactionFolderVal = val.trim();
                    })
            );

        // Currency Symbol
        new Setting(contentEl)
            .setName('Currency Symbol')
            .setDesc('Symbol displayed alongside bill amounts (e.g. $, €, £, ₱, ¥).')
            .addText((text) =>
                text
                    .setPlaceholder('$')
                    .setValue(this.currencyVal)
                    .onChange((val) => {
                        this.currencyVal = val.trim();
                    })
            );

        // Reminder Days
        new Setting(contentEl)
            .setName('Urgency Alert Window')
            .setDesc('Days before due date to mark bills as "Due Soon".')
            .addSlider((slider) =>
                slider
                    .setLimits(1, 30, 1)
                    .setValue(this.reminderDaysVal)
                    .setDynamicTooltip()
                    .onChange((val) => {
                        this.reminderDaysVal = val;
                    })
            );

        // Footer Actions
        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        footerEl.style.marginTop = '24px';
        footerEl.style.display = 'flex';
        footerEl.style.justifyContent = 'space-between';
        footerEl.style.alignItems = 'center';

        // Left side: Open full settings
        const fullSettingsBtn = footerEl.createEl('button', {
            text: 'All Plugin Settings',
            cls: 'bills-btn-secondary',
        });
        fullSettingsBtn.addEventListener('click', () => {
            this.close();
            const appSetting = (this.app as any).setting;
            if (appSetting) {
                appSetting.open();
                appSetting.openTabById('wawarts');
            }
        });

        // Right side: Cancel & Save
        const rightBtns = footerEl.createEl('div', { cls: 'bills-modal-actions-right' });
        rightBtns.style.display = 'flex';
        rightBtns.style.gap = '10px';

        const cancelBtn = rightBtns.createEl('button', { text: 'Cancel', cls: 'bills-btn-secondary' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = rightBtns.createEl('button', {
            text: 'Save & Re-index',
            cls: 'mod-cta bills-btn-primary',
        });
        saveBtn.addEventListener('click', async () => {
            if (!this.masterFolderVal) {
                new Notice('Master Bills folder path cannot be empty.');
                return;
            }
            if (!this.transactionFolderVal) {
                new Notice('Transactions folder path cannot be empty.');
                return;
            }

            const updated: RecurringBillsSettings = {
                ...this.settings,
                masterFolder: this.masterFolderVal,
                transactionsFolder: this.transactionFolderVal,
                currencySymbol: this.currencyVal || '$',
                defaultReminderDays: this.reminderDaysVal,
            };

            await this.onSave(updated);
            new Notice('Wawarts folder settings updated & vault re-indexed.');
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
