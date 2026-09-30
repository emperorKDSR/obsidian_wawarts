import { BillFrequency } from '../types';
import { COMMON_CURRENCIES } from '../constants';

export function getCurrencySymbol(currencyStr?: string, defaultSymbol: string = '$'): string {
    if (!currencyStr) return defaultSymbol;
    const trimmed = currencyStr.trim();
    const found = COMMON_CURRENCIES.find(
        (c) => c.code.toLowerCase() === trimmed.toLowerCase() || c.symbol === trimmed
    );
    if (found && found.symbol) return found.symbol;
    return trimmed;
}

export function formatCurrency(
    amount: number | undefined | null,
    symbolOrCode?: string,
    fallbackCode?: string
): string {
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    
    // Clean formatted number with 2 decimals
    const parts = validAmount.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = `${integerPart}.${parts[1]}`;

    const symbol = getCurrencySymbol(symbolOrCode || fallbackCode || '$');
    
    // If symbol is alphabetical code (e.g. USD, PHP, AED), format with space: "PHP 1,200.00"
    if (/^[A-Za-z]+$/.test(symbol)) {
        return `${symbol} ${formatted}`;
    }
    // If symbol is special character (e.g. $, €, ₱, £, ¥), format: "$100.00" or "₱100.00"
    return `${symbol}${formatted}`;
}

export function normalizeToMonthly(
    amount: number,
    frequency: BillFrequency,
    interval: number = 1
): number {
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const safeInterval = Math.max(1, interval || 1);

    switch (frequency) {
        case 'weekly':
            // 52 weeks / 12 months = 4.3333 weeks per month
            return (validAmount / safeInterval) * (52 / 12);
        case 'biweekly':
            // 26 fortnights / 12 months = 2.1666 fortnights per month
            return (validAmount / safeInterval) * (26 / 12);
        case 'monthly':
            return validAmount / safeInterval;
        case 'quarterly':
            return (validAmount / (safeInterval * 3));
        case 'semiannual':
            return (validAmount / (safeInterval * 6));
        case 'yearly':
            return (validAmount / (safeInterval * 12));
        case 'custom_days':
            // 365.25 days / 12 months = 30.4375 days per month
            return (validAmount / safeInterval) * 30.4375;
        default:
            return validAmount;
    }
}

export function normalizeToAnnual(
    amount: number,
    frequency: BillFrequency,
    interval: number = 1
): number {
    const monthly = normalizeToMonthly(amount, frequency, interval);
    return monthly * 12;
}
