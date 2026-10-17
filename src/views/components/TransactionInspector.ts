import { App, Component, MarkdownRenderer, Notice, Platform, setIcon } from 'obsidian';
import { BillTransaction, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { formatCurrency } from '../../utils/currencyUtils';
import { getRelativeDueDateLabel } from '../../utils/dateUtils';
import { openNoteSafely, attachHoverPreview } from '../../utils/navigationUtils';
import { PayTransactionModal } from '../../modals/PayTransactionModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { isTablet } from '../../utils/domUtils';

export class TransactionInspector extends Component {
    private app: App;
    private containerEl: HTMLElement;
    private vaultService: BillVaultService;
    private settings: RecurringBillsSettings;
    private transaction: BillTransaction | null = null;
    private onClose: () => void;
    private onRefreshNeeded: () => void;
    private noteBodyEl: HTMLElement | null = null;

    constructor(
        app: App,
        containerEl: HTMLElement,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onClose: () => void,
        onRefreshNeeded: () => void
    ) {
        super();
        this.app = app;
        this.containerEl = containerEl;
        this.vaultService = vaultService;
        this.settings = settings;
        this.onClose = onClose;
        this.onRefreshNeeded = onRefreshNeeded;
    }

    public inspect(transaction: BillTransaction | null): void {
        this.transaction = transaction;
        this.render();
    }

    public get activeTransaction(): BillTransaction | null {
        return this.transaction;
    }

    public render(): void {
        this.containerEl.empty();

        if (!this.transaction) {
            this.containerEl.style.display = 'none';
            this.containerEl.removeClass('is-open');
            return;
        }

        const trans = this.transaction;
        this.containerEl.style.display = 'flex';
        this.containerEl.addClass('is-open');

        const isMobileDevice = Platform.isMobile && !isTablet();

        // 1. Mobile Drag Handle
        if (isMobileDevice) {
            const dragWrap = this.containerEl.createDiv({ cls: 'pos-sheet-drag-handle-wrap' });
            dragWrap.createDiv({ cls: 'pos-sheet-drag-handle' });
            dragWrap.addEventListener('click', () => this.onClose());
        }

        // 2. Header
        const headerEl = this.containerEl.createDiv({ cls: 'wawarts-insp-header' });
        const titleArea = headerEl.createDiv({ cls: 'wawarts-insp-title-area' });

        const iconEl = titleArea.createSpan({ cls: 'wawarts-insp-icon' });
        setIcon(iconEl, 'receipt');

        const headerTitles = titleArea.createDiv({ cls: 'wawarts-insp-titles' });
        headerTitles.createEl('h3', { text: trans.masterBillName, cls: 'wawarts-insp-title' });
        headerTitles.createEl('div', { text: trans.file.name, cls: 'wawarts-insp-subtext' });

        const headerActions = headerEl.createDiv({ cls: 'wawarts-insp-header-actions' });

        // Safe Jump Link (Open in Adjacent Split)
        const openFileBtn = headerActions.createEl('button', {
            cls: 'pos-btn-icon wawarts-insp-action-btn',
            attr: { 'aria-label': 'Open note in adjacent split (leaves Wawarts open)' },
        });
        setIcon(openFileBtn, 'arrow-up-right');
        openFileBtn.addEventListener('click', async (e) => {
            await openNoteSafely(this.app, trans.file, e, { fallbackLeaf: 'split' });
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

        const isPaid = trans.status === 'paid';
        const formattedAmount = formatCurrency(
            trans.amountDue,
            trans.currency || this.settings.currencySymbol,
            this.settings.currencyCode
        );

        heroLeft.createDiv({ text: formattedAmount, cls: 'wawarts-insp-hero-amount' });
        heroLeft.createDiv({
            text: getRelativeDueDateLabel(trans.daysUntilDue, trans.status),
            cls: `bill-badge bill-badge--due-status bill-badge--${isPaid ? 'success' : (trans.urgency === 'overdue' ? 'danger' : trans.urgency === 'due_soon' ? 'warning' : 'neutral')}`,
        });

        const heroRight = heroBox.createDiv({ cls: 'wawarts-insp-hero-right' });
        if (!isPaid) {
            const payBtn = heroRight.createEl('button', {
                cls: 'mod-cta bills-btn-success wawarts-insp-pay-btn',
                text: 'Record Payment',
            });
            const payIcon = payBtn.createSpan({ cls: 'bills-btn-icon' });
            setIcon(payIcon, 'check-circle-2');
            payBtn.prepend(payIcon);

            payBtn.addEventListener('click', () => {
                new PayTransactionModal(this.app, trans, this.vaultService, this.settings, () => {
                    this.onRefreshNeeded();
                }).open();
            });
        } else {
            const undoBtn = heroRight.createEl('button', {
                cls: 'bills-btn-secondary wawarts-insp-undo-btn',
                text: 'Mark Pending',
            });
            const undoIcon = undoBtn.createSpan({ cls: 'bills-btn-icon' });
            setIcon(undoIcon, 'rotate-ccw');
            undoBtn.prepend(undoIcon);

            undoBtn.addEventListener('click', async () => {
                await this.vaultService.toggleTransactionStatus(trans.file, 'pending');
                new Notice(`Reset ${trans.masterBillName} to pending.`);
                this.onRefreshNeeded();
            });
        }

        // Quick Due Date Adjust Chips (if not paid)
        if (!isPaid) {
            const quickDateSection = bodyEl.createDiv({ cls: 'wawarts-insp-section' });
            quickDateSection.createDiv({ text: 'Quick Snooze / Reschedule Due Date', cls: 'wawarts-insp-section-title' });

            const quickDateChips = quickDateSection.createDiv({ cls: 'wawarts-insp-date-chips' });
            const todayStr = window.moment ? window.moment().format('YYYY-MM-DD') : new Date().toISOString().slice(0, 10);
            const tomorrowStr = window.moment ? window.moment().add(1, 'day').format('YYYY-MM-DD') : '';
            const nextWeekStr = window.moment ? window.moment().add(7, 'day').format('YYYY-MM-DD') : '';

            const createDateBtn = (label: string, targetDate: string) => {
                const btn = quickDateChips.createEl('button', {
                    cls: `pos-header-text-btn wawarts-date-chip ${trans.dueDate === targetDate ? 'is-active' : ''}`,
                    text: label,
                });
                btn.addEventListener('click', async () => {
                    await this.vaultService.updateTransactionDueDate(trans.file, targetDate);
                    new Notice(`Rescheduled ${trans.masterBillName} to ${targetDate}`);
                    this.onRefreshNeeded();
                });
            };

            createDateBtn('Today', todayStr);
            if (tomorrowStr) createDateBtn('Tomorrow', tomorrowStr);
            if (nextWeekStr) createDateBtn('+7 Days', nextWeekStr);
        }

        // Metadata Grid Section
        const metaSection = bodyEl.createDiv({ cls: 'wawarts-insp-section' });
        metaSection.createDiv({ text: 'Bill Metadata & Account', cls: 'wawarts-insp-section-title' });

        const grid = metaSection.createDiv({ cls: 'wawarts-insp-grid' });

        // Master Bill Link (Safe Open & Hover Preview)
        const masterItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
        masterItem.createDiv({ text: 'Master Profile', cls: 'wawarts-insp-grid-label' });
        const masterLink = masterItem.createEl('a', {
            cls: 'internal-link wawarts-insp-master-link',
            text: trans.masterBillName,
        });
        if (trans.masterBillPath) {
            attachHoverPreview(this.app, masterLink, trans.masterBillPath, this);
            masterLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await openNoteSafely(this.app, trans.masterBillPath!, e);
            });
        }

        // Category
        const catItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
        catItem.createDiv({ text: 'Category', cls: 'wawarts-insp-grid-label' });
        catItem.createDiv({ text: trans.category, cls: 'bill-badge bill-badge--neutral' });

        // Due Date
        const dueItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
        dueItem.createDiv({ text: 'Scheduled Due Date', cls: 'wawarts-insp-grid-label' });
        dueItem.createDiv({ text: trans.dueDate, cls: 'wawarts-insp-grid-value' });

        // Payment Method
        if (trans.paymentMethod) {
            const methodItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            methodItem.createDiv({ text: 'Payment Method', cls: 'wawarts-insp-grid-label' });
            methodItem.createDiv({ text: trans.paymentMethod, cls: 'wawarts-insp-grid-value' });
        }

        // Auto-Pay
        if (trans.autoPay) {
            const autoItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            autoItem.createDiv({ text: 'Auto-Pay', cls: 'wawarts-insp-grid-label' });
            autoItem.createDiv({ text: '⚡ Active', cls: 'bill-badge bill-badge--purple' });
        }

        // Paid Details (if settled)
        if (trans.paidDate) {
            const paidDateItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            paidDateItem.createDiv({ text: 'Settlement Date', cls: 'wawarts-insp-grid-label' });
            paidDateItem.createDiv({ text: trans.paidDate, cls: 'wawarts-insp-grid-value' });
        }
        if (trans.amountPaid !== undefined) {
            const paidAmtItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            paidAmtItem.createDiv({ text: 'Amount Paid', cls: 'wawarts-insp-grid-label' });
            paidAmtItem.createDiv({
                text: formatCurrency(trans.amountPaid, trans.currency || this.settings.currencySymbol),
                cls: 'wawarts-insp-grid-value',
            });
        }
        if (trans.referenceNo) {
            const refItem = grid.createDiv({ cls: 'wawarts-insp-grid-item' });
            refItem.createDiv({ text: 'Confirmation / Ref Code', cls: 'wawarts-insp-grid-label' });
            refItem.createDiv({ text: trans.referenceNo, cls: 'wawarts-insp-grid-value font-monospace' });
        }

        // 4. Live In-Inspector Markdown Note Body
        const notesSection = bodyEl.createDiv({ cls: 'wawarts-insp-section wawarts-insp-notes-section' });
        const notesHeader = notesSection.createDiv({ cls: 'wawarts-insp-notes-header' });
        notesHeader.createDiv({ text: 'Note Content & Receipts', cls: 'wawarts-insp-section-title' });

        this.noteBodyEl = notesSection.createDiv({ cls: 'wawarts-insp-note-body markdown-rendered' });
        this.renderNoteBody(trans);

        // 5. Quick Append Bar (DIWA rule: zero-friction capture into target note)
        const appendBox = notesSection.createDiv({ cls: 'wawarts-insp-append-box' });
        const appendInput = appendBox.createEl('input', {
            type: 'text',
            cls: 'wawarts-insp-append-input',
            placeholder: 'Add note, receipt or confirmation number (↵ to save)...',
        });
        const appendBtn = appendBox.createEl('button', {
            cls: 'pos-btn-icon wawarts-insp-append-btn',
            attr: { 'aria-label': 'Append note' },
        });
        setIcon(appendBtn, 'corner-down-left');

        const handleAppend = async () => {
            const text = appendInput.value.trim();
            if (!text) return;
            appendInput.value = '';
            try {
                await this.vaultService.appendNoteToTransaction(trans.file, text);
                new Notice(`Added note to ${trans.file.name}`);
                this.renderNoteBody(trans);
            } catch (err) {
                console.error('Failed to append note:', err);
                new Notice('Failed to append note.');
            }
        };

        appendInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAppend();
            }
        });
        appendBtn.addEventListener('click', handleAppend);

        // 6. Footer Actions
        const footerEl = this.containerEl.createDiv({ cls: 'wawarts-insp-footer' });

        const openInNewTabBtn = footerEl.createEl('button', {
            cls: 'bills-btn-secondary wawarts-footer-btn',
            text: 'Open in Tab',
        });
        const tabIcon = openInNewTabBtn.createSpan({ cls: 'bills-btn-icon' });
        setIcon(tabIcon, 'file-plus');
        openInNewTabBtn.prepend(tabIcon);
        openInNewTabBtn.addEventListener('click', async () => {
            await openNoteSafely(this.app, trans.file, undefined, { fallbackLeaf: 'tab' });
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
                'Delete Due File',
                `Are you sure you want to delete "${trans.file.name}"? This file will be removed from your vault.`,
                'Delete',
                true,
                async () => {
                    await this.vaultService.deleteTransaction(trans.file);
                    new Notice(`Deleted ${trans.file.name}`);
                    this.onClose();
                    this.onRefreshNeeded();
                }
            ).open();
        });
    }

    private async renderNoteBody(trans: BillTransaction): Promise<void> {
        if (!this.noteBodyEl) return;
        this.noteBodyEl.empty();

        try {
            const content = await this.app.vault.read(trans.file);
            // Strip frontmatter
            const bodyOnly = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

            if (!bodyOnly) {
                this.noteBodyEl.createDiv({
                    text: 'No additional notes or receipts yet.',
                    cls: 'wawarts-insp-empty-notes',
                });
                return;
            }

            await MarkdownRenderer.render(
                this.app,
                bodyOnly,
                this.noteBodyEl,
                trans.file.path,
                this
            );
        } catch (err) {
            console.error('Failed to render note body in inspector:', err);
            this.noteBodyEl.createDiv({ text: 'Error loading note contents.', cls: 'wawarts-insp-empty-notes' });
        }
    }
}
