import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import {
    MasterBill,
    NewMasterBillInput,
    NewTransactionInput,
    PayTransactionInput,
    BatchGenerateOptions,
    RecurringBillsSettings,
    TransactionStatus,
} from '../types';
import { computeDueDateForMonth, getTodayDateStr } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currencyUtils';

export class BillVaultService {
    private app: App;
    private settings: RecurringBillsSettings;

    constructor(app: App, settings: RecurringBillsSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: RecurringBillsSettings): void {
        this.settings = settings;
    }

    async ensureFolder(folderPath: string): Promise<TFolder> {
        const normalized = normalizePath(folderPath);
        const folder = this.app.vault.getAbstractFileByPath(normalized);
        if (folder instanceof TFolder) {
            return folder;
        }
        await this.app.vault.createFolder(normalized);
        return this.app.vault.getAbstractFileByPath(normalized) as TFolder;
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[\\/:*?"<>|#^\[\]]/g, '').trim() || 'Untitled';
    }

    /* ==========================================================================
       MASTER BILL OPERATIONS
       ========================================================================== */

    async createMasterBill(input: NewMasterBillInput): Promise<TFile> {
        await this.ensureFolder(this.settings.masterFolder);
        const safeName = this.sanitizeFileName(input.name);
        let targetPath = normalizePath(`${this.settings.masterFolder}/${safeName}.md`);

        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(targetPath)) {
            targetPath = normalizePath(`${this.settings.masterFolder}/${safeName} (${counter}).md`);
            counter++;
        }

        const tagsList = input.tags && input.tags.length > 0 ? input.tags : ['bill/master'];
        const formattedTags = tagsList.map((t) => `  - ${t.replace(/^#/, '')}`).join('\n');

        const frontmatter = [
            '---',
            'type: master-bill',
            `name: "${input.name.replace(/"/g, '\\"')}"`,
            input.defaultAmount !== undefined ? `default_amount: ${input.defaultAmount}` : null,
            `currency: "${input.currency || this.settings.currencySymbol}"`,
            `category: "${input.category || this.settings.defaultCategory}"`,
            `frequency: "${input.frequency}"`,
            input.frequencyInterval ? `frequency_interval: ${input.frequencyInterval}` : null,
            input.dueDay ? `due_day: ${input.dueDay}` : null,
            input.paymentMethod ? `payment_method: "${input.paymentMethod}"` : null,
            `auto_pay: ${Boolean(input.autoPay)}`,
            `reminder_days: ${input.reminderDays ?? this.settings.defaultReminderDays}`,
            input.accountNumber ? `account_number: "${input.accountNumber}"` : null,
            input.url ? `url: "${input.url}"` : null,
            `active: ${input.active !== false}`,
            'tags:',
            formattedTags,
            '---',
            '',
        ]
            .filter((l) => l !== null)
            .join('\n');

        const body = [
            `# ${input.name} — Master Schedule Profile`,
            '',
            `> **Category:** ${input.category || this.settings.defaultCategory} | **Frequency:** ${input.frequency}`,
            input.dueDay ? `> **Scheduled Due Date:** Day ${input.dueDay} of month` : '',
            input.paymentMethod ? `> **Payment Method / Account:** ${input.paymentMethod}` : '',
            '',
            '## Description & Schedule Notes',
            input.notes ? `${input.notes}\n` : '_Add account notes, login instructions, or schedule details here._\n',
            '## Generated Due Instances',
            '_Individual due files for each monthly cycle are stored under Transactions folder._',
            '',
        ].join('\n');

        return await this.app.vault.create(targetPath, frontmatter + body);
    }

