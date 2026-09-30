import { App, Menu, setIcon, Notice } from 'obsidian';
import { MasterBill, RecurringBillsSettings } from '../../types';
import { BillVaultService } from '../../services/BillVaultService';
import { formatCurrency } from '../../utils/currencyUtils';
import { FREQUENCY_LABELS, CATEGORY_COLORS } from '../../constants';
import { getCurrentMonthStr, computeDueDateForMonth } from '../../utils/dateUtils';
import { EditMasterBillModal } from '../../modals/EditMasterBillModal';
import { ConfirmModal } from '../../modals/ConfirmModal';

export class MasterBillCardItem {
    static render(
        containerEl: HTMLElement,
        app: App,
        bill: MasterBill,
        vaultService: BillVaultService,
        settings: RecurringBillsSettings,
        onRefreshNeeded: () => void
    ): HTMLElement {
        const card = containerEl.createEl('div', {
            cls: `bill-card bill-card--master ${!bill.active ? 'bill-card--paused' : ''}`,
        });

        // Indicator stripe
        const indicator = card.createEl('div', { cls: 'bill-card-indicator' });
        indicator.style.backgroundColor = CATEGORY_COLORS[bill.category] || 'var(--interactive-accent)';

        // Left Content
        const mainContent = card.createEl('div', { cls: 'bill-card-content' });

        const topRow = mainContent.createEl('div', { cls: 'bill-card-toprow' });
        const titleGroup = topRow.createEl('div', { cls: 'bill-card-title-group' });
        titleGroup.createEl('span', { text: bill.name, cls: 'bill-card-name' });

        if (bill.autoPay) {
            const autoPayBadge = titleGroup.createEl('span', {
                cls: 'bill-card-autopay-icon',
                attr: { 'aria-label': 'Auto-Pay Configured' },
            });
            setIcon(autoPayBadge, 'zap');
        }

        if (!bill.active) {
            topRow.createEl('span', { text: 'Inactive', cls: 'bill-badge bill-badge--neutral' });
        }

        // Metadata row
        const metaRow = mainContent.createEl('div', { cls: 'bill-card-metarow' });

        // Category Pill
        const catColor = CATEGORY_COLORS[bill.category] || 'var(--interactive-accent)';
        const catPill = metaRow.createEl('span', { text: bill.category, cls: 'bill-badge bill-badge--category' });
        catPill.style.borderColor = catColor;
        catPill.style.color = catColor;

        // Due Day info
        if (bill.dueDay) {
            metaRow.createEl('span', {
                text: `Scheduled: Day ${bill.dueDay} of month`,
                cls: 'bill-card-due-date',
            });
        }

        if (bill.paymentMethod) {
            metaRow.createEl('span', {
                text: bill.paymentMethod,
                cls: 'bill-badge bill-badge--neutral bill-badge--method',
            });
        }

        if (bill.accountNumber) {
            metaRow.createEl('span', {
                text: `Ref: ${bill.accountNumber}`,
                cls: 'bill-card-last-paid',
            });
        }

        // Right Section: Cadence Badge & Actions
        const rightSection = card.createEl('div', { cls: 'bill-card-right-section' });

        const priceBlock = rightSection.createEl('div', { cls: 'bill-card-price-block' });
        priceBlock.createEl('div', {
            text: FREQUENCY_LABELS[bill.frequency] || bill.frequency,
            cls: 'bill-badge bill-badge--accent',
        });

        if (bill.defaultAmount !== undefined && bill.defaultAmount > 0) {
            priceBlock.createEl('div', {
                text: `Est: ${formatCurrency(bill.defaultAmount, bill.currency || settings.currencySymbol, settings.currencyCode)}`,
                cls: 'bills-metric-subtext',
            });
        }

        // Action Buttons
        const actionsGroup = rightSection.createEl('div', { cls: 'bill-card-actions-group' });

        // Generate Due File Button
        const genBtn = actionsGroup.createEl('button', {
            text: 'Create Due File',
            cls: 'bills-btn-action bills-btn-secondary',
            attr: { 'aria-label': 'Generate Due File for Current Month' },
        });
        const genIcon = genBtn.createEl('span', { cls: 'bills-btn-icon' });
        setIcon(genIcon, 'plus-circle');

        genBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentMonth = getCurrentMonthStr();
            const dueDate = computeDueDateForMonth(currentMonth, bill.dueDay, bill.frequency);
            try {
                await vaultService.createTransactionFile({
                    masterBillName: bill.name,
                    masterBillPath: bill.filePath,
                    dueDate,
                    amountDue: bill.defaultAmount,
                    currency: bill.currency,
                    category: bill.category,
                    paymentMethod: bill.paymentMethod,
                    autoPay: bill.autoPay,
                    notes: bill.notes,
                });
                new Notice(`Created due file for ${bill.name} (${dueDate})`);
                onRefreshNeeded();
            } catch (err) {
                console.error(err);
                new Notice('Failed to create due file.');
            }
        });

        // 3-Dots More Menu
        const moreBtn = actionsGroup.createEl('button', {
            cls: 'bills-btn-action bills-btn-more',
            attr: { 'aria-label': 'Options' },
        });
        setIcon(moreBtn, 'more-vertical');

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = new Menu();

            menu.addItem((item) => {
                item.setTitle('Edit Master Profile')
                    .setIcon('pencil')
                    .onClick(() => {
                        new EditMasterBillModal(app, bill, vaultService, settings, onRefreshNeeded).open();
                    });
            });

            menu.addItem((item) => {
                item.setTitle('Open Master Note')
                    .setIcon('external-link')
                    .onClick(async () => {
                        await app.workspace.getLeaf(false).openFile(bill.file);
                    });
            });

            menu.addSeparator();

            menu.addItem((item) => {
                item.setTitle(bill.active ? 'Deactivate Bill' : 'Activate Bill')
                    .setIcon(bill.active ? 'pause' : 'play')
                    .onClick(async () => {
                        await vaultService.updateMasterBill(bill.file, { active: !bill.active });
                        new Notice(bill.active ? `Deactivated ${bill.name}` : `Activated ${bill.name}`);
                        onRefreshNeeded();
                    });
            });

            menu.addItem((item) => {
                item.setTitle('Delete Master Item')
                    .setIcon('trash')
                    .onClick(() => {
                        new ConfirmModal(
                            app,
                            'Delete Master Bill',
                            `Are you sure you want to delete master profile "${bill.name}"?`,
                            'Delete',
                            true,
                            async () => {
                                await vaultService.deleteMasterBill(bill.file);
                                new Notice(`Deleted ${bill.name}`);
                                onRefreshNeeded();
                            }
                        ).open();
                    });
            });

            menu.showAtMouseEvent(e);
        });

        card.addEventListener('click', () => {
            new EditMasterBillModal(app, bill, vaultService, settings, onRefreshNeeded).open();
        });

        return card;
    }
}
