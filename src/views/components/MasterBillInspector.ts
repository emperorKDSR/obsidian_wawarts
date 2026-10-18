import { App, Component, MarkdownRenderer, Notice, Platform, setIcon } from 'obsidian';
import { MasterBill, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { BillIndexService } from '../../services/BillIndexService';
import { formatCurrency } from '../../utils/currencyUtils';
import { FREQUENCY_LABELS } from '../../constants';
import { openNoteSafely, attachHoverPreview } from '../../utils/navigationUtils';
import { EditMasterBillModal } from '../../modals/EditMasterBillModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { isTablet } from '../../utils/domUtils';

export class MasterBillInspector extends Component {
    private app: App;
    private containerEl: HTMLElement;
    private vaultService: BillVaultService;
    private indexService: BillIndexService;
    private settings: RecurringBillsSettings;
    private masterBill: MasterBill | null = null;
    private onClose: () => void;
    private onRefreshNeeded: () => void;
    private noteBodyEl: HTMLElement | null = null;

    constructor(
        app: App,
        containerEl: HTMLElement,
        vaultService: BillVaultService,
        indexService: BillIndexService,
        settings: RecurringBillsSettings,
        onClose: () => void,
        onRefreshNeeded: () => void
    ) {
        super();
        this.app = app;
        this.containerEl = containerEl;
        this.vaultService = vaultService;
        this.indexService = indexService;
        this.settings = settings;
        this.onClose = onClose;
        this.onRefreshNeeded = onRefreshNeeded;
    }

    public inspect(bill: MasterBill | null): void {
        this.masterBill = bill;
        this.render();
    }

    public get activeBill(): MasterBill | null {
        return this.masterBill;
    }

    public render(): void {
        this.containerEl.empty();

        if (!this.masterBill) {
            this.containerEl.style.display = 'none';
            this.containerEl.removeClass('is-open');
            return;
        }

        const bill = this.masterBill;
        this.containerEl.style.display = 'flex';
        this.containerEl.addClass('is-open');

        const isMobileDevice = Platform.isMobile && !isTablet();

        // 1. Mobile Drag Handle with Swipe-to-Dismiss Gesture
        if (isMobileDevice) {
            const dragWrap = this.containerEl.createDiv({ cls: 'pos-sheet-drag-handle-wrap' });
            dragWrap.createDiv({ cls: 'pos-sheet-drag-handle' });

            let startY = 0;
            let currentDelta = 0;
            dragWrap.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                currentDelta = 0;
                this.containerEl.style.transition = 'none';
            }, { passive: true });

            dragWrap.addEventListener('touchmove', (e) => {
                const moveY = e.touches[0].clientY;
                currentDelta = Math.max(0, moveY - startY);
                if (currentDelta > 0) {
                    this.containerEl.style.transform = `translateY(${currentDelta}px)`;
                }
            }, { passive: true });

            dragWrap.addEventListener('touchend', () => {
                this.containerEl.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                if (currentDelta > 70) {
                    this.containerEl.style.transform = 'translateY(100%)';
                    setTimeout(() => {
                        this.containerEl.style.transform = '';
                        this.containerEl.style.transition = '';
                        this.onClose();
                    }, 200);
                } else {
                    this.containerEl.style.transform = 'translateY(0)';
                    setTimeout(() => {
                        this.containerEl.style.transform = '';
                        this.containerEl.style.transition = '';
                    }, 200);
                }
            });

            dragWrap.addEventListener('click', () => this.onClose());
        }

        // 2. Header
        const headerEl = this.containerEl.createDiv({ cls: 'wawarts-insp-header' });
        const titleArea = headerEl.createDiv({ cls: 'wawarts-insp-title-area' });

        const iconEl = titleArea.createSpan({ cls: 'wawarts-insp-icon' });
        setIcon(iconEl, 'layers');

        const headerTitles = titleArea.createDiv({ cls: 'wawarts-insp-titles' });
        headerTitles.createEl('h3', { text: bill.name, cls: 'wawarts-insp-title' });
        headerTitles.createEl('div', { text: bill.file.name, cls: 'wawarts-insp-subtext' });

        const headerActions = headerEl.createDiv({ cls: 'wawarts-insp-header-actions' });

        // Safe Jump Link (Open in Adjacent Split)
        const openFileBtn = headerActions.createEl('button', {
            cls: 'pos-btn-icon wawarts-insp-action-btn',
            attr: { 'aria-label': 'Open master note in adjacent split (leaves Wawarts open)' },
        });
        setIcon(openFileBtn, 'arrow-up-right');
        openFileBtn.addEventListener('click', async (e) => {
            await openNoteSafely(this.app, bill.file, e, { fallbackLeaf: 'split' });
        });

        // Close Button
        const closeBtn = headerActions.createEl('button', {
            cls: 'pos-btn-icon wawarts-insp-close-btn',
            attr: { 'aria-label': 'Close inspector (Esc)' },
        });
        setIcon(closeBtn, 'x');
        closeBtn.addEventListener('click', () => this.onClose());

        // 3. Scrollable Inspector Body
        const bodyEl = this.containerEl.createDiv({ cls: 'wawarts-insp-body' });

        // Hero Metric Card
        const heroBox = bodyEl.createDiv({ cls: 'wawarts-insp-herobox' });
        const heroLeft = heroBox.createDiv({ cls: 'wawarts-insp-hero-left' });

        const formattedAmount = bill.defaultAmount !== undefined
            ? formatCurrency(bill.defaultAmount, bill.currency || this.settings.currencySymbol, this.settings.currencyCode)
            : 'Variable';

        heroLeft.createDiv({ text: formattedAmount, cls: 'wawarts-insp-hero-amount' });
        heroLeft.createDiv({
            text: FREQUENCY_LABELS[bill.frequency] || bill.frequency,
            cls: 'bill-badge bill-badge--neutral',
        });

        const heroRight = heroBox.createDiv({ cls: 'wawarts-insp-hero-right' });
        const editBtn = heroRight.createEl('button', {
            cls: 'mod-cta bills-btn-primary wawarts-insp-pay-btn',
            text: 'Edit Profile',
        });
        const editIcon = editBtn.createSpan({ cls: 'bills-btn-icon' });
        setIcon(editIcon, 'pencil');
        editBtn.prepend(editIcon);
        editBtn.addEventListener('click', () => {
            new EditMasterBillModal(this.app, bill, this.vaultService, this.settings, () => {
                this.onRefreshNeeded();
            }).open();
        });

        // Metadata Grid Section
        const metaSection = bodyEl.createDiv({ cls: 'wawarts-insp-section' });
        metaSection.createDiv({ text: 'Master Schedule Details', cls: 'wawarts-insp-section-title' });

        const grid = metaSection.createDiv({ cls: 'wawarts-insp-grid' });

        // Status
        const statusItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
        statusItem.createDiv({ text: 'Schedule Status', cls: 'wawarts-insp-grid-label' });
        statusItem.createDiv({
            text: bill.active ? '● Active' : '○ Paused',
            cls: `bill-badge bill-badge--${bill.active ? 'success' : 'neutral'}`,
        });

        // Category
        const catItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
        catItem.createDiv({ text: 'Category', cls: 'wawarts-insp-grid-label' });
        catItem.createDiv({ text: bill.category, cls: 'bill-badge bill-badge--neutral' });

        // Due Day
        if (bill.dueDay) {
            const dueDayItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            dueDayItem.createDiv({ text: 'Monthly Due Day', cls: 'wawarts-insp-grid-label' });
            dueDayItem.createDiv({ text: `Day ${bill.dueDay} of month`, cls: 'wawarts-insp-grid-value' });
        }

        // Payment Method
        if (bill.paymentMethod) {
            const methodItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            methodItem.createDiv({ text: 'Payment Method', cls: 'wawarts-insp-grid-label' });
            methodItem.createDiv({ text: bill.paymentMethod, cls: 'wawarts-insp-grid-value' });
        }

        // Auto-Pay
        if (bill.autoPay) {
            const autoItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            autoItem.createDiv({ text: 'Auto-Pay', cls: 'wawarts-insp-grid-label' });
            autoItem.createDiv({ text: '⚡ Enabled', cls: 'bill-badge bill-badge--purple' });
        }

        // Account Number
        if (bill.accountNumber) {
            const accItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            accItem.createDiv({ text: 'Account / Reference', cls: 'wawarts-insp-grid-label' });
            accItem.createDiv({ text: bill.accountNumber, cls: 'wawarts-insp-grid-value font-monospace' });
        }

        // URL Portal
        if (bill.url) {
            const urlItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            urlItem.createDiv({ text: 'Portal / Web Login', cls: 'wawarts-insp-grid-label' });
            const link = urlItem.createEl('a', {
                text: 'Open Portal ↗',
                href: bill.url,
                cls: 'external-link',
            });
            link.target = '_blank';
        }

        // Generated Instance History
        const allTransactions = this.indexService.getAllTransactions().filter(
            (t) => t.masterBillName.toLowerCase() === bill.name.toLowerCase()
        );
        const historySection = bodyEl.createDiv({ cls: 'wawarts-insp-section' });
        historySection.createDiv({
            text: `Generated Due History (${allTransactions.length} files)`,
            cls: 'wawarts-insp-section-title',
        });

        if (allTransactions.length > 0) {
            const histList = historySection.createDiv({ cls: 'wawarts-insp-hist-list' });
            for (const t of allTransactions.slice(0, 5)) {
                const histRow = histList.createDiv({ cls: 'wawarts-insp-hist-row' });
                histRow.createSpan({ text: t.dueDate, cls: 'wawarts-insp-hist-date font-monospace' });
                histRow.createSpan({
                    text: t.status === 'paid' ? 'Paid ✓' : (t.urgency === 'overdue' ? 'Overdue' : 'Pending'),
                    cls: `bill-badge bill-badge--${t.status === 'paid' ? 'success' : (t.urgency === 'overdue' ? 'danger' : 'warning')}`,
                });
                histRow.createSpan({
                    text: formatCurrency(t.amountDue, t.currency || this.settings.currencySymbol),
                    cls: 'wawarts-insp-hist-amt',
                });
                histRow.addEventListener('click', async (e) => {
                    await openNoteSafely(this.app, t.file, e as MouseEvent);
                });
            }
        } else {
            historySection.createDiv({
                text: 'No transaction due files generated for this master bill yet.',
                cls: 'wawarts-insp-empty-notes',
            });
        }

        // Live Note Body
        const notesSection = bodyEl.createDiv({ cls: 'wawarts-insp-section wawarts-insp-notes-section' });
        notesSection.createDiv({ text: 'Profile Body & Instructions', cls: 'wawarts-insp-section-title' });
        this.noteBodyEl = notesSection.createDiv({ cls: 'wawarts-insp-note-body markdown-rendered' });
        this.renderNoteBody(bill);

        // Footer Actions
        const footerEl = this.containerEl.createDiv({ cls: 'wawarts-insp-footer' });

        const openInNewTabBtn = footerEl.createEl('button', {
            cls: 'bills-btn-secondary wawarts-footer-btn',
            text: 'Open in Tab',
        });
        const tabIcon = openInNewTabBtn.createSpan({ cls: 'bills-btn-icon' });
        setIcon(tabIcon, 'file-plus');
        openInNewTabBtn.prepend(tabIcon);
        openInNewTabBtn.addEventListener('click', async () => {
            await openNoteSafely(this.app, bill.file, undefined, { fallbackLeaf: 'tab' });
        });

        const toggleActiveBtn = footerEl.createEl('button', {
            cls: 'bills-btn-secondary wawarts-footer-btn',
            text: bill.active ? 'Pause Schedule' : 'Activate',
        });
        toggleActiveBtn.addEventListener('click', async () => {
            await this.vaultService.updateMasterBill(bill.file, { active: !bill.active });
            new Notice(`${bill.name} schedule is now ${!bill.active ? 'active' : 'paused'}.`);
            this.onRefreshNeeded();
        });

        const deleteBtn = footerEl.createEl('button', {
            cls: 'bills-btn-danger wawarts-footer-btn',
            text: 'Delete',
        });
        const trashIcon = deleteBtn.createSpan({ cls: 'bills-btn-icon' });
        setIcon(trashIcon, 'trash-2');
        deleteBtn.prepend(trashIcon);
        deleteBtn.addEventListener('click', () => {
            new ConfirmModal(
                this.app,
                'Delete Master Bill',
                `Are you sure you want to delete master schedule "${bill.file.name}"?`,
                'Delete',
                true,
                async () => {
                    await this.vaultService.deleteMasterBill(bill.file);
                    new Notice(`Deleted master bill ${bill.name}`);
                    this.onClose();
                    this.onRefreshNeeded();
                }
            ).open();
        });
    }

    private async renderNoteBody(bill: MasterBill): Promise<void> {
        if (!this.noteBodyEl) return;
        this.noteBodyEl.empty();

        try {
            const content = await this.app.vault.read(bill.file);
            const bodyOnly = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

            if (!bodyOnly) {
                this.noteBodyEl.createDiv({
                    text: 'No additional instructions or login notes in master profile.',
                    cls: 'wawarts-insp-empty-notes',
                });
                return;
            }

            await MarkdownRenderer.render(
                this.app,
                bodyOnly,
                this.noteBodyEl,
                bill.file.path,
                this
            );
        } catch (err) {
            console.error('Failed to render master note body:', err);
            this.noteBodyEl.createDiv({ text: 'Error loading profile contents.', cls: 'wawarts-insp-empty-notes' });
        }
    }
}
