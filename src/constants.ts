import { RecurringBillsSettings, BillFrequency } from './types';

export const PLUGIN_ID = 'wawarts';
export const PLUGIN_NAME = 'Wawarts';

export const VIEW_TYPE_BILLS_HUB = 'recurring-bills-hub-view';

export const BILLS_RIBBON_ICON_ID = 'bills-monitor-ribbon';
export const BILLS_RIBBON_ICON_SVG = `<g transform="translate(10,10) scale(3.3)">
    <rect x="3" y="2" width="18" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <line x1="7" y1="7" x2="17" y2="7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="7" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="7" y1="15" x2="11" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="16" cy="15" r="1.5" fill="currentColor"/>
</g>`;

export const DEFAULT_CATEGORIES: string[] = [
    'Utilities',
    'Subscriptions',
    'Housing & Rent',
    'Software & SaaS',
    'Insurance',
    'Telecom & Internet',
    'Fitness & Health',
    'Memberships',
    'Credit & Loans',
    'Taxes & Government',
    'Other',
];

export const DEFAULT_PAYMENT_METHODS: string[] = [
    'Credit Card',
    'Debit Card',
    'Bank Transfer',
    'Direct Debit (Auto)',
    'PayPal',
    'Apple Pay',
    'Cash',
];

export interface CurrencyOption {
    code: string;
    symbol: string;
    label: string;
}

export const COMMON_CURRENCIES: CurrencyOption[] = [
    { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
    { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
    { code: 'PHP', symbol: '₱', label: 'PHP (₱) - Philippine Peso' },
    { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
    { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
    { code: 'CAD', symbol: '$', label: 'CAD ($) - Canadian Dollar' },
    { code: 'AUD', symbol: '$', label: 'AUD ($) - Australian Dollar' },
    { code: 'SGD', symbol: '$', label: 'SGD ($) - Singapore Dollar' },
    { code: 'CHF', symbol: 'Fr', label: 'CHF (Fr) - Swiss Franc' },
    { code: 'AED', symbol: 'AED', label: 'AED (د.إ) - UAE Dirham' },
    { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
    { code: 'CNY', symbol: '¥', label: 'CNY (¥) - Chinese Yuan' },
    { code: 'NZD', symbol: '$', label: 'NZD ($) - New Zealand Dollar' },
    { code: 'BRL', symbol: 'R$', label: 'BRL (R$) - Brazilian Real' },
    { code: 'SEK', symbol: 'kr', label: 'SEK (kr) - Swedish Krona' },
    { code: 'CUSTOM', symbol: '', label: 'Custom Currency...' },
];

export const DEFAULT_SETTINGS: RecurringBillsSettings = {
    masterFolder: 'Bills/Master',
    transactionsFolder: 'Bills/Transactions',
    folderStructure: 'year-month',
    currencySymbol: '$',
    currencyCode: 'USD',
    dateFormat: 'YYYY-MM-DD',
    defaultReminderDays: 3,
    defaultCategory: 'Subscriptions',
    categories: DEFAULT_CATEGORIES,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    enableStatusBar: true,
    paidTag: 'bill/paid',
    pendingTag: 'bill/pending',
    savedTransactionFilters: {
        activeTab: 'all',
        categoryFilter: 'all',
        selectedMonth: '',
        selectedYear: '',
        searchQuery: '',
        sortBy: 'due_date',
    },
    savedMasterFilters: {
        searchQuery: '',
        categoryFilter: 'all',
        frequencyFilter: 'all',
        statusFilter: 'all',
        sortBy: 'dueDay',
        sortAsc: true,
    },
    savedActiveHubTab: 'transactions',
};

export const FREQUENCY_LABELS: Record<BillFrequency, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly (Every 2 weeks)',
    monthly: 'Monthly',
    quarterly: 'Quarterly (Every 3 months)',
    semiannual: 'Semi-annually (Every 6 months)',
    yearly: 'Yearly (Annual)',
    custom_days: 'Custom Days',
};

export const CATEGORY_COLORS: Record<string, string> = {
    'Utilities': 'var(--color-yellow, #eab308)',
    'Subscriptions': 'var(--color-purple, #a855f7)',
    'Housing & Rent': 'var(--color-blue, #3b82f6)',
    'Software & SaaS': 'var(--color-cyan, #06b6d4)',
    'Insurance': 'var(--color-red, #ef4444)',
    'Telecom & Internet': 'var(--color-indigo, #6366f1)',
    'Fitness & Health': 'var(--color-green, #10b981)',
    'Memberships': 'var(--color-orange, #f97316)',
    'Credit & Loans': 'var(--color-pink, #ec4899)',
    'Taxes & Government': 'var(--color-emerald, #059669)',
    'Other': 'var(--text-muted, #888888)',
};
