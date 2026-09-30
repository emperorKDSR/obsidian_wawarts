import { Plugin, WorkspaceLeaf, addIcon, Notice, SuggestModal, App } from 'obsidian';
import {
    PLUGIN_NAME,
    DEFAULT_SETTINGS,
    VIEW_TYPE_BILLS_HUB,
    BILLS_RIBBON_ICON_ID,
    BILLS_RIBBON_ICON_SVG,
} from './constants';
import { RecurringBillsSettings, BillTransaction } from './types';
import { BillVaultService } from './services/BillVaultService';
import { BillIndexService } from './services/BillIndexService';
import { AnalyticsService } from './services/AnalyticsService';
import { RefreshCoordinator } from './services/RefreshCoordinator';
import { BillsHubView } from './views/BillsHubView';
import { RecurringBillsSettingTab } from './settings/SettingsTab';
import { NewMasterBillModal } from './modals/NewMasterBillModal';
import { GenerateTransactionsModal } from './modals/GenerateTransactionsModal';
import { PayTransactionModal } from './modals/PayTransactionModal';
import { formatCurrency } from './utils/currencyUtils';

class TransactionPickerModal extends SuggestModal<BillTransaction> {
    private transactions: BillTransaction[];
    private onChoose: (trans: BillTransaction) => void;
    private symbol: string;

    constructor(app: App, transactions: BillTransaction[], symbol: string, onChoose: (trans: BillTransaction) => void) {
        super(app);
        this.transactions = transactions;
        this.symbol = symbol;
        this.onChoose = onChoose;
        this.setPlaceholder('Select a pending due file...');
    }

    getSuggestions(query: string): BillTransaction[] {
        const q = query.toLowerCase();
        return this.transactions.filter(
            (t) =>
                t.masterBillName.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q) ||
                t.dueDate.includes(q)
        );
    }

    renderSuggestion(trans: BillTransaction, el: HTMLElement): void {
        el.addClass('bills-suggest-item');
        const top = el.createEl('div', { cls: 'bills-suggest-top' });
        top.createEl('span', { text: trans.masterBillName, cls: 'bills-suggest-name' });
        top.createEl('span', {
            text: formatCurrency(trans.amountDue, this.symbol),
            cls: 'bills-suggest-amount',
        });

        const bottom = el.createEl('div', { cls: 'bills-suggest-bottom' });
        bottom.createEl('span', { text: `Category: ${trans.category}`, cls: 'bills-suggest-category' });
        bottom.createEl('span', { text: `Due: ${trans.dueDate}`, cls: 'bills-suggest-due' });
    }

    onChooseSuggestion(trans: BillTransaction, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(trans);
    }
}

export default class RecurringBillsPlugin extends Plugin {
    settings!: RecurringBillsSettings;
    vaultService!: BillVaultService;
    indexService!: BillIndexService;
    analyticsService!: AnalyticsService;
    refreshCoordinator!: RefreshCoordinator;

    private statusBarItemEl?: HTMLElement;

