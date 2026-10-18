import { App, setIcon } from 'obsidian';
import { TransactionFilterOptions } from '../../types';
import { BillIndexService } from '../../services/BillIndexService';
import { getCurrentMonthStr } from '../../utils/dateUtils';
import { MonthFilterModal } from '../../modals/MonthFilterModal';

function formatMonthLabel(monthStr: string): string {
    if (!monthStr || monthStr === 'all') return 'All Months';
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return monthStr;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatMonthShort(monthStr: string): string {
    if (!monthStr || monthStr === 'all') return 'All';
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return monthStr;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short' });
}

function triggerHaptic(ms = 10): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(ms);
        } catch {
            // Ignore unsupported platforms
        }
    }
}

export class BillsMobileFloatingBar {
    static render(
        containerEl: HTMLElement,
        app: App,
        indexService: BillIndexService,
        filterOptions: TransactionFilterOptions,
        onOptionsChanged: (newOptions: TransactionFilterOptions) => void,
        onOpenNewMasterModal: () => void,
        onOpenNewDueModal: () => void,
        onOpenSettingsModal: () => void
    ): void {
        // Remove existing floating bar wrapper in containerEl if re-rendering
        containerEl.querySelectorAll('.bills-mobile-floating-bar-wrapper').forEach((el) => el.remove());

        // Floating Bar wrapper
        const wrapper = containerEl.createEl('div', { cls: 'bills-mobile-floating-bar-wrapper' });
        const fab = wrapper.createEl('div', { cls: 'bills-mobile-floating-bar' });

        const selectedMonth = filterOptions.selectedMonth || getCurrentMonthStr();
        const hasMonthFilter = selectedMonth !== 'all';

        // -------------------------------------------------------------
        // ICON 1: Calendar Month Filter (opens native MonthFilterModal)
        // -------------------------------------------------------------
        const calendarBtn = fab.createEl('button', {
            cls: `clickable-icon bills-fab-icon-btn bills-fab-month-btn ${hasMonthFilter ? 'is-active-filter' : ''}`,
            attr: { 'aria-label': `Select Due Month: ${formatMonthLabel(selectedMonth)}` },
        });
        const calIcon = calendarBtn.createEl('span', { cls: 'bills-fab-btn-icon' });
        setIcon(calIcon, 'calendar');

        if (hasMonthFilter) {
            calendarBtn.createEl('span', {
                text: formatMonthShort(selectedMonth),
                cls: 'bills-fab-month-badge',
            });
        }

        const openMonthModal = () => {
            triggerHaptic(10);
            new MonthFilterModal(app, indexService, filterOptions, (chosenMonth) => {
                filterOptions.selectedMonth = chosenMonth;
                filterOptions.activeTab = 'all';
                filterOptions.searchQuery = '';
                onOptionsChanged(filterOptions);
            }).open();
        };

        calendarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMonthModal();
        });

        // -------------------------------------------------------------
        // ICON 2: Add New Master (opens NewMasterBillModal)
        // -------------------------------------------------------------
        const masterBtn = fab.createEl('button', {
            cls: 'clickable-icon bills-fab-icon-btn bills-fab-master-btn',
            attr: { 'aria-label': 'Add New Master Bill' },
        });
        const masterIcon = masterBtn.createEl('span', { cls: 'bills-fab-btn-icon' });
        setIcon(masterIcon, 'folder-plus');
        masterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic(10);
            onOpenNewMasterModal();
        });

        // -------------------------------------------------------------
        // ICON 3: Add New Due (opens NewDueModal)
        // -------------------------------------------------------------
        const dueBtn = fab.createEl('button', {
            cls: 'clickable-icon bills-fab-icon-btn bills-fab-due-btn',
            attr: { 'aria-label': 'Add New Due' },
        });
        const dueIcon = dueBtn.createEl('span', { cls: 'bills-fab-btn-icon' });
        setIcon(dueIcon, 'calendar-plus');
        dueBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic(10);
            onOpenNewDueModal();
        });

        // -------------------------------------------------------------
        // ICON 4: Settings (opens FolderSettingsModal)
        // -------------------------------------------------------------
        const settingsBtn = fab.createEl('button', {
            cls: 'clickable-icon bills-fab-icon-btn bills-fab-settings-btn',
            attr: { 'aria-label': 'Settings & Folder Locations' },
        });
        const setIconEl = settingsBtn.createEl('span', { cls: 'bills-fab-btn-icon' });
        setIcon(setIconEl, 'settings');
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic(10);
            onOpenSettingsModal();
        });
    }
}
