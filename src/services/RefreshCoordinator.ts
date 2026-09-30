import { App, EventRef, TAbstractFile, TFile } from 'obsidian';
import { BillIndexService } from './BillIndexService';

export class RefreshCoordinator {
    private app: App;
    private indexService: BillIndexService;
    private listeners: Set<() => void> = new Set();
    private eventRefs: EventRef[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(app: App, indexService: BillIndexService) {
        this.app = app;
        this.indexService = indexService;
    }

    register(): void {
        this.eventRefs.push(
            this.app.vault.on('create', (file: TAbstractFile) => {
                if (file instanceof TFile && this.indexService.isBillFile(file.path)) {
                    this.scheduleRefresh(file, 'create');
                }
            }),
            this.app.vault.on('modify', (file: TAbstractFile) => {
                if (file instanceof TFile && this.indexService.isBillFile(file.path)) {
                    this.scheduleRefresh(file, 'modify');
                }
            }),
            this.app.vault.on('delete', (file: TAbstractFile) => {
                if (file instanceof TFile) {
                    this.indexService.removeFile(file.path);
                    this.scheduleRefresh(null, 'delete');
                }
            }),
            this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
                this.indexService.removeFile(oldPath);
                if (file instanceof TFile && this.indexService.isBillFile(file.path)) {
                    this.scheduleRefresh(file, 'rename');
                } else {
                    this.scheduleRefresh(null, 'rename');
                }
            }),
            this.app.metadataCache.on('changed', (file: TFile) => {
                if (this.indexService.isBillFile(file.path)) {
                    this.scheduleRefresh(file, 'metadata');
                }
            })
        );
    }

    unregister(): void {
        for (const ref of this.eventRefs) {
            this.app.vault.offref(ref);
        }
        this.eventRefs = [];
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private scheduleRefresh(file: TFile | null, reason: string): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            if (file) {
                await this.indexService.indexFile(file);
            }
            this.notify();
        }, 150);
    }

    notify(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (e) {
                console.error('Error in RefreshCoordinator subscriber:', e);
            }
        }
    }
}
