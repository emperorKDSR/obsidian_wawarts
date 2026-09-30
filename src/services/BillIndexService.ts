import { App, TFile, normalizePath, moment } from 'obsidian';
import {
    MasterBill,
    BillTransaction,
    RecurringBillsSettings,
    TransactionFilterOptions,
    BillFrequency,
    TransactionStatus,
    MonthSummary,
    YearlySummary,
    CategoryProgressSummary,
} from '../types';
import { getDaysUntilDue, getTransactionUrgency, getCurrentMonthStr, getCurrentYearStr } from '../utils/dateUtils';
import { CATEGORY_COLORS } from '../constants';

export class BillIndexService {
    private app: App;
    private settings: RecurringBillsSettings;
    private masterMap: Map<string, MasterBill> = new Map();
    private transactionMap: Map<string, BillTransaction> = new Map();

    constructor(app: App, settings: RecurringBillsSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: RecurringBillsSettings): void {
        this.settings = settings;
    }

    isTransactionFile(path: string, file?: TFile): boolean {
        if (!path.endsWith('.md')) return false;

        const targetFile = file || this.app.vault.getAbstractFileByPath(path);
        if (targetFile instanceof TFile) {
            const cache = this.app.metadataCache.getFileCache(targetFile);
            const fm = cache?.frontmatter;
            if (fm) {
                if (fm.type === 'bill-transaction') return true;
                if (fm.type === 'master-bill') return false;
                if (fm.master_bill || fm.due_date || fm.paid_date) return true;
                if (Array.isArray(fm.tags) && fm.tags.some((t: string) => String(t).includes('transaction'))) return true;
            }
        }

        const normPath = normalizePath(path);
        const normTrans = normalizePath(this.settings.transactionsFolder);
        return normPath === normTrans || normPath.startsWith(normTrans + '/');
    }

    isMasterFile(path: string, file?: TFile): boolean {
        if (!path.endsWith('.md')) return false;

        // If it qualifies as a transaction, it is NEVER a master file
        if (this.isTransactionFile(path, file)) return false;

        const targetFile = file || this.app.vault.getAbstractFileByPath(path);
        if (targetFile instanceof TFile) {
            const cache = this.app.metadataCache.getFileCache(targetFile);
            const fm = cache?.frontmatter;
            if (fm) {
                if (fm.type === 'master-bill') return true;
                if (fm.type === 'bill-transaction') return false;
                if (fm.master_bill || fm.due_date) return false;
                if (Array.isArray(fm.tags) && fm.tags.some((t: string) => String(t).includes('master'))) return true;
            }
        }

        const normPath = normalizePath(path);
        const normMaster = normalizePath(this.settings.masterFolder);
        const normTrans = normalizePath(this.settings.transactionsFolder);

        // Never match if path is within transactions folder
        if (normPath === normTrans || normPath.startsWith(normTrans + '/')) {
            return false;
        }

        return normPath === normMaster || normPath.startsWith(normMaster + '/');
    }

    isBillFile(path: string, file?: TFile): boolean {
        return this.isMasterFile(path, file) || this.isTransactionFile(path, file);
    }

    async indexFile(file: TFile): Promise<void> {
        const isTx = this.isTransactionFile(file.path, file);
        const isM = !isTx && this.isMasterFile(file.path, file);

        if (isTx) {
            this.masterMap.delete(file.path);
            await this.indexTransactionFile(file);
        } else if (isM) {
            this.transactionMap.delete(file.path);
            await this.indexMasterFile(file);
        } else {
            this.masterMap.delete(file.path);
            this.transactionMap.delete(file.path);
        }
    }

    removeFile(path: string): void {
        this.masterMap.delete(path);
        this.transactionMap.delete(path);
    }

