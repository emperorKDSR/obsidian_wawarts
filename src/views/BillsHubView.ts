import { ItemView, WorkspaceLeaf, setIcon, Notice, Menu } from 'obsidian';
import { VIEW_TYPE_BILLS_HUB, BILLS_RIBBON_ICON_ID } from '../constants';
import {
    HubTab,
    TransactionFilterOptions,
    MasterFilterOptions,
    RecurringBillsSettings,
} from '../types';
import { BillIndexService } from '../services/BillIndexService';
import { BillVaultService } from '../services/BillVaultService';
import { AnalyticsService } from '../services/AnalyticsService';
import { RefreshCoordinator } from '../services/RefreshCoordinator';
import { BillsSummaryCards } from './components/BillsSummaryCards';
import { BillsFilterBar } from './components/BillsFilterBar';
import { BillCardItem } from './components/BillCardItem';
import { MasterBillCardItem } from './components/MasterBillCardItem';
import { MasterCatalogTable } from './components/MasterCatalogTable';
import { DueLedgerTable } from './components/DueLedgerTable';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { NewMasterBillModal } from '../modals/NewMasterBillModal';
import { GenerateTransactionsModal } from '../modals/GenerateTransactionsModal';
import { FolderSettingsModal } from '../modals/FolderSettingsModal';
import { getCurrentMonthStr, getCurrentYearStr } from '../utils/dateUtils';

export class BillsHubView extends ItemView {
    private indexService: BillIndexService;
    private vaultService: BillVaultService;
    private analyticsService: AnalyticsService;
    private refreshCoordinator: RefreshCoordinator;
    private settings: RecurringBillsSettings;
    private onSaveSettings?: (settings: RecurringBillsSettings) => Promise<void>;

    private activeHubTab: HubTab = 'transactions';
    private filterOptions: TransactionFilterOptions;
    private masterFilterOptions: MasterFilterOptions;

    private unsubscribeRefresh?: () => void;

    constructor(
        leaf: WorkspaceLeaf,
        indexService: BillIndexService,
        vaultService: BillVaultService,
        analyticsService: AnalyticsService,
        refreshCoordinator: RefreshCoordinator,
        settings: RecurringBillsSettings,
        onSaveSettings?: (settings: RecurringBillsSettings) => Promise<void>
    ) {
        super(leaf);
        this.indexService = indexService;
        this.vaultService = vaultService;
        this.analyticsService = analyticsService;
        this.refreshCoordinator = refreshCoordinator;
        this.settings = settings;
        this.onSaveSettings = onSaveSettings;

        this.activeHubTab = settings.savedActiveHubTab || 'transactions';

        const savedTx = settings.savedTransactionFilters || {};
        this.filterOptions = {
            activeTab: savedTx.activeTab || 'all',
            categoryFilter: savedTx.categoryFilter || 'all',
            selectedMonth: savedTx.selectedMonth || getCurrentMonthStr(),
            selectedYear: savedTx.selectedYear || getCurrentYearStr(),
            searchQuery: savedTx.searchQuery || '',
            sortBy: savedTx.sortBy || 'due_date',
        };

        const savedM = settings.savedMasterFilters || {};
        this.masterFilterOptions = {
            searchQuery: savedM.searchQuery || '',
            categoryFilter: savedM.categoryFilter || 'all',
            frequencyFilter: savedM.frequencyFilter || 'all',
            statusFilter: savedM.statusFilter || 'all',
            sortBy: savedM.sortBy || 'dueDay',
            sortAsc: savedM.sortAsc !== undefined ? savedM.sortAsc : true,
        };
    }

    getViewType(): string {
        return VIEW_TYPE_BILLS_HUB;
    }

    getDisplayText(): string {
        return 'Wawarts';
    }

    getIcon(): string {
        return BILLS_RIBBON_ICON_ID;
    }

    async onOpen(): Promise<void> {
        this.unsubscribeRefresh = this.refreshCoordinator.subscribe(() => {
            this.render();
        });

        await this.indexService.buildFullIndex();
        this.render();
    }

    async onClose(): Promise<void> {
        if (this.unsubscribeRefresh) {
            this.unsubscribeRefresh();
        }
    }

    updateSettings(settings: RecurringBillsSettings): void {
        this.settings = settings;
        this.render();
    }

    private openFolderSettingsModal(): void {
        new FolderSettingsModal(
            this.app,
            this.settings,
            this.indexService,
            this.vaultService,
            async (updated) => {
                this.settings = updated;
                if (this.onSaveSettings) {
                    await this.onSaveSettings(updated);
                }
                this.vaultService.updateSettings(this.settings);
                this.indexService.updateSettings(this.settings);
                this.analyticsService.updateSettings(this.settings);
                await this.indexService.buildFullIndex();
                this.render();
            }
        ).open();
    }

    private async persistFilters(): Promise<void> {
        this.settings.savedActiveHubTab = this.activeHubTab;
        this.settings.savedTransactionFilters = { ...this.filterOptions };
        this.settings.savedMasterFilters = { ...this.masterFilterOptions };
        if (this.onSaveSettings) {
            await this.onSaveSettings(this.settings);
        }
    }

    public render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bills-view-root');

