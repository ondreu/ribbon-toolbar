/*
 * Dialogs the ribbon uses: a command picker that works like the command palette, an icon
 * picker, a text prompt, a confirmation, the Insert Table size picker, a symbol palette and
 * the Word-style colour palette for the opt-in HTML formatting.
 *
 * Official Obsidian API only. The dialogs return promises so the caller reads like a script.
 */

import { FuzzySuggestModal, getIconIds, Modal, Setting, setIcon, type App, type Command, type FuzzyMatch } from "obsidian";
import { SYMBOLS, tableMarkdown } from "../format/text";
import type { Pen } from "../format/html";
import { listCommands } from "../internal";

export class CommandPickerModal extends FuzzySuggestModal<Command> {
	constructor(
		app: App,
		private readonly visible: (command: Command) => boolean,
		private readonly onChoose: (command: Command) => void,
	) {
		super(app);
		this.modalEl.addClass("rtb-picker");
		this.setPlaceholder("Add a command to the ribbon: type to search…");
		this.setInstructions([
			{ command: "↑↓", purpose: "to move" },
			{ command: "↵", purpose: "to add" },
			{ command: "esc", purpose: "to cancel" },
		]);
	}

	getItems(): Command[] {
		const all = listCommands(this.app).filter((command) => this.visible(command));
		return all.sort((a, b) => a.name.localeCompare(b.name));
	}

	getItemText(command: Command): string {
		return `${command.name} ${command.id}`;
	}

	renderSuggestion(match: FuzzyMatch<Command>, el: HTMLElement): void {
		el.addClass("rtb-picker-item");
		// The name goes in its own box: the highlighted letters of a match are separate
		// elements and must not be spread out by the row's layout.
		super.renderSuggestion(match, el.createDiv("rtb-picker-name"));
		el.createSpan({ cls: "rtb-picker-id", text: match.item.id });
	}

	onChooseItem(command: Command): void {
		this.onChoose(command);
	}
}

export class IconPickerModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private readonly onChoose: (icon: string) => void,
		value?: string,
	) {
		super(app);
		this.modalEl.addClass("rtb-picker", "rtb-icon-picker");
		this.limit = 120;
		this.setPlaceholder(value ? `Icon: ${value} — type to search…` : "Choose an icon: type to search…");
	}

	getItems(): string[] {
		return getIconIds()
			.map((id) => id.replace(/^lucide-/, ""))
			.sort();
	}

	getItemText(id: string): string {
		return id.replace(/-/g, " ");
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass("rtb-picker-item", "rtb-icon-item");
		setIcon(el.createSpan("rtb-icon-item-icon"), match.item);
		el.createSpan({ text: match.item });
	}

	onChooseItem(id: string): void {
		this.onChoose(id);
	}
}

/** A one-field dialog. Resolves to the trimmed value, or null when cancelled. */
export class PromptModal extends Modal {
	private value: string;
	private done = false;

	constructor(
		app: App,
		private readonly title: string,
		value: string,
		private readonly cta: string,
		private readonly resolve: (value: string | null) => void,
	) {
		super(app);
		this.value = value;
		// Obsidian 1.15 gives Modal its own isOpen; never shadow it with a field of ours.
		this.modalEl.addClass("rtb-dialog");
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		const input = this.contentEl.createEl("input", {
			cls: "rtb-dialog-input",
			attr: { type: "text", value: this.value, placeholder: this.title },
		});
		input.focus();
		input.select();
		input.addEventListener("input", () => (this.value = input.value));
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.finish(this.value.trim() || null);
			}
		});
		const footer = this.contentEl.createDiv("rtb-dialog-footer");
		const cancel = footer.createEl("button", { text: "Cancel", attr: { type: "button" } });
		cancel.addEventListener("click", () => this.finish(null));
		const ok = footer.createEl("button", { cls: "mod-cta", text: this.cta, attr: { type: "button" } });
		ok.addEventListener("click", () => this.finish(this.value.trim() || null));
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.done) this.resolve(null);
	}

	private finish(value: string | null): void {
		if (this.done) return;
		this.done = true;
		this.resolve(value);
		this.close();
	}
}

export function promptText(app: App, title: string, value: string, cta: string): Promise<string | null> {
	return new Promise((resolve) => new PromptModal(app, title, value, cta, resolve).open());
}

/** A yes/no dialog. Resolves false when dismissed with Escape or the close button. */
export class ConfirmModal extends Modal {
	private done = false;

	constructor(
		app: App,
		private readonly heading: string,
		private readonly message: string,
		private readonly cta: string,
		private readonly resolve: (ok: boolean) => void,
	) {
		super(app);
		this.modalEl.addClass("rtb-dialog");
	}