    private async indexMasterFile(file: TFile): Promise<MasterBill | null> {
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter || {};

        // Guard: strictly reject transactions from being indexed into masterMap
        if (
            fm.type === 'bill-transaction' ||
            fm.master_bill ||
            fm.due_date ||
            (fm.status && ['pending', 'paid', 'overdue', 'skipped'].includes(String(fm.status).toLowerCase()))
        ) {
            this.masterMap.delete(file.path);
            return null;
        }

        const name = String(fm.name || fm.title || file.basename).trim();
        const rawAmount = fm.default_amount ?? fm.amount;
        const defaultAmount = typeof rawAmount === 'number' ? rawAmount : (rawAmount ? parseFloat(String(rawAmount)) : undefined);
        const currency = fm.currency ? String(fm.currency).trim() : (this.settings.currencySymbol || this.settings.currencyCode || '$');

        let frequency: BillFrequency = 'monthly';
        const rawFreq = String(fm.frequency || 'monthly').toLowerCase().trim();
        if (rawFreq.includes('week') && !rawFreq.includes('bi')) frequency = 'weekly';
        else if (rawFreq.includes('biweek') || rawFreq.includes('2 week')) frequency = 'biweekly';
        else if (rawFreq.includes('month') && !rawFreq.includes('semi') && !rawFreq.includes('quarter')) frequency = 'monthly';
        else if (rawFreq.includes('quarter')) frequency = 'quarterly';
        else if (rawFreq.includes('semi') || rawFreq.includes('6 month')) frequency = 'semiannual';
        else if (rawFreq.includes('year') || rawFreq.includes('annual')) frequency = 'yearly';
        else if (rawFreq.includes('day') || rawFreq.includes('custom')) frequency = 'custom_days';

        const frequencyInterval = fm.frequency_interval ? parseInt(String(fm.frequency_interval), 10) : undefined;
        const dueDay = fm.due_day !== undefined ? parseInt(String(fm.due_day), 10) : undefined;

        const rawCategory = fm.category || this.settings.defaultCategory;
        const category = Array.isArray(rawCategory) ? String(rawCategory[0]) : String(rawCategory).replace(/^#+/, '').trim();

        const paymentMethod = fm.payment_method ? String(fm.payment_method).trim() : undefined;
        const autoPay = Boolean(fm.auto_pay ?? false);
        const reminderDays = fm.reminder_days !== undefined ? parseInt(String(fm.reminder_days), 10) : this.settings.defaultReminderDays;
        const accountNumber = fm.account_number ? String(fm.account_number).trim() : undefined;
        const url = fm.url ? String(fm.url).trim() : undefined;
        const active = fm.active !== false;

        let tags: string[] = [];
        if (Array.isArray(fm.tags)) tags = fm.tags.map(String);
        else if (typeof fm.tags === 'string') tags = fm.tags.split(',').map((s) => s.trim());

        const masterBill: MasterBill = {
            file,
            filePath: file.path,
            id: file.basename,
            name,
            defaultAmount,
            currency,
            category: category || this.settings.defaultCategory,
            frequency,
            frequencyInterval,
            dueDay,
            paymentMethod,
            autoPay,
            reminderDays,
            accountNumber,
            url,
            tags,
            active,
        };

        this.masterMap.set(file.path, masterBill);
        return masterBill;
    }

    private async indexTransactionFile(file: TFile): Promise<BillTransaction | null> {
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter || {};

        // Guard: strictly reject pure master definitions from being indexed into transactionMap
        if (fm.type === 'master-bill' && !fm.master_bill && !fm.due_date) {
            this.transactionMap.delete(file.path);
            return null;
        }

        const rawMaster = fm.master_bill || fm.master || file.basename.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '');
        const masterBillName = String(rawMaster).replace(/^\[\[|\]\]$/g, '').trim();

        const rawDue = fm.due_date || fm.due || '';
        const dueDate = String(rawDue).replace(/^\[\[|\]\]$/g, '').trim();

        const rawAmountDue = fm.amount_due ?? fm.amount;
        const amountDue = typeof rawAmountDue === 'number' ? rawAmountDue : (rawAmountDue ? parseFloat(String(rawAmountDue)) : undefined);

        const currency = fm.currency ? String(fm.currency).trim() : (this.settings.currencySymbol || this.settings.currencyCode || '$');
        const category = String(fm.category || this.settings.defaultCategory).replace(/^#+/, '').trim();

        let status: TransactionStatus = 'pending';
        const rawStatus = String(fm.status || 'pending').toLowerCase().trim();
        if (['pending', 'paid', 'overdue', 'skipped'].includes(rawStatus)) {
            status = rawStatus as TransactionStatus;
        }

        const paidDate = fm.paid_date ? String(fm.paid_date).replace(/^\[\[|\]\]$/g, '').trim() : undefined;
        const amountPaid = fm.amount_paid !== undefined && fm.amount_paid !== null ? parseFloat(String(fm.amount_paid)) : undefined;
        const paymentMethod = fm.payment_method ? String(fm.payment_method).trim() : undefined;
        const referenceNo = fm.reference_no ? String(fm.reference_no).trim() : undefined;
        const autoPay = Boolean(fm.auto_pay ?? false);

        let tags: string[] = [];
        if (Array.isArray(fm.tags)) tags = fm.tags.map(String);
        else if (typeof fm.tags === 'string') tags = fm.tags.split(',').map((s) => s.trim());

        const daysUntilDue = dueDate ? getDaysUntilDue(dueDate) : 999999;
        const urgency = getTransactionUrgency(dueDate, status, this.settings.defaultReminderDays);

        if (status === 'pending' && daysUntilDue < 0) {
            status = 'overdue';
        }

        const transaction: BillTransaction = {
            file,
            filePath: file.path,
            masterBillName,
            dueDate,
            amountDue,
            currency,
            category,
            status,
            paidDate,
            amountPaid,
            paymentMethod,
            referenceNo,
            autoPay,
            tags,
            daysUntilDue,
            urgency,
        };

        this.transactionMap.set(file.path, transaction);
        return transaction;
    }

    async buildFullIndex(): Promise<void> {
        this.masterMap.clear();
        this.transactionMap.clear();

        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            await this.indexFile(file);
        }
    }