    async onload(): Promise<void> {
        console.log(`Loading ${PLUGIN_NAME}...`);
        await this.loadSettings();

        // Register custom SVG icon
        addIcon(BILLS_RIBBON_ICON_ID, BILLS_RIBBON_ICON_SVG);

        // Initialize Services
        this.vaultService = new BillVaultService(this.app, this.settings);
        this.indexService = new BillIndexService(this.app, this.settings);
        this.analyticsService = new AnalyticsService(this.settings);
        this.refreshCoordinator = new RefreshCoordinator(this.app, this.indexService);

        // Register View
        this.registerView(
            VIEW_TYPE_BILLS_HUB,
            (leaf: WorkspaceLeaf) =>
                new BillsHubView(
                    leaf,
                    this.indexService,
                    this.vaultService,
                    this.analyticsService,
                    this.refreshCoordinator,
                    this.settings,
                    async (updatedSettings: RecurringBillsSettings) => {
                        this.settings = updatedSettings;
                        await this.saveSettings();
                        this.vaultService.updateSettings(this.settings);
                        this.indexService.updateSettings(this.settings);
                        this.analyticsService.updateSettings(this.settings);
                        await this.indexService.buildFullIndex();
                        this.updateStatusBar();
                    }
                )
        );

        // Ribbon Icon
        this.addRibbonIcon(BILLS_RIBBON_ICON_ID, 'Open Wawarts', () => {
            this.activateBillsHubView();
        });

        // Status Bar
        if (this.settings.enableStatusBar) {
            this.statusBarItemEl = this.addStatusBarItem();
            this.statusBarItemEl.addClass('bills-status-bar-item');
            this.statusBarItemEl.addEventListener('click', () => {
                this.activateBillsHubView();
            });
        }

        // Commands
        this.addCommand({
            id: 'open-recurring-bills-hub',
            name: 'Open Wawarts Dashboard',
            callback: () => {
                this.activateBillsHubView();
            },
        });

        this.addCommand({
            id: 'generate-monthly-due-files',
            name: 'Generate Monthly Bill Due Files',
            callback: () => {
                new GenerateTransactionsModal(
                    this.app,
                    this.vaultService,
                    this.indexService,
                    this.settings,
                    () => this.refreshCoordinator.notify()
                ).open();
            },
        });

        this.addCommand({
            id: 'add-master-bill',
            name: 'Add Master Bill Item',
            callback: () => {
                new NewMasterBillModal(
                    this.app,
                    this.vaultService,
                    this.settings,
                    () => this.refreshCoordinator.notify()
                ).open();
            },
        });

        this.addCommand({
            id: 'pay-bill-transaction',
            name: 'Record Payment for Due Bill',
            callback: () => {
                const pending = this.indexService.getAllTransactions().filter((t) => t.status === 'pending' || t.status === 'overdue');
                if (pending.length === 0) {
                    new Notice('No pending due bills found.');
                    return;
                }
                new TransactionPickerModal(this.app, pending, this.settings.currencySymbol, (selected) => {
                    new PayTransactionModal(this.app, selected, this.vaultService, this.settings, () => {
                        this.refreshCoordinator.notify();
                    }).open();
                }).open();
            },
        });

        // Register Settings Tab
        this.addSettingTab(new RecurringBillsSettingTab(this.app, this));

        // Start Vault Watcher & Initial Index
        this.refreshCoordinator.register();
        this.refreshCoordinator.subscribe(() => {
            this.updateStatusBar();
        });

        this.app.workspace.onLayoutReady(async () => {
            await this.indexService.buildFullIndex();
            this.updateStatusBar();
        });
    }

    onunload(): void {
        console.log(`Unloading ${PLUGIN_NAME}...`);
        this.refreshCoordinator.unregister();
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.vaultService.updateSettings(this.settings);
        this.indexService.updateSettings(this.settings);
        this.analyticsService.updateSettings(this.settings);

        // Update open views
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_BILLS_HUB);
        for (const leaf of leaves) {
            if (leaf.view instanceof BillsHubView) {
                leaf.view.updateSettings(this.settings);
            }
        }
        this.updateStatusBar();
    }

    updateStatusBar(): void {
        if (!this.statusBarItemEl) return;
        if (!this.settings.enableStatusBar) {
            this.statusBarItemEl.setText('');
            return;
        }

        const yearly = this.indexService.getYearlySummary();
        const pending = this.indexService.getAllTransactions().filter((t) => t.status === 'pending').length;
        const overdue = this.indexService.getOverdueTransactions().length;

        let statusText = `📅 ${yearly.yearStr}: ${yearly.percentagePaid}% Paid (${yearly.paidCount}/${yearly.totalBills})`;
        if (overdue > 0) {
            statusText += ` · ⚠️ ${overdue} Overdue`;
        } else if (pending > 0) {
            statusText += ` · ⏳ ${pending} Pending`;
        } else if (yearly.totalBills > 0) {
            statusText += ` · ✓ All Settled`;
        }

        this.statusBarItemEl.setText(statusText);
        this.statusBarItemEl.setAttr('aria-label', `${yearly.yearStr} Yearly Completion: ${yearly.percentagePaid}% (${yearly.paidCount} of ${yearly.totalBills} bills paid)\nClick to open Bills Dashboard`);
    }

    async activateBillsHubView(): Promise<void> {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_BILLS_HUB)[0];

        if (!leaf) {
            const rootLeaf = workspace.getLeaf(false);
            if (rootLeaf) {
                await rootLeaf.setViewState({
                    type: VIEW_TYPE_BILLS_HUB,
                    active: true,
                });
                leaf = rootLeaf;
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }
}