	onOpen(): void {
		this.titleEl.setText(this.heading);
		this.contentEl.createEl("p", { text: this.message });
		const footer = this.contentEl.createDiv("rtb-dialog-footer");
		const cancel = footer.createEl("button", { text: "Cancel", attr: { type: "button" } });
		cancel.addEventListener("click", () => this.finish(false));
		const ok = footer.createEl("button", { cls: "mod-warning", text: this.cta, attr: { type: "button" } });
		ok.addEventListener("click", () => this.finish(true));
		ok.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.done) this.resolve(false);
	}

	private finish(ok: boolean): void {
		if (this.done) return;
		this.done = true;
		this.resolve(ok);
		this.close();
	}
}

export function confirmAction(app: App, title: string, message: string, cta: string): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, title, message, cta, resolve).open());
}

/** Word's Insert Table: two numbers and a header switch, with a live line of Markdown. */
export class TableModal extends Modal {
	private rows = 3;
	private cols = 3;
	private done = false;

	constructor(
		app: App,
		private readonly resolve: (text: string | null) => void,
	) {
		super(app);
		this.modalEl.addClass("rtb-dialog", "rtb-table-dialog");
	}

	onOpen(): void {
		this.titleEl.setText("Insert table");
		const preview = this.contentEl.createEl("pre", { cls: "rtb-table-preview" });
		const update = (): void => {
			// Markdown has no headerless table: a separator row is what makes it a table at all,
			// so the first row is always the header.
			preview.setText(tableMarkdown(this.rows, this.cols).split("\n").slice(0, 4).join("\n"));
		};
		new Setting(this.contentEl)
			.setName("Columns")
			.setDesc("How many columns the table starts with.")
			.addSlider((slider) =>
				slider.setLimits(1, 12, 1).setValue(this.cols).onChange((value) => {
					this.cols = value;
					update();
				}),
			);
		new Setting(this.contentEl)
			.setName("Rows")
			.setDesc("Includes the header row.")
			.addSlider((slider) =>
				slider.setLimits(2, 40, 1).setValue(this.rows).onChange((value) => {
					this.rows = value;
					update();
				}),
			);
		update();
		const footer = this.contentEl.createDiv("rtb-dialog-footer");
		const cancel = footer.createEl("button", { text: "Cancel", attr: { type: "button" } });
		cancel.addEventListener("click", () => this.finish(null));
		const ok = footer.createEl("button", { cls: "mod-cta", text: "Insert", attr: { type: "button" } });
		ok.addEventListener("click", () => this.finish(tableMarkdown(this.rows, this.cols)));
		ok.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.done) this.resolve(null);
	}

	private finish(text: string | null): void {
		if (this.done) return;
		this.done = true;
		this.resolve(text);
		this.close();
	}
}

export function insertTableDialog(app: App): Promise<string | null> {
	return new Promise((resolve) => new TableModal(app, resolve).open());
}

/** A grid of characters. Clicking one closes the dialog with that character. */
export class SymbolModal extends Modal {
	constructor(
		app: App,
		private readonly resolve: (symbol: string | null) => void,
	) {
		super(app);
		this.modalEl.addClass("rtb-dialog", "rtb-symbol-dialog");
	}

	onOpen(): void {
		this.titleEl.setText("Insert symbol");
		const grid = this.contentEl.createDiv("rtb-symbol-grid");
		for (const symbol of SYMBOLS) {
			const button = grid.createEl("button", { cls: "rtb-symbol", text: symbol, attr: { type: "button" } });
			button.addEventListener("click", () => this.finish(symbol));
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(null);
	}

	private finish(symbol: string): void {
		this.resolve(symbol);
		this.close();
	}
}

export function insertSymbolDialog(app: App): Promise<string | null> {
	return new Promise((resolve) => new SymbolModal(app, resolve).open());
}

/** The Word colour palette: swatches with names, plus a "no colour" choice. */
export class ColorModal extends Modal {
	constructor(
		app: App,
		private readonly title: string,
		private readonly pens: Pen[],
		private readonly resolve: (colour: string | null | undefined) => void,
	) {
		super(app);
		this.modalEl.addClass("rtb-dialog", "rtb-color-dialog");
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		const grid = this.contentEl.createDiv("rtb-color-grid");
		const add = (label: string, colour: string | null, cls: string): void => {
			const swatch = grid.createEl("button", { cls: `rtb-color ${cls}`, attr: { type: "button", "aria-label": label } });
			if (colour) swatch.createSpan({ cls: "rtb-color-dot" }).setCssStyles({ background: colour });
			else swatch.createSpan({ cls: "rtb-color-dot is-none", text: "×" });
			swatch.createSpan({ cls: "rtb-color-name", text: label });
			swatch.addEventListener("click", () => this.finish(colour));
		};
		for (const pen of this.pens) add(pen.name, pen.color, "");
		add("No colour", null, "is-none");
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(undefined);
	}

	private finish(colour: string | null): void {
		this.resolve(colour);
		this.close();
	}
}

/** Resolves to a colour, `null` for "no colour", or `undefined` when cancelled. */
export function pickColor(app: App, title: string, pens: Pen[]): Promise<string | null | undefined> {
	return new Promise((resolve) => new ColorModal(app, title, pens, resolve).open());
}
