import { App, Menu, Notice, TFile } from 'obsidian';

/**
 * Navigation & Leaf Safeguarding Utilities
 * Follows DIWA's Context-Preserving Interaction System.
 * Ensures the Wawarts workspace leaf is NEVER evicted when navigating to notes.
 */

export interface OpenNoteOptions {
    fallbackLeaf?: 'split' | 'tab' | 'window';
}

/**
 * Safely opens a note without evicting the active workspace leaf.
 * - If modifier keys (Cmd/Ctrl or Alt) are pressed, opens in a background tab or window.
 * - On desktop: searches for an existing open markdown leaf to reuse, or opens an adjacent vertical split.
 */
export async function openNoteSafely(
    app: App,
    target: TFile | string,
    e?: MouseEvent,
    options?: OpenNoteOptions
): Promise<void> {
    const tFile = typeof target === 'string'
        ? app.metadataCache.getFirstLinkpathDest(target, '')
        : target;

    if (!tFile) {
        if (typeof target === 'string') {
            await app.workspace.openLinkText(target, '', false);
        }
        return;
    }

    // Handle modifier clicks
    if (e) {
        if (e.metaKey || e.ctrlKey) {
            const tabLeaf = app.workspace.getLeaf('tab');
            await tabLeaf.openFile(tFile);
            return;
        }
        if (e.altKey) {
            const winLeaf = app.workspace.getLeaf('window');
            await winLeaf.openFile(tFile);
            return;
        }
    }

    // Explicit fallback options
    if (options?.fallbackLeaf === 'tab') {
        const tabLeaf = app.workspace.getLeaf('tab');
        await tabLeaf.openFile(tFile);
        return;
    }
    if (options?.fallbackLeaf === 'window') {
        const winLeaf = app.workspace.getLeaf('window');
        await winLeaf.openFile(tFile);
        return;
    }
    if (options?.fallbackLeaf === 'split') {
        const splitLeaf = app.workspace.getLeaf('split', 'vertical');
        await splitLeaf.openFile(tFile);
        return;
    }

    // Leaf Safeguarding (DIWA rule):
    // Check if there is an existing adjacent markdown leaf that can be safely reused
    const openMarkdownLeaves = app.workspace.getLeavesOfType('markdown');
    if (openMarkdownLeaves.length > 0) {
        const reusableLeaf = openMarkdownLeaves.find((l) => !(l as any).pinned) || openMarkdownLeaves[0];
        await reusableLeaf.openFile(tFile);
        app.workspace.setActiveLeaf(reusableLeaf, { focus: true });
        return;
    }

    // Otherwise, create an adjacent vertical split pane so Wawarts remains open and intact
    const splitLeaf = app.workspace.getLeaf('split', 'vertical');
    await splitLeaf.openFile(tFile);
}

/**
 * Attaches native Obsidian Hover Preview to any DOM element.
 * Hovering over the element will pop up the native Obsidian Page Preview popover.
 */
export function attachHoverPreview(
    app: App,
    targetEl: HTMLElement,
    filePathOrName: string,
    hoverParent: any
): void {
    targetEl.addEventListener('mouseover', (e: MouseEvent) => {
        app.workspace.trigger('hover-link', {
            event: e,
            source: 'wawarts',
            hoverParent: hoverParent,
            targetEl: targetEl,
            linktext: filePathOrName,
            sourcePath: '',
        });
    });
}

/**
 * Renders a standard DIWA-style context menu for a note.
 */
export function openNoteActionContextMenu(
    app: App,
    e: MouseEvent,
    file: TFile,
    extraItems?: (menu: Menu) => void
): void {
    e.preventDefault();
    e.stopPropagation();

    const menu = new Menu();

    menu.addItem((item) => {
        item.setTitle('Open in Adjacent Split')
            .setIcon('split')
            .onClick(async () => {
                await openNoteSafely(app, file, undefined, { fallbackLeaf: 'split' });
            });
    });

    menu.addItem((item) => {
        item.setTitle('Open in New Tab')
            .setIcon('file-plus')
            .onClick(async () => {
                await openNoteSafely(app, file, undefined, { fallbackLeaf: 'tab' });
            });
    });

    menu.addItem((item) => {
        item.setTitle('Open in New Window')
            .setIcon('picture-in-picture')
            .onClick(async () => {
                await openNoteSafely(app, file, undefined, { fallbackLeaf: 'window' });
            });
    });

    menu.addItem((item) => {
        item.setTitle('Copy Wikilink')
            .setIcon('copy')
            .onClick(async () => {
                await navigator.clipboard.writeText(`[[${file.basename}]]`);
                new Notice(`Copied [[${file.basename}]]`);
            });
    });

    if (extraItems) {
        menu.addSeparator();
        extraItems(menu);
    }

    menu.showAtMouseEvent(e);
}