        // 1. Header Row
        const headerEl = contentEl.createEl('div', { cls: 'bills-header-container' });
        const titleRow = headerEl.createEl('div', { cls: 'bills-title-row' });

        const titleLeft = titleRow.createEl('div', { cls: 'bills-title-left' });
        const logoIcon = titleLeft.createEl('span', { cls: 'bills-title-icon' });
        setIcon(logoIcon, 'calendar-check-2');
        titleLeft.createEl('h1', { text: 'Wawarts', cls: 'bills-main-title' });

        // Header Right: settings button
        const titleRight = titleRow.createEl('div', { cls: 'bills-title-right' });

        const settingsBtn = titleRight.createEl('button', {
            cls: 'clickable-icon bills-header-icon-btn',
            attr: { 'aria-label': 'Folder Locations & Settings' },
        });
        setIcon(settingsBtn, 'settings');
        settingsBtn.addEventListener('click', () => this.openFolderSettingsModal());

        // 2. Summary KPI Cards
        const summaryContainer = contentEl.createEl('div', { cls: 'bills-summary-wrapper' });
        BillsSummaryCards.render(
            summaryContainer,
            this.indexService,
            this.settings,
            this.filterOptions.selectedMonth,
            () => {
                this.activeHubTab = 'transactions';
                this.filterOptions.activeTab = 'overdue';
                this.persistFilters();
                this.render();
            },
            () => {
                this.activeHubTab = 'transactions';
                this.filterOptions.activeTab = 'pending';
                this.persistFilters();
                this.render();
            }
        );

        // 3. Navigation Tabs & Filter Bar
        const filterContainer = contentEl.createEl('div', { cls: 'bills-filter-wrapper' });
        BillsFilterBar.render(
            filterContainer,
            this.indexService,
            this.activeHubTab,
            this.filterOptions,
            (newTab) => {
                this.activeHubTab = newTab;
                this.persistFilters();
                this.render();
            },
            (newOptions) => {
                this.filterOptions = newOptions;
                this.persistFilters();
                this.renderContent(mainContentContainer);
            },
            () => {
                new GenerateTransactionsModal(
                    this.app,
                    this.vaultService,
                    this.indexService,
                    this.settings,
                    () => this.render()
                ).open();
            },
            () => {
                new NewMasterBillModal(
                    this.app,
                    this.vaultService,
                    this.settings,
                    () => this.render()
                ).open();
            },
            () => this.openFolderSettingsModal()
        );

        // 4. Main Scrollable Content Area
        const mainContentContainer = contentEl.createEl('div', { cls: 'bills-main-scroll-area' });
        this.renderContent(mainContentContainer);
    }

    private renderContent(container: HTMLElement): void {
        container.empty();

        if (this.activeHubTab === 'insights') {
            AnalyticsDashboard.render(container, this.app, this.indexService, this.settings);
            return;
        }

        if (this.activeHubTab === 'master') {
            this.renderMasterCatalog(container);
            return;
        }

        // Transactions Ledger Tab (Tabular on Desktop, Cards on Mobile):
        DueLedgerTable.render(
            container,
            this.app,
            this.indexService,
            this.vaultService,
            this.settings,
            this.filterOptions,
            (newOpts) => {
                this.filterOptions = newOpts;
                this.persistFilters();
                this.render();
            },
            () => this.render()
        );
    }

    private renderMasterCatalog(container: HTMLElement): void {
        MasterCatalogTable.render(
            container,
            this.app,
            this.indexService,
            this.vaultService,
            this.settings,
            this.masterFilterOptions,
            (newOpts) => {
                this.masterFilterOptions = newOpts;
                this.persistFilters();
                this.renderMasterCatalog(container);
            },
            () => this.render()
        );
    }

    private renderEmptyTransactions(container: HTMLElement): void {
        const emptyBox = container.createEl('div', { cls: 'bills-empty-state-box' });
        const icon = emptyBox.createEl('div', { cls: 'bills-empty-icon' });
        setIcon(icon, 'calendar-check-2');

        const masterBills = this.indexService.getAllMasterBills();
        if (masterBills.length === 0) {
            emptyBox.createEl('h3', { text: 'No Master Bills Configured', cls: 'bills-empty-title' });
            emptyBox.createEl('p', {
                text: 'First create master bill definitions, then generate due instances for the month.',
                cls: 'bills-empty-desc',
            });
            const addBtn = emptyBox.createEl('button', {
                text: 'Create Master Bill',
                cls: 'mod-cta bills-btn-primary',
            });
            addBtn.addEventListener('click', () => {
                new NewMasterBillModal(this.app, this.vaultService, this.settings, () => this.render()).open();
            });
        } else {
            emptyBox.createEl('h3', { text: `No Due Files for ${this.filterOptions.selectedMonth}`, cls: 'bills-empty-title' });
            emptyBox.createEl('p', {
                text: `Generate this month's scheduled due files from your master catalog with 1 click.`,
                cls: 'bills-empty-desc',
            });
            const genBtn = emptyBox.createEl('button', {
                text: `Generate ${this.filterOptions.selectedMonth} Due Files`,
                cls: 'mod-cta bills-btn-primary',
            });
            genBtn.addEventListener('click', () => {
                new GenerateTransactionsModal(this.app, this.vaultService, this.indexService, this.settings, () => this.render()).open();
            });
        }
    }
}
