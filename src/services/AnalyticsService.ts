import { MasterBill, RecurringBillsSettings, CategoryProgressSummary } from '../types';
import { CATEGORY_COLORS } from '../constants';

export class AnalyticsService {
    private settings: RecurringBillsSettings;

    constructor(settings: RecurringBillsSettings) {
        this.settings = settings;
    }

    updateSettings(settings: RecurringBillsSettings): void {
        this.settings = settings;
    }

    getMasterCategoryCounts(masterBills: MasterBill[]): Array<{ category: string; count: number; color?: string }> {
        const map = new Map<string, number>();
        for (const bill of masterBills) {
            const cat = bill.category || 'Other';
            map.set(cat, (map.get(cat) || 0) + 1);
        }

        const result: Array<{ category: string; count: number; color?: string }> = [];
        for (const [cat, count] of map.entries()) {
            result.push({
                category: cat,
                count,
                color: CATEGORY_COLORS[cat] || 'var(--interactive-accent)',
            });
        }
        result.sort((a, b) => b.count - a.count);
        return result;
    }
}
