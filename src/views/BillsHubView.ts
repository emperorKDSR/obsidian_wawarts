import { ItemView, WorkspaceLeaf, setIcon, Notice, Menu, Platform } from 'obsidian';
import { VIEW_TYPE_BILLS_HUB, BILLS_RIBBON_ICON_ID } from '../constants';
import {
    HubTab,
    TransactionFilterOptions,
    MasterFilterOptions,
    RecurringBillsSettings,
    BillTransaction,
    MasterBill,
} from '../types';
import { BillIndexService } from '../services/BillIndexService';
import { BillVaultService } from '../services/BillVaultService';
import { AnalyticsService } from '../services/AnalyticsService';
import { RefreshCoordinator } from '../services/RefreshCoordinator';
import { BillsSummaryCards } from './components/BillsSummaryCards';
import { BillsFilterBar } from './components/BillsFilterBar';
import { MasterCatalogTable } from './components/MasterCatalogTable';
import { DueLedgerTable } from './components/DueLedgerTable';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { TransactionInspector } from './components/TransactionInspector';
import { MasterBillInspector } from './components/MasterBillInspector';
import { NewMasterBillModal } from '../modals/NewMasterBillModal';
import { GenerateTransactionsModal } from '../modals/GenerateTransactionsModal';
import { FolderSettingsModal } from '../modals/FolderSettingsModal';
import { getCurrentMonthStr, getCurrentYearStr } from '../utils/dateUtils';
import { isTablet } from '../utils/domUtils';

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

    // Cockpit Inspector Selection State
    private selectedTransaction: BillTransaction | null = null;
    private selectedMasterBill: MasterBill | null = null;
    private transactionInspector: TransactionInspector | null = null;
    private masterBillInspector: MasterBillInspector | null = null;

    private unsubscribeRefresh?: () => void;
    private keydownHandler?: (e: KeyboardEvent) => void;

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
        return 'Wawarts — Dues Cockpit';
    }

    getIcon(): string {
        return BILLS_RIBBON_ICON_ID;
    }

    async onOpen(): Promise<void> {
        this.unsubscribeRefresh = this.refreshCoordinator.subscribe(() => {
            // Re-resolve selected items from new index to keep active state fresh
            if (this.selectedTransaction) {
                const refreshed = this.indexService.getAllTransactions().find(
                    (t) => t.file.path === this.selectedTransaction?.file.path
                );
                this.selectedTransaction = refreshed || null;
            }
            if (this.selectedMasterBill) {
                const refreshedM = this.indexService.getAllMasterBills().find(
                    (b) => b.file.path === this.selectedMasterBill?.file.path
                );
                this.selectedMasterBill = refreshedM || null;
            }
            this.render();
        });

        // Global view keydown listener (DIWA keyboard shortcuts: '/' for search, 'Escape' to dismiss)
        this.keydownHandler = (e: KeyboardEvent) => {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

            if (e.key === '/' && !isEditing) {
                e.preventDefault();
                const searchInput = this.contentEl.querySelector<HTMLInputElement>('.pos-search-input, .bills-table-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            } else if (e.key === 'Escape') {
                if (this.selectedTransaction || this.selectedMasterBill) {
                    this.selectedTransaction = null;
                    this.selectedMasterBill = null;
                    this.render();
                }
            }
        };
        window.addEventListener('keydown', this.keydownHandler);

        await this.indexService.buildFullIndex();
        this.render();
    }

    async onClose(): Promise<void> {
        if (this.unsubscribeRefresh) {
            this.unsubscribeRefresh();
        }
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
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
        contentEl.addClass('diwa-workspace-root', 'bills-view-root');

        const isMobile = Platform.isMobile && !isTablet();
        if (isMobile) {
            contentEl.addClass('is-mobile-device');
        }

        // --- 1. Top Header Bar (DIWA pos-header-bar style) ---
        const headerEl = contentEl.createEl('div', { cls: 'pos-header-bar bills-header-container' });

        // Left Branding & Subtitle
        const titleSection = headerEl.createEl('div', { cls: 'pos-header-title-section bills-title-left' });
        const logoIcon = titleSection.createEl('span', { cls: 'bills-title-icon' });
        setIcon(logoIcon, 'calendar-check-2');
        titleSection.createEl('span', { text: 'Wawarts', cls: 'pos-header-logo bills-main-title' });
        titleSection.createEl('span', { text: 'Personal Dues & Cashflow Cockpit', cls: 'pos-header-subtitle' });

        // Header Actions (Right)
        const headerActions = headerEl.createEl('div', { cls: 'pos-header-actions bills-title-right' });

        // Quick Generator Pill
        const quickGenBtn = headerActions.createEl('button', {
            cls: 'pos-header-text-btn',
        });
        const zapIcon = quickGenBtn.createEl('span', { cls: 'pos-btn-icon' });
        setIcon(zapIcon, 'sparkles');
        quickGenBtn.createEl('span', { text: 'Generate Month Dues' });
        quickGenBtn.addEventListener('click', () => {
            new GenerateTransactionsModal(
                this.app,
                this.vaultService,
                this.indexService,
                this.settings,
                () => this.render()
            ).open();
        });

        // Quick New Master Bill Pill
        const newBillBtn = headerActions.createEl('button', {
            cls: 'pos-header-text-btn',
        });
        const plusIcon = newBillBtn.createEl('span', { cls: 'pos-btn-icon' });
        setIcon(plusIcon, 'plus');
        newBillBtn.createEl('span', { text: 'New Master' });
        newBillBtn.addEventListener('click', () => {
            new NewMasterBillModal(
                this.app,
                this.vaultService,
                this.settings,
                () => this.render()
            ).open();
        });

        // Settings / More Utility Button
        const settingsBtn = headerActions.createEl('button', {
            cls: 'pos-header-icon-btn clickable-icon',
            attr: { 'aria-label': 'Vault Folders & Settings' },
        });
        setIcon(settingsBtn, 'settings');
        settingsBtn.addEventListener('click', () => this.openFolderSettingsModal());

        // --- 2. Summary KPI Cards ---
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

        // --- 3. Navigation Tabs & Filter Bar ---
        const filterContainer = contentEl.createEl('div', { cls: 'bills-filter-wrapper' });
        BillsFilterBar.render(
            filterContainer,
            this.indexService,
            this.activeHubTab,
            this.filterOptions,
            (newTab) => {
                this.activeHubTab = newTab;
                this.selectedTransaction = null;
                this.selectedMasterBill = null;
                this.persistFilters();
                this.render();
            },
            (newOptions) => {
                this.filterOptions = newOptions;
                this.persistFilters();
                this.renderStage(mainStageContainer, inspectorContainer);
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

        // --- 4. Dual-Pane Cockpit Main Stage (DIWA Split Layout) ---
        const cockpitStage = contentEl.createEl('div', { cls: 'wawarts-cockpit-stage' });

        // Left/Center: Main Table / View Area
        const mainStageContainer = cockpitStage.createEl('div', { cls: 'wawarts-cockpit-table-area' });

        // Right/Drawer: Inspector Container (Desktop Slide-Over Rail / Mobile Bottom Sheet)
        const inspectorContainer = cockpitStage.createEl('div', { cls: 'wawarts-cockpit-inspector-area' });
        inspectorContainer.style.display = 'none';

        // Initialize Inspectors
        this.transactionInspector = new TransactionInspector(
            this.app,
            inspectorContainer,
            this.vaultService,
            this.settings,
            () => {
                this.selectedTransaction = null;
                this.render();
            },
            () => this.render()
        );

        this.masterBillInspector = new MasterBillInspector(
            this.app,
            inspectorContainer,
            this.vaultService,
            this.indexService,
            this.settings,
            () => {
                this.selectedMasterBill = null;
                this.render();
            },
            () => this.render()
        );

        this.renderStage(mainStageContainer, inspectorContainer);
    }

    private renderStage(mainContainer: HTMLElement, inspectorContainer: HTMLElement): void {
        mainContainer.empty();

        if (this.activeHubTab === 'insights') {
            inspectorContainer.style.display = 'none';
            inspectorContainer.removeClass('is-open');
            AnalyticsDashboard.render(mainContainer, this.app, this.indexService, this.settings);
            return;
        }

        if (this.activeHubTab === 'master') {
            MasterCatalogTable.render(
                mainContainer,
                this.app,
                this.indexService,
                this.vaultService,
                this.settings,
                this.masterFilterOptions,
                (newOpts) => {
                    this.masterFilterOptions = newOpts;
                    this.persistFilters();
                    this.renderStage(mainContainer, inspectorContainer);
                },
                () => this.render(),
                this.selectedMasterBill?.file.path,
                (selected) => {
                    this.selectedMasterBill = selected;
                    if (selected && this.masterBillInspector) {
                        this.masterBillInspector.inspect(selected);
                    } else if (this.masterBillInspector) {
                        this.masterBillInspector.inspect(null);
                    }
                    this.renderStage(mainContainer, inspectorContainer);
                }
            );

            // Populate inspector if active
            if (this.selectedMasterBill && this.masterBillInspector) {
                this.masterBillInspector.inspect(this.selectedMasterBill);
            } else if (this.masterBillInspector) {
                this.masterBillInspector.inspect(null);
            }
            return;
        }

        // Transactions Due Ledger Tab:
        DueLedgerTable.render(
            mainContainer,
            this.app,
            this.indexService,
            this.vaultService,
            this.settings,
            this.filterOptions,
            (newOpts) => {
                this.filterOptions = newOpts;
                this.persistFilters();
                this.renderStage(mainContainer, inspectorContainer);
            },
            () => this.render(),
            this.selectedTransaction?.file.path,
            (selected) => {
                this.selectedTransaction = selected;
                if (selected && this.transactionInspector) {
                    this.transactionInspector.inspect(selected);
                } else if (this.transactionInspector) {
                    this.transactionInspector.inspect(null);
                }
                this.renderStage(mainContainer, inspectorContainer);
            }
        );

        // Populate inspector if active
        if (this.selectedTransaction && this.transactionInspector) {
            this.transactionInspector.inspect(this.selectedTransaction);
        } else if (this.transactionInspector) {
            this.transactionInspector.inspect(null);
        }
    }
}
