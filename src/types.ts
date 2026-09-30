import { TFile } from 'obsidian';

export type BillFrequency =
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'quarterly'
    | 'semiannual'
    | 'yearly'
    | 'custom_days';

export type TransactionStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

export type UrgencyStatus =
    | 'overdue'
    | 'due_today'
    | 'due_soon'
    | 'upcoming'
    | 'paid'
    | 'skipped';

export type HubTab = 'transactions' | 'master' | 'insights';

export type TransactionFilterTab = 'all' | 'pending' | 'due_soon' | 'overdue' | 'paid';

export type TransactionSortOption = 'due_date' | 'name' | 'category' | 'amount' | 'status';

/**
 * Master Bill Item
 * Definition / template of a recurring bill.
 */
export interface MasterBill {
    file: TFile;
    filePath: string;
    id: string;
    name: string;
    defaultAmount?: number;
    currency?: string;
    category: string;
    frequency: BillFrequency;
    frequencyInterval?: number;
    dueDay?: number; // Day of month (1-31)
    paymentMethod?: string;
    autoPay: boolean;
    reminderDays: number;
    accountNumber?: string;
    url?: string;
    tags: string[];
    notes?: string;
    active: boolean;
}

export interface NewMasterBillInput {
    name: string;
    defaultAmount?: number;
    currency?: string;
    category: string;
    frequency: BillFrequency;
    frequencyInterval?: number;
    dueDay?: number;
    paymentMethod?: string;
    autoPay: boolean;
    reminderDays?: number;
    accountNumber?: string;
    url?: string;
    tags?: string[];
    notes?: string;
    active?: boolean;
}

/**
 * Bill Transaction Instance
 * Individual due occurrence / receipt note.
 */
export interface BillTransaction {
    file: TFile;
    filePath: string;
    masterBillName: string;
    masterBillPath?: string;
    dueDate: string; // YYYY-MM-DD
    amountDue?: number;
    currency?: string;
    category: string;
    status: TransactionStatus;
    paidDate?: string; // YYYY-MM-DD
    amountPaid?: number;
    paymentMethod?: string;
    referenceNo?: string;
    autoPay: boolean;
    notes?: string;
    tags: string[];
    // Computed fields
    daysUntilDue: number;
    urgency: UrgencyStatus;
}

export interface NewTransactionInput {
    masterBillName: string;
    masterBillPath?: string;
    dueDate: string; // YYYY-MM-DD
    amountDue?: number;
    currency?: string;
    category?: string;
    paymentMethod?: string;
    autoPay?: boolean;
    notes?: string;
    tags?: string[];
}

export interface PayTransactionInput {
    paidDate: string; // YYYY-MM-DD
    amountPaid?: number;
    paymentMethod?: string;
    referenceNo?: string;
    notes?: string;
    tags?: string[];
}

export interface BatchGenerateOptions {
    targetMonth: string; // YYYY-MM
    selectedMasterIds?: string[];
}

export type MasterSortField = 'name' | 'category' | 'dueDay' | 'frequency' | 'amount' | 'status' | 'autoPay';

export interface MasterFilterOptions {
    searchQuery: string;
    categoryFilter: string;
    frequencyFilter: string;
    statusFilter: 'all' | 'active' | 'inactive';
    sortBy: MasterSortField;
    sortAsc: boolean;
}

export interface TransactionFilterOptions {
    activeTab: TransactionFilterTab;
    categoryFilter: string;
    selectedMonth: string; // 'all' or 'YYYY-MM'
    selectedYear: string; // 'YYYY'
    searchQuery: string;
    sortBy: TransactionSortOption;
    sortAsc?: boolean;
}

export interface RecurringBillsSettings {
    masterFolder: string;
    transactionsFolder: string;
    folderStructure: 'year-month' | 'flat' | 'by-bill';
    currencySymbol: string;
    currencyCode: string;
    dateFormat: string;
    defaultReminderDays: number;
    defaultCategory: string;
    categories: string[];
    paymentMethods: string[];
    enableStatusBar: boolean;
    paidTag: string;
    pendingTag: string;
    savedTransactionFilters?: Partial<TransactionFilterOptions>;
    savedMasterFilters?: Partial<MasterFilterOptions>;
    savedActiveHubTab?: HubTab;
}

export interface MonthSummary {
    monthStr: string; // YYYY-MM
    totalBills: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    percentagePaid: number;
}

export interface YearlySummary {
    yearStr: string; // YYYY
    totalBills: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    percentagePaid: number;
    monthlyStats: Array<{
        monthKey: string; // "01", "02", ...
        monthName: string; // "Jan", "Feb", ...
        total: number;
        paid: number;
        percentage: number;
    }>;
}

export interface CategoryProgressSummary {
    category: string;
    totalCount: number;
    paidCount: number;
    pendingCount: number;
    percentagePaid: number;
    color?: string;
}