    /* ==========================================================================
       QUERIES
       ========================================================================== */

    getAllMasterBills(): MasterBill[] {
        return Array.from(this.masterMap.values());
    }

    getAllTransactions(): BillTransaction[] {
        return Array.from(this.transactionMap.values());
    }

    getAvailableMonths(): string[] {
        const set = new Set<string>();
        for (const trans of this.transactionMap.values()) {
            if (trans.dueDate && trans.dueDate.length >= 7) {
                set.add(trans.dueDate.substring(0, 7));
            }
        }
        set.add(getCurrentMonthStr());
        return Array.from(set).sort().reverse();
    }

    getAvailableYears(): string[] {
        const set = new Set<string>();
        for (const trans of this.transactionMap.values()) {
            if (trans.dueDate && trans.dueDate.length >= 4) {
                set.add(trans.dueDate.substring(0, 4));
            }
        }
        set.add(getCurrentYearStr());
        return Array.from(set).sort().reverse();
    }

    getFilteredTransactions(options: TransactionFilterOptions): BillTransaction[] {
        let list = this.getAllTransactions();

        if (options.selectedMonth && options.selectedMonth !== 'all') {
            list = list.filter((t) => t.dueDate && t.dueDate.startsWith(options.selectedMonth));
        } else if (options.selectedYear && options.selectedYear !== 'all') {
            list = list.filter((t) => t.dueDate && t.dueDate.startsWith(options.selectedYear));
        }

        if (options.searchQuery.trim()) {
            const query = options.searchQuery.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    t.masterBillName.toLowerCase().includes(query) ||
                    t.category.toLowerCase().includes(query) ||
                    (t.paymentMethod && t.paymentMethod.toLowerCase().includes(query)) ||
                    (t.referenceNo && t.referenceNo.toLowerCase().includes(query)) ||
                    t.tags.some((tag) => tag.toLowerCase().includes(query))
            );
        }

        if (options.categoryFilter && options.categoryFilter !== 'all') {
            list = list.filter((t) => t.category.toLowerCase() === options.categoryFilter.toLowerCase());
        }

