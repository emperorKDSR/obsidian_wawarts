import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private confirmText: string;
    private isDestructive: boolean;
    private onConfirm: () => void;

    constructor(
        app: App,
        title: string,
        message: string,
        confirmText: string = 'Confirm',
        isDestructive: boolean = false,
        onConfirm: () => void = () => {}
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.isDestructive = isDestructive;
        this.onConfirm = onConfirm;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('bills-modal', 'bills-modal--confirm');
        contentEl.empty();

        const headerEl = contentEl.createEl('div', { cls: 'bills-modal-header' });
        headerEl.createEl('h2', { text: this.title, cls: 'bills-modal-title' });

        const bodyEl = contentEl.createEl('div', { cls: 'bills-modal-body' });
        bodyEl.createEl('p', { text: this.message, cls: 'bills-modal-confirm-msg' });

        const footerEl = contentEl.createEl('div', { cls: 'bills-modal-footer' });
        const cancelBtn = footerEl.createEl('button', { text: 'Cancel', cls: 'mod-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const confirmBtn = footerEl.createEl('button', {
            text: this.confirmText,
            cls: this.isDestructive ? 'mod-cta mod-warning bills-btn-danger' : 'mod-cta bills-btn-primary',
        });
        confirmBtn.addEventListener('click', () => {
            this.close();
            this.onConfirm();
        });
    }
}
