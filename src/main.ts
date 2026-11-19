/*
 * Ribbon toolbar
 *
 * A full-width, Office-style ribbon above the workspace: tabs, groups and buttons, all of
 * them commands. The ribbon is data (src/model/layout.ts), the renderer is
 * (src/view/RibbonView.ts), and this file wires them to Obsidian: commands, settings,
 * persistence and the handful of formatting actions Markdown has no command for.
 *
 * Design rules that the defaults follow, and that a reviewer should hold the plugin to:
 *   - Markdown only. The one exception is <sub>/<sup>, which Markdown lacks.
 *   - HTML formatting (underline, colour) is a setting, off by default, and its tab is hidden.
 *   - No OneNote-style tags, no page colours, no sidebar toggles, no second copy of the same
 *     button on three tabs. If a function already exists as a command, the ribbon calls it.
 */

import {
	MarkdownView,
	Notice,
	Plugin,
	setIcon,
	type Editor,
	type WorkspaceLeaf,
} from "obsidian";
import { RibbonView, type RibbonHost } from "./view/RibbonView";
import { defaultLayout, DEFAULTS_VERSION, LEGACY_DEFAULT_HASH } from "./model/defaults";
import {
	cloneLayout,
	exportLayout,
	featureAvailable,
	importLayout,
	LAYOUT_VERSION,
	layoutHash,
	normalizeLayout,
	type Capabilities,
	type ContextKey,
	type RibbonLayout,
} from "./model/layout";
import { addLinePrefix, insertBlock, setHeading, toggleInline, toggleTag, type TextEdit } from "./format/text";
import { applyColor, applyHighlight, clearHtml, HIGHLIGHT_COLORS, TEXT_COLORS } from "./format/html";
import { executeCommand, isPluginEnabled, mountPoint } from "./internal";
import { detect, featureSet, MDS_PLUGIN_ID, refreshSpreadsheetHost, spreadsheetActive, type RibbonHostApi } from "./integrations";
import { DEFAULT_SETTINGS, RibbonSettingTab, type RibbonSettings } from "./settings";
import { confirmAction, insertSymbolDialog, insertTableDialog, pickCanvas, pickColor, promptText } from "./view/modals";

interface RibbonState {
	ribbonTab: string;
	ribbonCollapsed: boolean;
}

interface PluginData {
	settings?: Partial<RibbonSettings>;
	layout?: unknown;
	state?: Partial<RibbonState>;
}

export default class RibbonToolbarPlugin extends Plugin implements RibbonHost {
	settings: RibbonSettings = { ...DEFAULT_SETTINGS };
	layout: RibbonLayout = defaultLayout();
	state: RibbonState = { ribbonTab: "home", ribbonCollapsed: false };

	/**
	 * The contract another plugin looks for. Keep `version` and the method name stable:
	 * Markdown Spreadsheets has no compile-time dependency on this plugin, only this shape.
	 */
	readonly ribbonHostApi: RibbonHostApi = {
		version: 1,
		acceptsIntegration: (id: string) => this.acceptsIntegration(id),
	};

	private view = new RibbonView(this);
	private rootEl: HTMLElement | null = null;
	private writeChain: Promise<void> = Promise.resolve();
	private lastMarkdown: MarkdownView | null = null;
	private lastViewType = "";
	private lastLayout: RibbonLayout | null = null;

	async onload(): Promise<void> {
		await this.loadPluginData();
		this.addSettingTab(new RibbonSettingTab(this.app, this));
		this.registerCommands();
		this.mountRibbon();
		// A grid that was already open when this plugin loaded should hand its toolbar over now.
		refreshSpreadsheetHost(this.app);
		if (isPluginEnabled(this.app, "onenote-style")) {
			new Notice("Ribbon toolbar: OneNote style is enabled too, so two ribbons will stack. Turn one of them off.", 10000);
		}

		// Obsidian rebuilds the workspace on layout changes; the bar lives outside it, so it
		// stays put — but after a full reload the mount point can be a new element.
		this.registerEvent(this.app.workspace.on("layout-change", () => this.ensureMounted()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => this.onLeafChange(leaf)));
		// A theme or font change does not resize the window, so the fit has to be told.
		this.registerEvent(this.app.workspace.on("css-change", () => this.view.remeasure()));
		this.app.workspace.onLayoutReady(() => {
			this.ensureMounted();
			this.syncContextTab();
		});

		// A plugin turned on or off changes which commands exist; re-measure on a slow timer
		// rather than subscribing to every plugin's lifecycle.
		this.registerInterval(window.setInterval(() => this.view.tick(), 2000));
		this.register(() => this.removeRibbon());
	}

