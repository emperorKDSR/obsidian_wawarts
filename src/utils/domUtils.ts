import { setIcon, Platform } from 'obsidian';

export function isTablet(): boolean {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    return (Platform.isMobile || width <= 1024) && width >= 768;
}

export function isMobilePhone(): boolean {
    if (typeof window === 'undefined') return false;
    return Platform.isMobile && window.innerWidth < 768;
}

export function isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return Platform.isMobile || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function createIconEl(iconId: string, parentEl: HTMLElement, className?: string): HTMLElement {
    const iconSpan = parentEl.createEl('span', { cls: className || 'bill-icon-holder' });
    setIcon(iconSpan, iconId);
    return iconSpan;
}

export function createPillBadge(
    parentEl: HTMLElement,
    text: string,
    variant: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' = 'neutral',
    icon?: string
): HTMLElement {
    const badge = parentEl.createEl('span', { cls: `bill-badge bill-badge--${variant}` });
    if (icon) {
        const iconEl = badge.createEl('span', { cls: 'bill-badge-icon' });
        setIcon(iconEl, icon);
    }
    badge.createEl('span', { text, cls: 'bill-badge-text' });
    return badge;
}