    async updateMasterBill(file: TFile, updates: Partial<Record<string, any>>): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            for (const [k, v] of Object.entries(updates)) {
                if (v === undefined || v === null) {
                    delete fm[k];
                } else {
                    fm[k] = v;
                }
            }
        });
    }

    async deleteMasterBill(file: TFile): Promise<void> {
        await this.app.vault.trash(file, true);
    }

    /* ==========================================================================
       TRANSACTIONAL INSTANCE OPERATIONS
       ========================================================================== */

    getTransactionPath(masterName: string, dueDate: string): string {
        const safeName = this.sanitizeFileName(masterName);
        const [year, month] = dueDate.split('-');

        let folder = this.settings.transactionsFolder;
        if (this.settings.folderStructure === 'year-month') {
            folder = `${this.settings.transactionsFolder}/${year}/${month}`;
        } else if (this.settings.folderStructure === 'by-bill') {
            folder = `${this.settings.transactionsFolder}/${safeName}`;
        }

        const fileName = `${dueDate} - ${safeName}.md`;
        return normalizePath(`${folder}/${fileName}`);
    }

    async createTransactionFile(input: NewTransactionInput): Promise<TFile> {
        const targetPath = this.getTransactionPath(input.masterBillName, input.dueDate);

        const parentFolder = targetPath.substring(0, targetPath.lastIndexOf('/'));
        await this.ensureFolder(parentFolder);

        const existing = this.app.vault.getAbstractFileByPath(targetPath);
        if (existing instanceof TFile) {
            return existing;
        }

        const tagsList = input.tags && input.tags.length > 0 ? input.tags : [
            'bill/transaction',
            this.settings.pendingTag,
            `due-${input.dueDate.substring(0, 7)}`,
        ];
        const formattedTags = tagsList.map((t) => `  - ${t.replace(/^#/, '')}`).join('\n');

        const frontmatter = [
            '---',
            'type: bill-transaction',
            `master_bill: "[[${input.masterBillName}]]"`,
            `due_date: "${input.dueDate}"`,
            input.amountDue !== undefined ? `amount_due: ${input.amountDue}` : null,
            `currency: "${input.currency || this.settings.currencySymbol}"`,
            `category: "${input.category || this.settings.defaultCategory}"`,
            'status: "pending"',
            'paid_date: null',
            'amount_paid: null',
            input.paymentMethod ? `payment_method: "${input.paymentMethod}"` : null,
            'reference_no: null',
            `auto_pay: ${Boolean(input.autoPay)}`,
            'tags:',
            formattedTags,
            '---',
            '',
        ]
            .filter((l) => l !== null)
            .join('\n');

        const body = [
            `# ${input.masterBillName} — Due: ${input.dueDate}`,
            '',
            '> [!NOTE] Due Information',
            `> - **Master Item:** [[${input.masterBillName}]]`,
            `> - **Due Date:** ${input.dueDate}`,
            `> - **Status:** ⏳ Pending`,
            input.paymentMethod ? `> - **Payment Method:** ${input.paymentMethod}` : null,
            '',
            '## Settlement Notes & Verification',
            input.notes ? `${input.notes}\n` : '_Pending settlement._\n',
            '## Receipt / Confirmation Screenshot',
            '_Paste confirmation or proof of payment below._',
            '',
        ]
            .filter((l) => l !== null)
            .join('\n');

        return await this.app.vault.create(targetPath, frontmatter + body);
    }

    async batchGenerateMonthTransactions(
        masterBills: MasterBill[],
        options: BatchGenerateOptions
    ): Promise<TFile[]> {
        const created: TFile[] = [];
        const activeBills = masterBills.filter((b) => b.active);

        for (const bill of activeBills) {
            if (options.selectedMasterIds && !options.selectedMasterIds.includes(bill.id)) {
                continue;
            }

            const dueDate = computeDueDateForMonth(options.targetMonth, bill.dueDay, bill.frequency);

            const file = await this.createTransactionFile({
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

            created.push(file);
        }

        return created;
    }

    async payTransaction(file: TFile, input: PayTransactionInput): Promise<void> {
        const paidDate = input.paidDate || getTodayDateStr();

        await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm.status = 'paid';
            fm.paid_date = paidDate;
            if (input.amountPaid !== undefined) fm.amount_paid = input.amountPaid;
            if (input.paymentMethod) fm.payment_method = input.paymentMethod;
            if (input.referenceNo) fm.reference_no = input.referenceNo;

            let tags: string[] = [];
            if (Array.isArray(fm.tags)) tags = fm.tags.map(String);
            else if (typeof fm.tags === 'string') tags = fm.tags.split(',').map((s: string) => s.trim());

            tags = tags.filter((t) => t !== this.settings.pendingTag && t !== 'bill/pending');
            if (!tags.includes(this.settings.paidTag)) {
                tags.push(this.settings.paidTag);
            }
            fm.tags = tags;
        });

        const content = await this.app.vault.read(file);
        const methodStr = input.paymentMethod ? ` via **${input.paymentMethod}**` : '';
        const refStr = input.referenceNo ? ` (Ref: \`${input.referenceNo}\`)` : '';
        const userNotes = input.notes ? `\n> **Note:** ${input.notes}` : '';

        const receiptBlock = [
            `\n> [!SUCCESS] Settlement Confirmation`,
            `> - **Settled On:** ${paidDate}${methodStr}${refStr}${userNotes}`,
            '',
        ].join('\n');

        let updatedContent = content;
        if (updatedContent.includes('_Pending settlement._')) {
            updatedContent = updatedContent.replace('_Pending settlement._', receiptBlock);
        } else {
            updatedContent = `${updatedContent.trim()}\n\n${receiptBlock}\n`;
        }

        await this.app.vault.modify(file, updatedContent);
    }

    async toggleTransactionStatus(file: TFile, newStatus: TransactionStatus): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm.status = newStatus;
            let tags: string[] = Array.isArray(fm.tags) ? fm.tags.map(String) : [];

            if (newStatus === 'paid') {
                fm.paid_date = fm.paid_date || getTodayDateStr();
                tags = tags.filter((t) => t !== this.settings.pendingTag);
                if (!tags.includes(this.settings.paidTag)) tags.push(this.settings.paidTag);
            } else if (newStatus === 'pending') {
                fm.paid_date = null;
                tags = tags.filter((t) => t !== this.settings.paidTag);
                if (!tags.includes(this.settings.pendingTag)) tags.push(this.settings.pendingTag);
            }
            fm.tags = tags;
        });
    }

    async updateTransaction(file: TFile, updates: Partial<Record<string, any>>): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            for (const [k, v] of Object.entries(updates)) {
                if (v === undefined || v === null) {
                    delete fm[k];
                } else {
                    fm[k] = v;
                }
            }
        });
    }

    async updateTransactionCategory(file: TFile, category: string): Promise<void> {
        await this.updateTransaction(file, { category });
    }

    async updateTransactionAmount(file: TFile, amountDue?: number): Promise<void> {
        await this.updateTransaction(file, { amount_due: amountDue });
    }

    async updateTransactionPaymentMethod(file: TFile, paymentMethod?: string): Promise<void> {
        await this.updateTransaction(file, { payment_method: paymentMethod });
    }

    async updateTransactionDueDate(file: TFile, dueDate: string): Promise<void> {
        await this.updateTransaction(file, { due_date: dueDate });
    }

    async deleteTransaction(file: TFile): Promise<void> {
        await this.app.vault.trash(file, true);
    }
}