	onunload(): void {
		// Queue the final snapshot behind any write already in flight; no timer to lose it to.
		void this.persist();
		this.removeRibbon();
		// With the host gone, Markdown Spreadsheets must put its own toolbar back.
		refreshSpreadsheetHost(this.app);
	}

	/* ---------- persistence ---------- */

	private async loadPluginData(): Promise<void> {
		const raw = (await this.loadData()) as PluginData | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) };
		if (this.settings.height !== "full" && this.settings.height !== "compact") this.settings.height = "compact";
		if (raw?.layout) {
			const version = (raw.layout as { version?: unknown }).version;
			if (typeof version === "number" && version > LAYOUT_VERSION) {
				new Notice("Ribbon toolbar: this layout was written by a newer version; showing what this version understands.", 10000);
			}
			try {
				this.layout = normalizeLayout(raw.layout);
			} catch (error) {
				console.error("Ribbon toolbar: the saved layout could not be read", error);
				new Notice("Ribbon toolbar: the saved layout could not be read; using the default layout.", 10000);
				this.layout = defaultLayout();
			}
		} else {
			this.layout = defaultLayout();
		}
		this.upgradeDefaultLayout();
		this.state = {
			ribbonTab: typeof raw?.state?.ribbonTab === "string" ? raw.state.ribbonTab : "home",
			ribbonCollapsed: raw?.state?.ribbonCollapsed === true,
		};
		// "Start collapsed" is a start-up decision, not a live override of the user's toggle.
		if (this.settings.startCollapsed) this.state.ribbonCollapsed = true;
	}

	/**
	 * A newer build ships a different default layout. A vault that never touched the old default
	 * is moved over silently; a customised layout is kept and the user is told once, so the
	 * change never arrives as a surprise reset.
	 */
	private upgradeDefaultLayout(): void {
		if ((this.layout.defaultsVersion ?? 1) >= DEFAULTS_VERSION) return;
		const untouchedDefault = layoutHash(this.layout) === LEGACY_DEFAULT_HASH;
		if (untouchedDefault) {
			this.layout = defaultLayout();
			void this.persist();
			new Notice("Ribbon toolbar: the default layout has been reorganised.", 8000);
			return;
		}
		// Mark it as seen either way: the hint should not repeat on every start.
		this.layout.defaultsVersion = DEFAULTS_VERSION;
		void this.persist();
		new Notice("Ribbon toolbar: a new default layout is available. Utilities → reset ribbon applies it.", 10000);
	}

	private snapshot(): PluginData {
		return { settings: this.settings, layout: this.layout, state: this.state };
	}

	/** Queue a write behind the previous one; the last snapshot wins. */
	private persist(): Promise<void> {
		const data = this.snapshot();
		this.writeChain = this.writeChain
			.then(() => this.saveData(data))
			.catch((error: unknown) => console.error("Ribbon toolbar: saving failed", error));
		return this.writeChain;
	}

	saveLayout(): void {
		void this.persist();
	}

	saveState(): void {
		void this.persist();
	}

	async saveSettings(): Promise<void> {
		await this.persist();
		this.view.remeasure();
		refreshSpreadsheetHost(this.app);
	}

	/* ---------- mount ---------- */

	/** The document that owns Obsidian's main workspace, not a settings popout. */
	private mainDocument(): Document {
		return this.app.workspace.containerEl.ownerDocument;
	}

	private mountRibbon(): void {
		this.removeRibbon();
		const doc = this.mainDocument();
		const at = mountPoint(doc);
		if (!at) return;
		const root = at.parent.createDiv("rtb");
		at.parent.insertBefore(root, at.before);
		doc.body.addClass("rtb-has-topbar");

		const tabrow = root.createDiv("rtb-tabrow");
		const quick = tabrow.createDiv("rtb-qat");
		this.renderQuickAccess(quick);
		const tabsEl = tabrow.createDiv({ cls: "rtb-tabs", attr: { role: "tablist" } });
		tabrow.createDiv("rtb-tabrow-spacer");
		const end = tabrow.createDiv("rtb-tabrow-end");
		const toggle = end.createEl("button", {
			cls: "rtb-toggle",
			attr: { type: "button", "data-tooltip-position": "bottom" },
		});
		const body = root.createDiv({ cls: "rtb-ribbon", attr: { id: "rtb-ribbon-panel", role: "tabpanel" } });

		// A click on the ribbon must not take the selection or focus away from the editor.
		root.addEventListener("mousedown", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || !target.closest("input, textarea")) event.preventDefault();
		});

		this.rootEl = root;
		this.view.mount(root, tabsEl, body, toggle);
	}

	private removeRibbon(): void {
		const doc = this.rootEl?.ownerDocument ?? this.mainDocument();
		this.view.unmount();
		this.rootEl?.remove();
		this.rootEl = null;
		doc.body.removeClass("rtb-has-topbar");
	}

	private ensureMounted(): void {
		if (!this.rootEl || !this.rootEl.isConnected) this.mountRibbon();
	}

	private renderQuickAccess(parent: HTMLElement): void {
		const tool = (icon: string, label: string, run: () => void): void => {
			const button = parent.createEl("button", {
				cls: "rtb-tool",
				attr: { type: "button", "aria-label": label, "data-tooltip-position": "bottom" },
			});
			setIcon(button, icon);
			button.addEventListener("click", run);
		};
		tool("undo", "Undo", () => this.activeEditor()?.undo());
		tool("redo", "Redo", () => this.activeEditor()?.redo());
	}

	private onLeafChange(leaf: WorkspaceLeaf | null): void {
		const type = leaf?.view?.getViewType?.() ?? "";
		const was = this.lastViewType;
		this.lastViewType = type;
		const markdown = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdown) this.lastMarkdown = markdown;
		if (
			type === "markdown-spreadsheet-view" &&
			was !== type &&
			this.settings.integrateSpreadsheet &&
			this.settings.autoSwitchSpreadsheetTab
		) {
			this.state.ribbonTab = "spreadsheet";
			this.saveState();
			this.view.render();
			return;
		}
		this.view.tick();
	}

	/** After a restart the grid can already be the active view; no leaf-change event is coming. */
	private syncContextTab(): void {
		if (!this.settings.integrateSpreadsheet || !this.settings.autoSwitchSpreadsheetTab) return;
		if (!spreadsheetActive(this.app)) return;
		this.state.ribbonTab = "spreadsheet";
		this.saveState();
		this.view.render();
	}

	/* ---------- the view's host ---------- */

	caps(): Capabilities {
		const detected = detect(this.app);
		const features = featureSet(this.app, this.settings, detected);
		const contexts = new Set<ContextKey>();
		const hasGrid = features.has("spreadsheet") && spreadsheetActive(this.app);
		if (hasGrid) contexts.add("spreadsheet");
		return { features, contexts };
	}

	rows(): number {
		return this.settings.height === "compact" ? 2 : 3;
	}

	canShow(command: { id: string }): boolean {
		// The HTML commands exist but stay out of the picker while the feature is off, so a
		// user cannot put an HTML button on the ribbon without opting in first.
		if (!this.settings.enableHtml && command.id.startsWith("ribbon-toolbar:html-")) return false;
		return true;
	}

	runCommand(id: string): void {
		if (executeCommand(this.app, id)) return;
		// Editing commands need a Markdown view. If a side pane has focus, return to the page
		// that was used last and try once more.
		const view = this.lastMarkdown;
		if (
			view &&
			view.leaf.view === view &&
			view.containerEl.isConnected &&
			this.app.workspace.getActiveViewOfType(MarkdownView) !== view
		) {
			this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
			if (executeCommand(this.app, id)) return;
		}
		new Notice("This command can't be used here right now.");
	}

	acceptsIntegration(id: string): boolean {
		return id === MDS_PLUGIN_ID && this.settings.integrateSpreadsheet && !!this.rootEl;
	}

	promptText(title: string, value: string, cta: string): Promise<string | null> {
		return promptText(this.app, title, value, cta);
	}

	confirm(title: string, message: string, cta: string): Promise<boolean> {
		return confirmAction(this.app, title, message, cta);
	}

	toggleRibbon(): void {
		this.state.ribbonCollapsed = !this.state.ribbonCollapsed;
		this.saveState();
		this.view.render();
	}

	startCustomising(): void {
		if (this.rootEl) this.view.setEditing(true);
	}

	exportLayoutFile(): void {
		const text = exportLayout(this.layout);
		const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
		const link = createEl("a", { href: url, attr: { download: "ribbon-toolbar-layout.json" } });
		link.click();
		URL.revokeObjectURL(url);
		new Notice("Ribbon layout exported.");
	}

	importLayoutFile(): void {
		const input = createEl("input", { type: "file", attr: { accept: ".json,application/json" } });
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (file) void this.importLayoutFromFile(file);
		});
		input.click();
	}

	private async importLayoutFromFile(file: File): Promise<void> {
		try {
			const text = await file.text();
			const next = importLayout(text);
			const caps = this.caps();
			// A contextual tab (only the Spreadsheet tab, say) is fine even when it is not
			// visible right now; a layout whose every tab is gated by a missing feature is not.
			if (!next.tabs.some((tab) => !tab.hidden && featureAvailable(tab.requires, caps))) {
				throw new Error("This layout has no tab that can be shown with the plugins you have.");
			}
			const ok = await this.confirm(
				"Import ribbon layout",
				"Replace the current tabs, groups and buttons with the imported layout? You can undo this once.",
				"Import",
			);
			if (!ok) return;
			this.lastLayout = cloneLayout(this.layout);
			this.layout = next;
			this.saveLayout();
			this.view.render();
			new Notice("Ribbon layout imported. Use “undo the last import or reset” to go back.");
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "That file is not a ribbon layout.");
		}
	}

	async resetLayout(): Promise<void> {
		const ok = await this.confirm(
			"Reset the ribbon",
			"Replace all tabs, groups and buttons with the default layout? You can undo this once.",
			"Reset",
		);
		if (!ok) return;
		this.lastLayout = cloneLayout(this.layout);
		this.layout = defaultLayout();
		this.saveLayout();
		this.state.ribbonTab = "home";
		this.state.ribbonCollapsed = false;
		this.saveState();
		this.view.render();
		new Notice("Ribbon reset to its default layout.");
	}

	private restoreLastLayout(): void {
		if (!this.lastLayout) {
			new Notice("There is nothing to undo.");
			return;
		}
		const previous = this.layout;
		this.layout = this.lastLayout;
		this.lastLayout = cloneLayout(previous);
		this.saveLayout();
		this.view.render();
		new Notice("Ribbon layout restored.");
	}

	/* ---------- commands ---------- */

	private registerCommands(): void {
		this.addCommand({ id: "toggle-ribbon", name: "Collapse or expand the ribbon", callback: () => this.toggleRibbon() });
		this.addCommand({ id: "customise", name: "Customise the ribbon", callback: () => this.startCustomising() });
		this.addCommand({
			id: "export",
			name: "Ribbon: export the layout to a file",
			callback: () => this.exportLayoutFile(),
		});
		this.addCommand({
			id: "import",
			name: "Ribbon: import a layout from a file",
			callback: () => this.importLayoutFile(),
		});
		this.addCommand({
			id: "reset",
			name: "Ribbon: reset to the default layout",
			callback: () => void this.resetLayout(),
		});
		this.addCommand({
			id: "undo-reset",
			name: "Ribbon: undo the last import or reset",
			callback: () => this.restoreLastLayout(),
		});

		/* Clipboard: Markdown editors have no built-in commands for these. */
		this.addCommand({
			id: "paste",
			name: "Paste",
			editorCallback: (editor) => void this.pasteFromClipboard(editor),
		});
		this.addCommand({
			id: "copy",
			name: "Copy",
			editorCallback: (editor) => void this.copySelection(editor),
		});
		this.addCommand({
			id: "cut",
			name: "Cut",
			editorCallback: (editor) => void this.cutSelection(editor),
		});

		/* Formatting that Markdown (or Obsidian's command list) does not provide. */
		this.addFormatCommand("highlight", "Toggle highlight", (text, from, to) => toggleInline(text, from, to, "=="));
		this.addFormatCommand("subscript", "Subscript", (text, from, to) => toggleTag(text, from, to, "sub"));
		this.addFormatCommand("superscript", "Superscript", (text, from, to) => toggleTag(text, from, to, "sup"));
		this.addFormatCommand("style-normal", "Style: normal text", (text, from, to) => setHeading(text, from, to, 0));
		this.addFormatCommand("style-h1", "Style: heading 1", (text, from, to) => setHeading(text, from, to, 1));
		this.addFormatCommand("style-h2", "Style: heading 2", (text, from, to) => setHeading(text, from, to, 2));
		this.addFormatCommand("style-h3", "Style: heading 3", (text, from, to) => setHeading(text, from, to, 3));
		this.addFormatCommand("style-h4", "Style: heading 4", (text, from, to) => setHeading(text, from, to, 4));
		this.addFormatCommand("insert-task", "New task", (text, from, to) => addLinePrefix(text, from, to, "- [ ] "));
		this.addCommand({
			id: "insert-table",
			name: "Insert table…",
			editorCallback: (editor) => void this.insertTable(editor),
		});
		this.addCommand({
			id: "insert-symbol",
			name: "Insert symbol…",
			editorCallback: (editor) => void this.insertSymbol(editor),
		});
		this.addCommand({
			id: "embed-canvas",
			name: "Embed a canvas…",
			editorCallback: () => void this.embedCanvas(),
		});

		/* HTML formatting: registered only while the setting is on, so the palette stays clean. */
		this.addCommand({
			id: "html-underline",
			name: "Underline (HTML)",
			editorCheckCallback: (checking, editor) => {
				if (!this.settings.enableHtml) return false;
				if (checking) return true;
				this.editText(editor, (text, from, to) => toggleTag(text, from, to, "u"));
				return true;
			},
		});
		this.addCommand({
			id: "html-color",
			name: "Font colour (HTML)…",
			editorCheckCallback: (checking, editor) => {
				if (!this.settings.enableHtml) return false;
				if (checking) return true;
				void this.pickColour(editor, "color");
				return true;
			},
		});
		this.addCommand({
			id: "html-highlight",
			name: "Highlight colour (HTML)…",
			editorCheckCallback: (checking, editor) => {
				if (!this.settings.enableHtml) return false;
				if (checking) return true;
				void this.pickColour(editor, "highlight");
				return true;
			},
		});
		this.addCommand({
			id: "html-clear",
			name: "Clear HTML formatting",
			editorCheckCallback: (checking, editor) => {
				if (!this.settings.enableHtml) return false;
				if (checking) return true;
				this.editText(editor, (text, from, to) => clearHtml(text, from, to));
				return true;
			},
		});
	}

	private addFormatCommand(id: string, name: string, build: (text: string, from: number, to: number) => TextEdit): void {
		this.addCommand({
			id,
			name,
			editorCallback: (editor) => this.editText(editor, build),
		});
	}

	/* ---------- editor helpers ---------- */

	private async pasteFromClipboard(editor: Editor): Promise<void> {
		try {
			const text = await navigator.clipboard.readText();
			editor.replaceSelection(text);
		} catch {
			new Notice("The clipboard could not be read.");
		}
	}

	private async cutSelection(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice("Select something to cut.");
			return;
		}
		try {
			await navigator.clipboard.writeText(selection);
			editor.replaceSelection("");
		} catch {
			new Notice("The clipboard could not be written.");
		}
	}

	private async copySelection(editor: Editor): Promise<void> {
		const selection = editor.getSelection() || editor.getLine(editor.getCursor().line);
		if (!selection) {
			new Notice("Select something to copy.");
			return;
		}
		try {
			await navigator.clipboard.writeText(selection);
		} catch {
			new Notice("The clipboard could not be written.");
		}
	}

	private activeEditor(): Editor | null {
		const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (active) return active;
		const last = this.lastMarkdown;
		if (!last) return null;
		// A closed note still leaves its view object behind; only use it while its leaf is open.
		const attached = this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view === last);
		return attached ? last.editor : null;
	}

	/**
	 * Applies a pure text edit to the editor as the smallest possible change, then restores
	 * the selection the edit asks for. One transaction, so one undo step.
	 */
	private editText(editor: Editor, build: (text: string, from: number, to: number) => TextEdit): void {
		const before = editor.getValue();
		const from = editor.posToOffset(editor.getCursor("from"));
		const to = editor.posToOffset(editor.getCursor("to"));
		let edit: TextEdit;
		try {
			edit = build(before, from, to);
		} catch (error) {
			console.error("Ribbon toolbar: formatting failed", error);
			return;
		}
		if (edit.text === before) return;

		let start = 0;
		const min = Math.min(before.length, edit.text.length);
		while (start < min && before[start] === edit.text[start]) start += 1;
		let endBefore = before.length;
		let endAfter = edit.text.length;
		while (endBefore > start && endAfter > start && before[endBefore - 1] === edit.text[endAfter - 1]) {
			endBefore -= 1;
			endAfter -= 1;
		}
		editor.transaction({
			changes: [{ from: editor.offsetToPos(start), to: editor.offsetToPos(endBefore), text: edit.text.slice(start, endAfter) }],
		});
		editor.setSelection(editor.offsetToPos(edit.from), editor.offsetToPos(edit.to));
	}

	private async insertTable(_editor: Editor): Promise<void> {
		const markdown = await insertTableDialog(this.app);
		if (!markdown) return;
		const target = this.activeEditor();
		if (!target) {
			new Notice("Open a note first.");
			return;
		}
		this.editText(target, (text, from) => insertBlock(text, from, markdown));
	}

	private async insertSymbol(_editor: Editor): Promise<void> {
		const symbol = await insertSymbolDialog(this.app);
		if (!symbol) return;
		const target = this.activeEditor();
		if (!target) {
			new Notice("Open a note first.");
			return;
		}
		target.replaceSelection(symbol);
	}

	/** Embeds an existing canvas as `![[drawing.canvas]]`, the one insert that is awkward by hand. */
	private async embedCanvas(): Promise<void> {
		const canvases = this.app.vault.getFiles().filter((file) => file.extension === "canvas");
		if (canvases.length === 0) {
			new Notice("There is no canvas in this vault yet.");
			return;
		}
		const file = await pickCanvas(this.app);
		if (!file) return;
		const target = this.activeEditor();
		if (!target) {
			new Notice("Open a note first.");
			return;
		}
		target.replaceSelection(`![[${file.path}]]`);
	}

	private async pickColour(_editor: Editor, kind: "color" | "highlight"): Promise<void> {
		const colour = await pickColor(
			this.app,
			kind === "color" ? "Font colour" : "Highlight colour",
			kind === "color" ? TEXT_COLORS : HIGHLIGHT_COLORS,
		);
		if (colour === undefined) return;
		const target = this.activeEditor();
		if (!target) {
			new Notice("Open a note first.");
			return;
		}
		if (kind === "color") this.editText(target, (text, from, to) => applyColor(text, from, to, colour));
		else this.editText(target, (text, from, to) => applyHighlight(text, from, to, colour));
	}
}