        switch (options.activeTab) {
            case 'pending':
                list = list.filter((t) => t.status === 'pending');
                break;
            case 'due_soon':
                list = list.filter((t) => t.status === 'pending' && (t.urgency === 'due_soon' || t.urgency === 'due_today'));
                break;
            case 'overdue':
                list = list.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0));
                break;
            case 'paid':
                list = list.filter((t) => t.status === 'paid');
                break;
            case 'all':
            default:
                break;
        }

        list.sort((a, b) => {
            let res = 0;
            switch (options.sortBy) {
                case 'due_date':
                    res = a.dueDate.localeCompare(b.dueDate);
                    break;
                case 'name':
                    res = a.masterBillName.localeCompare(b.masterBillName);
                    break;
                case 'category':
                    res = a.category.localeCompare(b.category);
                    break;
                case 'amount':
                    res = (a.amountDue || 0) - (b.amountDue || 0);
                    break;
                case 'status':
                    res = a.status.localeCompare(b.status);
                    break;
                default:
                    res = a.dueDate.localeCompare(b.dueDate);
            }
            return options.sortAsc !== false ? res : -res;
        });

        return list;
    }

    // YEARLY & MONTHLY METRICS
    getYearlySummary(yearStr: string = getCurrentYearStr()): YearlySummary {
        const yearTrans = this.getAllTransactions().filter((t) => t.dueDate && t.dueDate.startsWith(yearStr));
        const totalBills = yearTrans.length;
        const paidCount = yearTrans.filter((t) => t.status === 'paid').length;
        const pendingCount = yearTrans.filter((t) => t.status === 'pending').length;
        const overdueCount = yearTrans.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0)).length;
        const percentagePaid = totalBills > 0 ? Math.round((paidCount / totalBills) * 100) : 0;

        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const monthlyStats = months.map((mKey, idx) => {
            const mPrefix = `${yearStr}-${mKey}`;
            const mList = yearTrans.filter((t) => t.dueDate.startsWith(mPrefix));
            const mTotal = mList.length;
            const mPaid = mList.filter((t) => t.status === 'paid').length;
            const mPct = mTotal > 0 ? Math.round((mPaid / mTotal) * 100) : 0;
            return {
                monthKey: mKey,
                monthName: monthNames[idx],
                total: mTotal,
                paid: mPaid,
                percentage: mPct,
            };
        });

        return {
            yearStr,
            totalBills,
            paidCount,
            pendingCount,
            overdueCount,
            percentagePaid,
            monthlyStats,
        };
    }

    getMonthSummary(monthStr: string = getCurrentMonthStr()): MonthSummary {
        const monthTrans = this.getAllTransactions().filter((t) => t.dueDate && t.dueDate.startsWith(monthStr));
        const totalBills = monthTrans.length;
        const paidCount = monthTrans.filter((t) => t.status === 'paid').length;
        const pendingCount = monthTrans.filter((t) => t.status === 'pending').length;
        const overdueCount = monthTrans.filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0)).length;
        const percentagePaid = totalBills > 0 ? Math.round((paidCount / totalBills) * 100) : 0;

        return {
            monthStr,
            totalBills,
            paidCount,
            pendingCount,
            overdueCount,
            percentagePaid,
        };
    }

    getCategoryProgress(yearStr: string = getCurrentYearStr()): CategoryProgressSummary[] {
        const yearTrans = this.getAllTransactions().filter((t) => t.dueDate && t.dueDate.startsWith(yearStr));
        const map = new Map<string, { total: number; paid: number; pending: number }>();

        for (const t of yearTrans) {
            const cat = t.category || 'Other';
            const curr = map.get(cat) || { total: 0, paid: 0, pending: 0 };
            curr.total += 1;
            if (t.status === 'paid') curr.paid += 1;
            else curr.pending += 1;
            map.set(cat, curr);
        }

        const result: CategoryProgressSummary[] = [];
        for (const [cat, data] of map.entries()) {
            const pct = data.total > 0 ? Math.round((data.paid / data.total) * 100) : 0;
            result.push({
                category: cat,
                totalCount: data.total,
                paidCount: data.paid,
                pendingCount: data.pending,
                percentagePaid: pct,
                color: CATEGORY_COLORS[cat] || 'var(--interactive-accent)',
            });
        }

        result.sort((a, b) => b.totalCount - a.totalCount);
        return result;
    }

    getOverdueTransactions(): BillTransaction[] {
        return this.getAllTransactions().filter((t) => t.status === 'overdue' || (t.status === 'pending' && t.daysUntilDue < 0));
    }

    getDueSoonTransactions(days: number = 7): BillTransaction[] {
        return this.getAllTransactions().filter((t) => t.status === 'pending' && t.daysUntilDue >= 0 && t.daysUntilDue <= days);
    }
}
