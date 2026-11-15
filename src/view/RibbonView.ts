/*
 * Draws the ribbon (tabs -> groups -> buttons) and handles everything the user does on it:
 * clicks, right-click menus, drag and drop, the drop-downs for collapsed groups and for
 * "More", and the in-place customise mode.
 *
 * The layout lives in `model/layout.ts`, the sizing decisions in `model/fit.ts`. Obsidian
 * internals are reached only through `internal.ts`.
 *
 * `host` is the plugin. It owns persistence, commands and settings; the view owns pixels.
 */

import { Menu, Notice, Scope, getIcon, setIcon, type App, type Command } from "obsidian";
import * as M from "../model/layout";
import { fitGroups, fitTabs, LEVEL_COLLAPSED, LEVEL_FULL, LEVEL_ICONS, LEVEL_SMALL } from "../model/fit";
import { findCommand, hotkeyText, missingReason, tintMenuItem } from "../internal";
import { CommandPickerModal, IconPickerModal } from "./modals";

const DRAG_THRESHOLD = 6;
const TAB_HOVER_MS = 450;

const COLOR_LABEL: Record<M.ColorName, string> = {
	accent: "Accent",
	red: "Red",
	orange: "Orange",
	yellow: "Yellow",
	green: "Green",
	cyan: "Cyan",
	blue: "Blue",
	purple: "Purple",
	pink: "Pink",
	none: "No colour",
};

const PRIORITY_LABEL: Record<M.Priority, string> = {
	first: "Shrink first",
	normal: "Shrink normally",
	last: "Shrink last",
};

const CONTEXT_REASON: Record<M.ContextKey, string> = {
	spreadsheet: "Open a Markdown table as a spreadsheet to use this button.",
};

export interface RibbonHost {
	app: App;
	layout: M.RibbonLayout;
	state: { ribbonTab: string; ribbonCollapsed: boolean };
	settings: { height: "full" | "compact" };
	caps(): M.Capabilities;
	rows(): number;
	canShow(command: Command): boolean;
	runCommand(id: string): void;
	saveLayout(): void;
	saveState(): void;
	promptText(title: string, value: string, cta: string): Promise<string | null>;
	confirm(title: string, message: string, cta: string): Promise<boolean>;
	exportLayoutFile(): void;
	importLayoutFile(): void;
	resetLayout(): void | Promise<void>;
	toggleRibbon(): void;
}

interface Press {
	kind: "item" | "tab" | "group";
	id: string;
	el: HTMLElement;
	label?: string;
	x: number;
	y: number;
}

interface DragState {
	kind: "item" | "tab" | "group";
	id: string;
	ghost: HTMLElement;
	line: HTMLElement;
	target: { groupId?: string; tabId?: string; index?: number; after?: boolean } | null;
	hoverTab: string | null;
	hoverTimer: number;
}

interface Popover {
	el: HTMLElement;
	anchor: HTMLElement;
	close: () => void;
}

export class RibbonView {
	private root: HTMLElement | null = null;
	private tabsEl: HTMLElement | null = null;
	private bodyEl: HTMLElement | null = null;
	private toggleEl: HTMLElement | null = null;
	private strip: HTMLElement | null = null;
	private caps: M.Capabilities = { features: new Set(), contexts: new Set() };
	private rev = 0;
	private measured: {
		key: string;
		widths: Record<string, number[]>;
		moreWidth: number;
		newGroupWidth: number;
	} | null = null;
	private fitKey: string | null = null;
	private popover: Popover | null = null;
	private press: Press | null = null;
	private drag: DragState | null = null;
	private anchor: { rect: DOMRect; time: number } | null = null;
	private suppressClick = false;
	private editing = false;
	private editScope: Scope | null = null;
	private moreGroups: M.RibbonGroup[] = [];
	private observer: ResizeObserver | null = null;
	private styleTimer = 0;

	constructor(private readonly host: RibbonHost) {}

	get app(): App {
		return this.host.app;
	}

	get layout(): M.RibbonLayout {
		return this.host.layout;
	}

	get doc(): Document {
		return this.root?.ownerDocument ?? activeDocument;
	}

	isEditing(): boolean {
		return this.editing;
	}

	currentTab(): M.RibbonTab | null {
		return M.activeTab(this.layout, this.host.state.ribbonTab, this.caps);
	}

	/* ---------- mounting ---------- */

	mount(root: HTMLElement, tabsEl: HTMLElement, bodyEl: HTMLElement, toggleEl: HTMLElement): void {
		this.unmount();
		this.root = root;
		this.tabsEl = tabsEl;
		this.bodyEl = bodyEl;
		this.toggleEl = toggleEl;
		root.addEventListener("click", this.onClick);
		root.addEventListener("contextmenu", this.onContextMenu);
		root.addEventListener("pointerdown", this.onPointerDown);
		root.addEventListener("dblclick", this.onDoubleClick);
		root.addEventListener("keydown", this.onKeyDown);
		// ResizeObserver covers the ribbon itself; the window listener covers a viewport
		// change where the app container is resized in the same frame and no second RO tick comes.
		root.ownerDocument.defaultView?.addEventListener("resize", this.onWindowResize);
		let frame = 0;
		this.observer = new ResizeObserver(() => {
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				if (!this.root || !this.root.isConnected) return;
				this.root.toggleClass("is-narrow", this.root.clientWidth < 640);
				this.fitTabRow();
				this.layoutBody();
			});
		});
		this.observer.observe(root);
		this.render();
		this.awaitStyles();
	}

	/**
	 * When the plugin is turned on (or updated) while Obsidian is running, its stylesheet
	 * arrives a moment after the ribbon is drawn. Widths measured without it are far too
	 * wide and every group would end up in "More", so measure again once it is there.
	 */
	private awaitStyles(): void {
		window.clearInterval(this.styleTimer);
		const styled = (): boolean => {
			if (!this.root) return false;
			const probe = this.root.createDiv("rtb-strip");
			const ok = getComputedStyle(probe).display === "flex";
			probe.remove();
			return ok;
		};
		if (styled()) return;
		let tries = 0;
		this.styleTimer = window.setInterval(() => {
			if (!this.root || ++tries > 200) {
				window.clearInterval(this.styleTimer);
				return;
			}
			if (!styled()) return;
			window.clearInterval(this.styleTimer);
			this.remeasure();
		}, 50);
	}

	unmount(): void {
		this.closePopover();
		this.cancelDrag();
		this.popEditScope();
		this.editing = false;
		if (this.observer) this.observer.disconnect();
		this.observer = null;
		window.clearInterval(this.styleTimer);
		if (this.root) {
			this.root.removeEventListener("click", this.onClick);
			this.root.removeEventListener("contextmenu", this.onContextMenu);
			this.root.removeEventListener("pointerdown", this.onPointerDown);
			this.root.removeEventListener("dblclick", this.onDoubleClick);
			this.root.removeEventListener("keydown", this.onKeyDown);
			this.root.ownerDocument.defaultView?.removeEventListener("resize", this.onWindowResize);
		}
		this.root = this.tabsEl = this.bodyEl = this.toggleEl = this.strip = null;
	}

	render(): void {
		if (!this.root || !this.tabsEl || !this.bodyEl) return;
		this.caps = this.host.caps();
		this.root.toggleClass("is-compact", this.host.settings.height === "compact");
		this.root.toggleClass("is-editing", this.editing);
		this.renderToggle();
		this.renderTabs();
		this.renderBody();
	}

	/** A viewport resize: re-fit the tab row and the ribbon without re-measuring every group. */
	private readonly onWindowResize = (): void => {
		this.fitTabRow();
		this.layoutBody();
	};

	private renderToggle(): void {
		const el = this.toggleEl;
		if (!el) return;
		el.empty();
		el.setAttr("aria-expanded", String(!this.host.state.ribbonCollapsed));
		if (this.editing) {
			el.addClass("rtb-done");
			setIcon(el.createSpan("rtb-toggle-icon"), "check");
			el.createSpan({ cls: "rtb-toggle-label", text: "Done" });
			el.setAttr("aria-label", "Finish customising the ribbon");
			return;
		}
		el.removeClass("rtb-done");
		const collapsed = this.host.state.ribbonCollapsed;
		setIcon(el.createSpan("rtb-toggle-icon"), collapsed ? "chevron-down" : "chevron-up");
		el.setAttr("aria-label", collapsed ? "Expand the ribbon" : "Collapse the ribbon");
		el.setAttr("data-tooltip-position", "bottom");
	}

	/** Call after any change to the layout. */
	changed(): void {
		this.rev += 1;
		this.measured = null;
		this.host.saveLayout();
		this.render();
	}

	/** Forget measured widths (after a font, theme, height or zoom change) and redraw. */
	remeasure(): void {
		this.measured = null;
		this.render();
	}

	/** Called on a timer: redraws when a plugin was turned on or off, or a context changed. */
	tick(): void {
		if (!this.root || !this.strip || this.drag || this.popover || this.editing) return;
		const caps = this.host.caps();
		if (this.capsKey(caps) !== this.capsKey(this.caps)) {
			this.render();
			return;
		}
		const tab = this.currentTab();
		if (!tab || !this.measured) return;
		if (this.measured.key !== this.measureKey(tab)) this.renderBody();
	}

	/** Where a picker opened by the last clicked button should appear, or null. */
	lastAnchor(): DOMRect | null {
		return this.anchor && Date.now() - this.anchor.time < 1500 ? this.anchor.rect : null;
	}

	private capsKey(caps: M.Capabilities): string {
		return `${[...caps.features].sort().join(",")}|${[...caps.contexts].sort().join(",")}|${this.host.settings.height}`;
	}

	/* ---------- customise mode ---------- */

	/**
	 * Tabs and groups can be dragged like buttons, "+" tiles create new tabs, groups and
	 * buttons, and a click on a button opens its menu instead of running it.
	 */
	setEditing(on: boolean): void {
		on = !!on;
		if (this.editing === on || !this.root) return;
		this.editing = on;
		this.measured = null;
		this.popEditScope();
		if (on) {
			// Esc ends customise mode. It goes through Obsidian's key scopes: an open menu or
			// dialog has its own scope on top, so Esc closes that first.
			this.editScope = new Scope(this.app.scope);
			this.editScope.register([], "Escape", () => {
				if (this.drag || this.popover) return true;
				this.setEditing(false);
				return false;
			});
			this.app.keymap.pushScope(this.editScope);
			if (this.host.state.ribbonCollapsed) {
				this.host.state.ribbonCollapsed = false;
				this.host.saveState();
			}
		}
		this.render();
	}

	private popEditScope(): void {
		if (this.editScope) this.app.keymap.popScope(this.editScope);
		this.editScope = null;
	}

	/* ---------- tab row ---------- */

	private renderTabs(): void {
		const el = this.tabsEl;
		if (!el) return;
		el.empty();
		const current = this.currentTab();
		for (const tab of M.visibleTabs(this.layout, this.caps)) {
			el.createDiv({
				cls: `rtb-tab${current && tab.id === current.id ? " is-active" : ""}`,
				text: tab.name,
				attr: {
					"data-tab": tab.id,
					role: "tab",
					"aria-selected": String(!!current && tab.id === current.id),
					"aria-controls": "rtb-ribbon-panel",
					tabindex: "0",
				},
			});
		}
		if (this.editing) {
			const add = el.createDiv({
				cls: "rtb-tab rtb-tab-add",
				attr: { role: "button", tabindex: "0", "aria-label": "New tab", "data-tooltip-position": "bottom" },
			});
			setIcon(add, "plus");
		}
		this.fitTabRow();
	}

	/** Moves tab labels that don't fit into a drop-down at the end of the tab row. */
	private fitTabRow(): void {
		const el = this.tabsEl;
		if (!el || !el.isConnected) return;
		const old = el.querySelector(".rtb-tab-more");
		if (old) old.remove();
		const tabs = Array.from(el.querySelectorAll<HTMLElement>(".rtb-tab[data-tab]"));
		tabs.forEach((t) => t.removeClass("is-overflow", "is-squeezed"));
		if (!tabs.length || el.clientWidth <= 0 || el.scrollWidth <= el.clientWidth + 1) return;
		const widths = tabs.map((t) => Math.ceil(t.getBoundingClientRect().width) + 2);
		const activeIndex = tabs.findIndex((t) => t.hasClass("is-active"));
		const fit = fitTabs({ widths, available: el.clientWidth, active: activeIndex, moreWidth: this.editing ? 68 : 34 });
		fit.overflow.forEach((i) => tabs[i]?.addClass("is-overflow"));
		if (!fit.overflow.length) return;
		// Even the active tab alone is too wide: let its label shorten with "...".
		if (fit.visible.length === 1 && (widths[fit.visible[0] ?? 0] ?? 0) + 34 > el.clientWidth) {
			tabs[fit.visible[0] ?? 0]?.addClass("is-squeezed");
		}
		const more = el.createDiv({
			cls: "rtb-tab rtb-tab-more",
			attr: { role: "button", tabindex: "0", "aria-label": "More tabs", "data-tooltip-position": "bottom" },
		});
		setIcon(more, "chevrons-right");
		more.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			more.click();
		});
		more.addEventListener("click", (event) => {
			event.stopPropagation();
			const menu = new Menu();
			for (const i of fit.overflow) {
				const tabEl = tabs[i];
				if (!tabEl) continue;
				const id = tabEl.dataset.tab;
				if (!id) continue;
				menu.addItem((item) => item.setTitle(tabEl.textContent ?? "").onClick(() => this.selectTab(id)));
			}
			const rect = more.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom + 2 });
		});
	}

	private selectTab(id: string, focus = false): void {
		const state = this.host.state;
		const current = this.currentTab();
		// A click on a tab while the ribbon is collapsed expands it — the Office behaviour.
		if (state.ribbonCollapsed) {
			state.ribbonCollapsed = false;
			state.ribbonTab = id;
			this.host.saveState();
			this.render();
			if (focus) this.focusActiveTab();
			return;
		}
		if (current && current.id === id && state.ribbonTab === id) return;
		state.ribbonTab = id;
		this.host.saveState();
		this.render();
		if (focus) this.focusActiveTab();
	}

	/** Keyboard navigation keeps the focus on the tab strip; a re-render replaces the nodes. */
	private focusActiveTab(): void {
		this.tabsEl?.querySelector<HTMLElement>(".rtb-tab.is-active")?.focus();
	}

	/* ---------- ribbon body ---------- */

	private renderBody(): void {
		this.closePopover();
		const el = this.bodyEl;
		const root = this.root;
		if (!el || !root) return;
		el.empty();
		this.strip = null;
		this.fitKey = null;
		const collapsed = !!this.host.state.ribbonCollapsed;
		root.toggleClass("is-collapsed", collapsed);
		if (collapsed) return;

		this.strip = el.createDiv("rtb-strip");
		const tab = this.currentTab();
		if (!tab) {
			this.strip.createSpan({ cls: "rtb-empty-hint", text: "No tab is available. Enable a feature or reset the ribbon." });
			return;
		}
		const groups = M.visibleGroups(tab, this.caps);
		if (!groups.length) {
			const empty = this.strip.createEl("button", { cls: "rtb-empty", attr: { type: "button" } });
			setIcon(empty.createSpan("rtb-empty-icon"), "plus");
			empty.createSpan({ text: "Add a group" });
			empty.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.promptAddGroup(tab.id);
			});
			this.strip.createSpan({
				cls: "rtb-empty-hint",
				text: "This tab is empty. Right-click the ribbon to add a group and its buttons.",
			});
			return;
		}
		this.measure(tab, groups);
		this.layoutBody();
	}

	private measureKey(tab: M.RibbonTab): string {
		let avail = "";
		for (const group of tab.groups) {
			for (const item of M.visibleItems(group, this.caps)) {
				avail += findCommand(this.app, item.command) ? "1" : "0";
				avail += item.when && !this.caps.contexts.has(item.when) ? "0" : "1";
			}
		}
		return [tab.id, this.rev, avail, this.editing ? "edit" : "", this.host.settings.height].join("|");
	}

	/** Measures how wide every group of the tab is at each of the four size levels. */
	private measure(tab: M.RibbonTab, groups: M.RibbonGroup[]): void {
		const key = this.measureKey(tab);
		if (this.measured && this.measured.key === key) return;
		const strip = this.strip;
		if (!strip) return;
		strip.addClass("is-measuring");
		const widths: Record<string, number[]> = {};
		for (const group of groups) {
			const list: number[] = [];
			widths[group.id] = list;
			for (let level = LEVEL_FULL; level <= LEVEL_COLLAPSED; level++) {
				const node = this.drawGroup(strip, group, level);
				list[level] = Math.ceil(node.getBoundingClientRect().width);
				node.remove();
			}
		}
		const more = this.drawMore(strip, []);
		const moreWidth = Math.ceil(more.getBoundingClientRect().width);
		more.remove();
		let newGroupWidth = 0;
		if (this.editing) {
			const tile = this.drawNewGroup(strip);
			newGroupWidth = Math.ceil(tile.getBoundingClientRect().width) + 12;
			tile.remove();
		}
		strip.removeClass("is-measuring");
		this.measured = { key, widths, moreWidth, newGroupWidth };
	}

	/** Picks a size level for every group so the tab fits the current width, then draws it. */
	private layoutBody(): void {
		const strip = this.strip;
		const tab = this.currentTab();
		if (!strip || !strip.isConnected || !tab || !this.measured) return;
		const groups = M.visibleGroups(tab, this.caps);
		if (!groups.length || strip.clientWidth <= 0) return;
		const available = Math.floor(strip.clientWidth) - (this.editing ? this.measured.newGroupWidth : 0);
		const fit = fitGroups({
			groups: groups.map((group) => ({
				id: group.id,
				priority: group.priority,
				widths: this.measured?.widths[group.id] ?? [0, 0, 0, 0],
			})),
			available,
			gap: 0,
			moreWidth: this.measured.moreWidth,
			// A two-row ribbon keeps its labels: groups collapse into drop-downs instead of
			// turning into a row of unexplained icons.
			iconOnly: this.host.settings.height === "full",
		});
		const key = JSON.stringify([fit.levels, fit.overflow, this.editing, this.host.settings.height]);
		if (key === this.fitKey) return;
		this.fitKey = key;
		this.closePopover();
		strip.empty();
		const overflow: M.RibbonGroup[] = [];
		for (const group of groups) {
			if (fit.overflow.includes(group.id)) overflow.push(group);
			else this.drawGroup(strip, group, fit.levels[group.id] ?? LEVEL_FULL);
		}
		if (overflow.length) this.drawMore(strip, overflow);
		if (this.editing) this.drawNewGroup(strip);
		strip.dataset.fit = key;
	}

	private drawGroup(parent: HTMLElement, group: M.RibbonGroup, level: number): HTMLElement {
		// In the two-row ribbon, "small" is also "tight": less padding and a smaller label, so a
		// group can give up a few pixels before it has to collapse into a drop-down.
		const tight = level === LEVEL_SMALL && this.host.settings.height === "compact";
		const el = parent.createDiv({
			cls: `rtb-group${tight ? " is-tight" : ""}`,
			attr: { "data-group": group.id, "data-level": String(level) },
		});
		const items = M.visibleItems(group, this.caps);
		if (level === LEVEL_COLLAPSED && items.length) {
			el.addClass("is-collapsed");
			const button = el.createEl("button", {
				cls: "rtb-btn is-large rtb-group-button",
				attr: {
					type: "button",
					"aria-label": group.name,
					"data-tooltip-position": "bottom",
					"aria-haspopup": "true",
				},
			});
			const first = items[0] as M.RibbonItem;
			this.drawIcon(button.createSpan("rtb-btn-icon"), first, findCommand(this.app, first.command), group.name, true);
			button.createSpan({ cls: "rtb-btn-label", text: group.name });
			setIcon(button.createSpan("rtb-btn-caret"), "chevron-down");
			return el;
		}
		const body = el.createDiv("rtb-group-body");
		if (!items.length) {
			const add = body.createEl("button", {
				cls: "rtb-btn is-large rtb-add",
				attr: { type: "button", "aria-label": "Add a command to this group", "data-tooltip-position": "bottom" },
			});
			setIcon(add.createSpan("rtb-btn-icon"), "plus");
			add.createSpan({ cls: "rtb-btn-label", text: "Add" });
		}
		for (const column of M.packColumns(items, level, this.host.rows())) {
			if (column.kind === "large") {
				const only = column.items[0];
				if (only) this.drawButton(body, only, "large");
			} else {
				const stack = body.createDiv("rtb-stack");
				for (const item of column.items) this.drawButton(stack, item, level === LEVEL_ICONS ? "icon" : "small");
			}
		}
		if (this.editing && items.length) {
			const add = body.createEl("button", {
				cls: "rtb-btn is-icon rtb-add rtb-add-inline",
				attr: { type: "button", "aria-label": "Add a command to this group", "data-tooltip-position": "bottom" },
			});
			setIcon(add.createSpan("rtb-btn-icon"), "plus");
		}
		el.createDiv({ cls: "rtb-group-label", text: group.name });
		return el;
	}

	/** The "New group" tile shown at the end of the ribbon in customise mode. */
	private drawNewGroup(parent: HTMLElement): HTMLElement {
		const button = parent.createEl("button", {
			cls: "rtb-btn is-large rtb-new-group",
			attr: { type: "button", "aria-label": "Add a new group to this tab", "data-tooltip-position": "bottom" },
		});
		setIcon(button.createSpan("rtb-btn-icon"), "plus");
		button.createSpan({ cls: "rtb-btn-label", text: "New group" });
		return button;
	}

	private drawButton(parent: HTMLElement, item: M.RibbonItem, mode: "large" | "small" | "icon"): HTMLElement {
		const command = findCommand(this.app, item.command);
		const label = this.labelOf(item, command);
		const button = parent.createEl("button", {
			cls: `rtb-btn is-${mode}`,
			attr: { type: "button", "data-item": item.id, "data-tooltip-position": "bottom" },
		});
		this.drawIcon(button.createSpan("rtb-btn-icon"), item, command, label, mode === "large");
		if (mode !== "icon") button.createSpan({ cls: "rtb-btn-label", text: label });
		const contextOff = !!item.when && !this.caps.contexts.has(item.when);
		if (command && !contextOff) {
			const keys = hotkeyText(this.app, item.command);
			const name = command.name && command.name.toLowerCase() !== label.toLowerCase() ? `${label}: ${command.name}` : label;
			button.setAttr("aria-label", keys ? `${name} (${keys})` : name);
		} else {
			button.addClass("is-disabled");
			button.setAttr("aria-disabled", "true");
			const reason = contextOff && item.when ? CONTEXT_REASON[item.when] : command ? "" : missingReason(this.app, item.command);
			button.setAttr("aria-label", `${label} — ${reason}`);
		}
		return button;
	}

	private labelOf(item: M.RibbonItem, command: Command | null): string {
		if (item.label) return item.label;
		if (command?.name) return command.name.replace(/^[^:]{1,40}: /, "");
		const id = item.command;
		return id.slice(id.indexOf(":") + 1).replace(/-/g, " ");
	}

	private drawIcon(el: HTMLElement, item: M.RibbonItem, command: Command | null, label: string, large: boolean): void {
		const colour = M.iconColor(item, large);
		if (colour !== "none") el.dataset.color = colour;
		for (const id of [item.icon, command?.icon]) {
			if (id && /^[\w-]+$/.test(id) && getIcon(id)) {
				setIcon(el, id);
				return;
			}
		}
		// No usable icon: show the label's first letter in a tile.
		el.addClass("is-glyph");
		el.setText((label.trim()[0] ?? "?").toUpperCase());
	}

	private drawMore(parent: HTMLElement, groups: M.RibbonGroup[]): HTMLElement {
		const el = parent.createDiv("rtb-more");
		const button = el.createEl("button", {
			cls: "rtb-btn is-large rtb-more-button",
			attr: { type: "button", "aria-label": "More commands", "data-tooltip-position": "bottom", "aria-haspopup": "true" },
		});
		setIcon(button.createSpan("rtb-btn-icon"), "chevrons-right");
		button.createSpan({ cls: "rtb-btn-label", text: "More" });
		setIcon(button.createSpan("rtb-btn-caret"), "chevron-down");
		this.moreGroups = groups;
		return el;
	}

	/* ---------- drop-downs ---------- */

	private openPopover(anchorEl: HTMLElement, cls: string, build: (pop: HTMLElement) => void): void {
		const wasOpen = this.popover?.anchor === anchorEl;
		this.closePopover();
		if (wasOpen) return;
		const doc = this.doc;
		const pop = doc.body.createDiv(`rtb-popover ${cls}`);
		pop.addEventListener("mousedown", (event) => event.preventDefault());
		pop.addEventListener("click", this.onClick);
		pop.addEventListener("contextmenu", this.onContextMenu);
		build(pop);
		const rect = anchorEl.getBoundingClientRect();
		const vw = doc.documentElement.clientWidth;
		const vh = doc.documentElement.clientHeight;
		pop.setCssStyles({ maxWidth: `${vw - 16}px` });
		// Open just below the ribbon, so the drop-down doesn't cover the group labels.
		const ribbonBottom = this.bodyEl ? this.bodyEl.getBoundingClientRect().bottom : 0;
		const top = Math.max(rect.bottom + 4, ribbonBottom - 1);
		pop.setCssStyles({ maxHeight: `${Math.max(120, vh - top - 8)}px`, top: `${top}px` });
		const width = pop.offsetWidth;
		pop.setCssStyles({ left: `${Math.max(8, Math.min(rect.left, vw - width - 8))}px` });
		const onDown = (event: MouseEvent): void => {
			const target = this.elementOf(event);
			if (!target) return;
			if (pop.contains(target) || anchorEl.contains(target)) return;
			if (target.closest(".menu")) return;
			this.closePopover();
		};
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") this.closePopover();
		};
		doc.addEventListener("mousedown", onDown, true);
		doc.addEventListener("keydown", onKey, true);
		anchorEl.addClass("is-open");
		anchorEl.setAttr("aria-expanded", "true");
		this.popover = {
			el: pop,
			anchor: anchorEl,
			close: () => {
				pop.remove();
				doc.removeEventListener("mousedown", onDown, true);
				doc.removeEventListener("keydown", onKey, true);
				anchorEl.removeClass("is-open");
				anchorEl.setAttr("aria-expanded", "false");
			},
		};
	}

	private closePopover(): void {
		const popover = this.popover;
		if (!popover) return;
		this.popover = null;
		popover.close();
	}

	private openGroupPopover(groupId: string, anchorEl: HTMLElement): void {
		const found = M.findGroup(this.layout, groupId);
		if (!found) return;
		this.openPopover(anchorEl, "rtb-popover-group", (pop) => {
			this.drawGroup(pop, found.group, LEVEL_FULL);
		});
	}

	private openMorePopover(anchorEl: HTMLElement): void {
		const groups = this.moreGroups;
		this.openPopover(anchorEl, "rtb-popover-more", (pop) => {
			for (const group of groups) {
				const section = pop.createDiv({ cls: "rtb-more-group", attr: { "data-group": group.id } });
				section.createDiv({ cls: "rtb-more-title", text: group.name });
				const body = section.createDiv("rtb-more-items");
				const items = M.visibleItems(group, this.caps);
				if (!items.length) body.createSpan({ cls: "rtb-empty-hint", text: "Empty group." });
				for (const item of items) this.drawButton(body, item, "small");
			}
		});
	}

	/* ---------- clicks ---------- */

	/** The event's target as an element, checked the cross-window safe way Obsidian asks for. */
	private elementOf(event: Event): HTMLElement | null {
		const target = event.target as Node | null;
		if (!target || typeof target.instanceOf !== "function") return null;
		return target.instanceOf(HTMLElement) ? target : null;
	}

	private onClick = (event: MouseEvent): void => {
		if (this.suppressClick) return;
		const target = this.elementOf(event);
		if (!target) return;
		const tabEl = target.closest<HTMLElement>(".rtb-tab[data-tab]");
		if (tabEl?.dataset.tab) {
			this.selectTab(tabEl.dataset.tab);
			return;
		}
		if (target.closest(".rtb-tab-add")) {
			void this.promptAddTab();
			return;
		}
		if (target.closest(".rtb-toggle")) {
			if (this.editing) this.setEditing(false);
			else this.host.toggleRibbon();
			return;
		}
		if (target.closest(".rtb-new-group")) {
			const tab = this.currentTab();
			if (tab) void this.promptAddGroup(tab.id);
			return;
		}
		const itemEl = target.closest<HTMLElement>("[data-item]");
		if (itemEl?.dataset.item && this.editing) {
			// While customising, a click opens the button's menu instead of running it.
			const menu = this.itemMenu(itemEl.dataset.item, event);
			menu?.showAtMouseEvent(event);
			return;
		}
		if (itemEl?.dataset.item) {
			this.runItem(itemEl.dataset.item, itemEl);
			return;
		}
		if (this.editing && target.closest(".rtb-group-label")) {
			const groupEl = target.closest<HTMLElement>("[data-group]");
			if (groupEl?.dataset.group) this.groupMenu(groupEl.dataset.group)?.showAtMouseEvent(event);
			return;
		}
		if (target.closest(".rtb-add")) {
			const groupEl = target.closest<HTMLElement>("[data-group]");
			if (groupEl?.dataset.group) this.pickCommand(groupEl.dataset.group);
			return;
		}
		const groupButton = target.closest<HTMLElement>(".rtb-group-button");
		if (groupButton) {
			const groupEl = groupButton.closest<HTMLElement>("[data-group]");
			if (groupEl?.dataset.group) this.openGroupPopover(groupEl.dataset.group, groupButton);
			return;
		}
		const moreButton = target.closest<HTMLElement>(".rtb-more-button");
		if (moreButton) this.openMorePopover(moreButton);
	};

	private onDoubleClick = (event: MouseEvent): void => {
		const target = this.elementOf(event);
		if (target?.closest(".rtb-tab[data-tab]")) this.host.toggleRibbon();
	};

	/** Arrow keys move between ribbon tabs, Enter and Space open the focused one. */
	private onKeyDown = (event: KeyboardEvent): void => {
		const active = this.elementOf(event);
		const addEl = active?.closest(".rtb-tab-add");
		if (addEl) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				void this.promptAddTab();
			}
			return;
		}
		const tabEl = active?.closest<HTMLElement>(".rtb-tab[data-tab]");
		if (!tabEl || !this.tabsEl) return;
		const tabs = Array.from(this.tabsEl.querySelectorAll<HTMLElement>(".rtb-tab[data-tab]"));
		const index = tabs.indexOf(tabEl);
		if (index < 0) return;
		const focusAt = (next: number): void => tabs[(next + tabs.length) % tabs.length]?.focus();
		switch (event.key) {
			case "Enter":
			case " ":
				event.preventDefault();
				if (tabEl.dataset.tab) this.selectTab(tabEl.dataset.tab, true);
				break;
			case "ArrowRight":
				event.preventDefault();
				focusAt(index + 1);
				break;
			case "ArrowLeft":
				event.preventDefault();
				focusAt(index - 1);
				break;
			case "Home":
				event.preventDefault();
				focusAt(0);
				break;
			case "End":
				event.preventDefault();
				focusAt(tabs.length - 1);
				break;
			default:
		}
	};

	private runItem(itemId: string, el: HTMLElement): void {
		const found = M.findItem(this.layout, itemId);
		if (!found) return;
		this.anchor = { rect: el.getBoundingClientRect(), time: Date.now() };
		this.closePopover();
		const command = findCommand(this.app, found.item.command);
		if (!command) {
			new Notice(`"${this.labelOf(found.item, null)}" is not available. ${missingReason(this.app, found.item.command)}`);
			return;
		}
		if (found.item.when && !this.caps.contexts.has(found.item.when)) {
			new Notice(CONTEXT_REASON[found.item.when]);
			return;
		}
		this.host.runCommand(found.item.command);
	}

	/* ---------- right-click menus ---------- */

	private onContextMenu = (event: MouseEvent): void => {
		const target = this.elementOf(event);
		if (!target) return;
		if (target.closest("input, textarea")) return;
		event.preventDefault();
		event.stopPropagation();
		const itemEl = target.closest<HTMLElement>("[data-item]");
		const groupEl = target.closest<HTMLElement>("[data-group]");
		const tabEl = target.closest<HTMLElement>(".rtb-tab[data-tab]");
		let menu: Menu | null;
		if (itemEl?.dataset.item) menu = this.itemMenu(itemEl.dataset.item, event);
		else if (groupEl?.dataset.group) menu = this.groupMenu(groupEl.dataset.group);
		else {
			const tab = tabEl?.dataset.tab ? M.findTab(this.layout, tabEl.dataset.tab) : this.currentTab();
			menu = this.tabMenu(tab, !!tabEl);
		}
		menu?.showAtMouseEvent(event);
	};

	private itemMenu(itemId: string, event: MouseEvent): Menu | null {
		const found = M.findItem(this.layout, itemId);
		if (!found) return null;
		const { item, group, index } = found;
		const layout = this.layout;
		const menu = new Menu();
		menu.addItem((entry) =>
			entry
				.setTitle("Rename…")
				.setIcon("pencil")
				.onClick(async () => {
					const name = await this.host.promptText("Rename button", this.labelOf(item, findCommand(this.app, item.command)), "Rename");
					if (name && M.renameItem(layout, itemId, name)) this.changed();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Change icon…")
				.setIcon("image")
				.onClick(() => {
					new IconPickerModal(this.app, (icon) => {
						if (M.setItemIcon(layout, itemId, icon)) this.changed();
					}, item.icon).open();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Icon colour…")
				.setIcon("palette")
				.onClick(() => {
					const pick = new Menu();
					pick.addItem((choice) =>
						choice
							.setTitle("Default")
							.setChecked(!item.color)
							.onClick(() => {
								if (M.setItemColor(layout, itemId, "")) this.changed();
							}),
					);
					pick.addSeparator();
					for (const colour of M.COLORS) {
						pick.addItem((choice) => {
							choice
								.setTitle(COLOR_LABEL[colour])
								.setIcon(colour === "none" ? "circle-off" : "circle")
								.setChecked(item.color === colour)
								.onClick(() => {
									if (M.setItemColor(layout, itemId, colour)) this.changed();
								});
							tintMenuItem(choice, colour);
						});
					}
					pick.showAtPosition({ x: event.clientX, y: event.clientY });
				}),
		);
		if (item.label ?? item.icon) {
			menu.addItem((entry) =>
				entry
					.setTitle("Use the command's own name and icon")
					.setIcon("rotate-ccw")
					.onClick(() => {
						M.renameItem(layout, itemId, "");
						M.setItemIcon(layout, itemId, "");
						this.changed();
					}),
			);
		}
		menu.addSeparator();
		menu.addItem((entry) =>
			entry
				.setTitle("Large button")
				.setIcon("square")
				.setChecked(item.size === "large")
				.onClick(() => {
					if (M.setItemSize(layout, itemId, "large")) this.changed();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Small button")
				.setIcon("rows-3")
				.setChecked(item.size === "small")
				.onClick(() => {
					if (M.setItemSize(layout, itemId, "small")) this.changed();
				}),
		);
		menu.addSeparator();
		menu.addItem((entry) =>
			entry
				.setTitle("Move left")
				.setIcon("arrow-left")
				.setDisabled(index === 0)
				.onClick(() => {
					if (M.shiftItem(layout, itemId, -1)) this.changed();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Move right")
				.setIcon("arrow-right")
				.setDisabled(index === group.items.length - 1)
				.onClick(() => {
					if (M.shiftItem(layout, itemId, 1)) this.changed();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Move to group…")
				.setIcon("folder-input")
				.onClick(() => {
					const pick = new Menu();
					for (const tab of layout.tabs) {
						const groups = tab.groups.filter((candidate) => candidate.id !== group.id);
						if (!groups.length) continue;
						pick.addItem((choice) => choice.setTitle(tab.name).setIsLabel(true));
						for (const candidate of groups) {
							pick.addItem((choice) =>
								choice
									.setTitle(candidate.name)
									.setIcon("corner-down-right")
									.onClick(() => {
										if (M.moveItem(layout, itemId, candidate.id)) this.changed();
									}),
							);
						}
					}
					pick.showAtPosition({ x: event.clientX, y: event.clientY });
				}),
		);
		menu.addSeparator();
		menu.addItem((entry) =>
			entry
				.setTitle("Remove from ribbon")
				.setIcon("trash-2")
				.setWarning(true)
				.onClick(() => {
					if (M.removeItem(layout, itemId)) this.changed();
				}),
		);
		return menu;
	}

	private groupMenu(groupId: string): Menu | null {
		const found = M.findGroup(this.layout, groupId);
		if (!found) return null;
		const { group, tab, index } = found;
		const layout = this.layout;
		const menu = new Menu();
		menu.addItem((entry) => entry.setTitle("Add command…").setIcon("plus").onClick(() => this.pickCommand(groupId)));
		menu.addItem((entry) =>
			entry
				.setTitle("Rename group…")
				.setIcon("pencil")
				.onClick(async () => {
					const name = await this.host.promptText("Rename group", group.name, "Rename");
					if (name && M.renameGroup(layout, groupId, name)) this.changed();
				}),
		);
		menu.addSeparator();
		menu.addItem((entry) =>
			entry
				.setTitle("Move group left")
				.setIcon("arrow-left")
				.setDisabled(index === 0)
				.onClick(() => {
					if (M.moveGroup(layout, groupId, -1)) this.changed();
				}),
		);
		menu.addItem((entry) =>
			entry
				.setTitle("Move group right")
				.setIcon("arrow-right")
				.setDisabled(index === tab.groups.length - 1)
				.onClick(() => {
					if (M.moveGroup(layout, groupId, 1)) this.changed();
				}),
		);
		menu.addSeparator();
		menu.addItem((entry) => entry.setTitle("When space runs out").setIsLabel(true));
		for (const priority of M.PRIORITIES) {
			menu.addItem((entry) =>
				entry
					.setTitle(PRIORITY_LABEL[priority])
					.setChecked(group.priority === priority)
					.onClick(() => {
						if (M.setGroupPriority(layout, groupId, priority)) this.changed();
					}),
			);
		}
		menu.addSeparator();
		menu.addItem((entry) =>
			entry.setTitle("New group…").setIcon("folder-plus").onClick(() => void this.promptAddGroup(tab.id, groupId)),
		);
		this.addEditToggle(menu);
		menu.addItem((entry) =>
			entry
				.setTitle("Delete group")
				.setIcon("trash-2")
				.setWarning(true)
				.onClick(async () => {
					if (group.items.length) {
						const ok = await this.host.confirm(
							"Delete group",
							`Delete the group "${group.name}" and its ${group.items.length} button(s)?`,
							"Delete",
						);
						if (!ok) return;
					}
					if (M.removeGroup(layout, groupId)) this.changed();
				}),
		);
		return menu;
	}

	private tabMenu(tab: M.RibbonTab | null, onTab: boolean): Menu {
		const layout = this.layout;
		const caps = this.caps;
		const menu = new Menu();
		this.addEditToggle(menu);
		menu.addSeparator();
		if (tab) {
			menu.addItem((entry) =>
				entry.setTitle("New group…").setIcon("folder-plus").onClick(() => void this.promptAddGroup(tab.id)),
			);
		}
		menu.addItem((entry) => entry.setTitle("New tab…").setIcon("plus").onClick(() => void this.promptAddTab(tab?.id ?? null)));
		if (tab) {
			const visible = M.visibleTabs(layout, caps);
			const pos = visible.indexOf(tab);
			menu.addItem((entry) =>
				entry
					.setTitle(`Rename tab "${tab.name}"…`)
					.setIcon("pencil")
					.onClick(async () => {
						const name = await this.host.promptText("Rename tab", tab.name, "Rename");
						if (name && M.renameTab(layout, tab.id, name)) this.changed();
					}),
			);
			menu.addItem((entry) =>
				entry
					.setTitle("Move tab left")
					.setIcon("arrow-left")
					.setDisabled(pos <= 0)
					.onClick(() => {
						if (M.moveTab(layout, tab.id, -1)) this.changed();
					}),
			);
			menu.addItem((entry) =>
				entry
					.setTitle("Move tab right")
					.setIcon("arrow-right")
					.setDisabled(pos < 0 || pos === visible.length - 1)
					.onClick(() => {
						if (M.moveTab(layout, tab.id, 1)) this.changed();
					}),
			);
			menu.addItem((entry) =>
				entry
					.setTitle(`Hide tab "${tab.name}"`)
					.setIcon("eye-off")
					.setDisabled(visible.length <= 1)
					.onClick(() => {
						if (M.setTabHidden(layout, tab.id, true, caps)) this.changed();
					}),
			);
			menu.addItem((entry) =>
				entry
					.setTitle(`Delete tab "${tab.name}"…`)
					.setIcon("trash-2")
					.setWarning(true)
					.setDisabled(visible.length <= 1)
					.onClick(async () => {
						const ok = await this.host.confirm(
							"Delete tab",
							`Delete the tab "${tab.name}" with all its groups and buttons? To keep it for later, hide it instead.`,
							"Delete",
						);
						if (ok && M.removeTab(layout, tab.id, caps)) this.changed();
					}),
			);
		}
		const hidden = layout.tabs.filter((candidate) => candidate.hidden);
		if (hidden.length) {
			menu.addSeparator();
			menu.addItem((entry) => entry.setTitle("Hidden tabs").setIsLabel(true));
			for (const candidate of hidden) {
				menu.addItem((entry) =>
					entry
						.setTitle(`Show "${candidate.name}"`)
						.setIcon("eye")
						.onClick(() => {
							if (M.setTabHidden(layout, candidate.id, false, caps)) {
								this.host.state.ribbonTab = candidate.id;
								this.changed();
							}
						}),
				);
			}
		}
		menu.addSeparator();
		menu.addItem((entry) => entry.setTitle("Export layout…").setIcon("download").onClick(() => this.host.exportLayoutFile()));
		menu.addItem((entry) => entry.setTitle("Import layout…").setIcon("upload").onClick(() => this.host.importLayoutFile()));
		menu.addItem((entry) => entry.setTitle("Reset to default…").setIcon("rotate-ccw").onClick(() => this.host.resetLayout()));
		if (!onTab) {
			menu.addSeparator();
			menu.addItem((entry) =>
				entry
					.setTitle("Collapse the ribbon")
					.setIcon("chevron-up")
					.onClick(() => this.host.toggleRibbon()),
			);
		}
		return menu;
	}

	private addEditToggle(menu: Menu): void {
		if (this.editing) {
			menu.addItem((entry) => entry.setTitle("Done customising").setIcon("check").onClick(() => this.setEditing(false)));
		} else {
			menu.addItem((entry) => entry.setTitle("Customise with drag and drop").setIcon("move").onClick(() => this.setEditing(true)));
		}
	}

	private async promptAddTab(afterTabId?: string | null): Promise<void> {
		const name = await this.host.promptText("New tab", "", "Add");
		if (!name) return;
		const current = this.currentTab();
		const created = M.addTab(this.layout, name, afterTabId ?? current?.id ?? null);
		this.host.state.ribbonTab = created.id;
		this.changed();
	}

	private pickCommand(groupId: string): void {
		new CommandPickerModal(
			this.app,
			(command) => this.host.canShow(command),
			(command) => {
				if (M.addItem(this.layout, groupId, command.id, { size: "small" })) this.changed();
			},
		).open();
	}

	private async promptAddGroup(tabId: string, afterGroupId?: string): Promise<void> {
		const name = await this.host.promptText("New group", "", "Add");
		if (!name) return;
		const group = M.addGroup(this.layout, tabId, name, afterGroupId);
		if (!group) return;
		this.changed();
		this.pickCommand(group.id);
	}

	/* ---------- drag and drop (pointer events, so it also works with touch) ---------- */

	private onPointerDown = (event: PointerEvent): void => {
		if (event.button !== 0 || !this.strip) return;
		const target = this.elementOf(event);
		if (!target) return;
		let press: Press | null = null;
		const itemEl = target.closest<HTMLElement>("[data-item]");
		if (itemEl?.dataset.item && this.strip.contains(itemEl)) {
			press = { kind: "item", id: itemEl.dataset.item, el: itemEl, x: event.clientX, y: event.clientY };
		} else if (this.editing) {
			// In customise mode tabs and groups (by their label) can be dragged too.
			const tabEl = target.closest<HTMLElement>(".rtb-tab[data-tab]");
			const groupEl = target.closest<HTMLElement>(".rtb-group[data-group]");
			if (tabEl?.dataset.tab) {
				press = { kind: "tab", id: tabEl.dataset.tab, el: tabEl, label: tabEl.textContent ?? "", x: event.clientX, y: event.clientY };
			} else if (groupEl?.dataset.group && this.strip.contains(groupEl) && target.closest(".rtb-group-label, .rtb-group-button")) {
				const found = M.findGroup(this.layout, groupEl.dataset.group);
				if (found) {
					press = { kind: "group", id: found.group.id, el: groupEl, label: found.group.name, x: event.clientX, y: event.clientY };
				}
			}
		}
		if (!press) return;
		this.press = press;
		const doc = this.doc;
		doc.addEventListener("pointermove", this.onPointerMove, true);
		doc.addEventListener("pointerup", this.onPointerUp, true);
		doc.addEventListener("pointercancel", this.onPointerUp, true);
		doc.addEventListener("keydown", this.onDragKey, true);
	};

	private onPointerMove = (event: PointerEvent): void => {
		const press = this.press;
		if (!press) return;
		if (!this.drag) {
			if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
			this.startDrag(press);
		}
		const drag = this.drag;
		if (!drag) return;
		drag.ghost.setCssStyles({ left: `${event.clientX + 10}px`, top: `${event.clientY + 12}px` });
		this.updateDropTarget(event.clientX, event.clientY);
	};

	private startDrag(press: Press): void {
		this.closePopover();
		const doc = this.doc;
		let ghost: HTMLElement;
		if (press.kind === "item") {
			const clone = press.el.cloneNode(true);
			ghost = clone.instanceOf(HTMLElement) ? clone : doc.body.createDiv();
			ghost.removeAttribute("data-item");
			ghost.removeAttribute("aria-label");
			ghost.addClass("rtb-ghost");
			doc.body.appendChild(ghost);
		} else {
			ghost = doc.body.createDiv({ cls: "rtb-ghost-chip", text: press.label ?? "" });
		}
		const line = doc.body.createDiv("rtb-drop-line");
		press.el.addClass("is-drag-source");
		this.root?.addClass("is-dragging");
		this.drag = { kind: press.kind, id: press.id, ghost, line, target: null, hoverTab: null, hoverTimer: 0 };
	}

	private updateDropTarget(x: number, y: number): void {
		const drag = this.drag;
		if (!drag) return;
		const doc = this.doc;
		drag.target = null;
		drag.line.setCssStyles({ display: "none" });
		doc.querySelectorAll(".rtb-group.is-drop-target").forEach((el) => el.removeClass("is-drop-target"));
		const under = doc.elementFromPoint(x, y);
		const tabEl = under?.closest<HTMLElement>(".rtb-tab[data-tab]") ?? null;
		const tabId = tabEl?.dataset.tab ?? null;
		const edge = (rect: DOMRect, before: boolean): void => {
			drag.line.setCssStyles({
				display: "block",
				left: `${before ? rect.left - 1 : rect.right - 1}px`,
				top: `${rect.top}px`,
				width: "2px",
				height: `${rect.height}px`,
			});
		};
		if (drag.kind === "tab") {
			if (!tabEl || !tabId || tabId === drag.id) return;
			const rect = tabEl.getBoundingClientRect();
			const before = x < rect.left + rect.width / 2;
			drag.target = { tabId, after: !before };
			edge(rect, before);
			return;
		}
		if (tabId !== drag.hoverTab) {
			window.clearTimeout(drag.hoverTimer);
			drag.hoverTab = tabId;
			const current = this.currentTab();
			if (tabId && (!current || current.id !== tabId)) {
				// Hovering over another tab while dragging switches to it.
				drag.hoverTimer = window.setTimeout(() => {
					if (this.drag !== drag || !tabId) return;
					this.host.state.ribbonTab = tabId;
					this.render();
				}, TAB_HOVER_MS);
			}
		}
		if (!under || !this.strip || !this.strip.contains(under)) return;
		const groupEl = under.closest<HTMLElement>("[data-group]");
		if (drag.kind === "group") {
			const tab = this.currentTab();
			if (!tab) return;
			if (!groupEl?.dataset.group) {
				drag.target = { tabId: tab.id };
				return;
			}
			if (groupEl.dataset.group === drag.id) return;
			const index = tab.groups.findIndex((group) => group.id === groupEl.dataset.group);
			if (index < 0) return;
			const rect = groupEl.getBoundingClientRect();
			const before = x < rect.left + rect.width / 2;
			drag.target = { tabId: tab.id, index: index + (before ? 0 : 1) };
			edge(rect, before);
			return;
		}
		if (!groupEl?.dataset.group) return;
		const found = M.findGroup(this.layout, groupEl.dataset.group);
		if (!found) return;
		const itemEl = under.closest<HTMLElement>("[data-item]");
		if (itemEl?.dataset.item && itemEl.dataset.item === drag.id) return;
		if (itemEl?.dataset.item) {
			const index = found.group.items.findIndex((item) => item.id === itemEl.dataset.item);
			const rect = itemEl.getBoundingClientRect();
			const sideways = itemEl.hasClass("is-large");
			const before = sideways ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
			drag.target = { groupId: found.group.id, index: index + (before ? 0 : 1) };
			if (sideways) {
				drag.line.setCssStyles({
					display: "block",
					left: `${before ? rect.left - 2 : rect.right}px`,
					top: `${rect.top}px`,
					width: "2px",
					height: `${rect.height}px`,
				});
			} else {
				drag.line.setCssStyles({
					display: "block",
					left: `${rect.left}px`,
					top: `${before ? rect.top - 1 : rect.bottom - 1}px`,
					width: `${rect.width}px`,
					height: "2px",
				});
			}
			return;
		}
		drag.target = { groupId: found.group.id };
		groupEl.addClass("is-drop-target");
	}

	private onPointerUp = (): void => {
		const drag = this.drag;
		const target = drag?.target ?? null;
		this.cancelDrag();
		if (!drag) return;
		// The click that follows a drag must not run the button.
		this.suppressClick = true;
		window.setTimeout(() => {
			this.suppressClick = false;
		}, 0);
		let moved = false;
		if (target && drag.kind === "item" && target.groupId) moved = M.moveItem(this.layout, drag.id, target.groupId, target.index);
		else if (target && drag.kind === "group" && target.tabId) moved = M.moveGroupTo(this.layout, drag.id, target.tabId, target.index);
		else if (target && drag.kind === "tab" && target.tabId) moved = M.moveTabNextTo(this.layout, drag.id, target.tabId, !!target.after);
		if (moved) this.changed();
		else this.render();
	};

	private onDragKey = (event: KeyboardEvent): void => {
		if (event.key !== "Escape" || !this.drag) return;
		event.preventDefault();
		event.stopPropagation();
		this.cancelDrag();
		this.render();
	};

	private cancelDrag(): void {
		const doc = this.doc;
		doc.removeEventListener("pointermove", this.onPointerMove, true);
		doc.removeEventListener("pointerup", this.onPointerUp, true);
		doc.removeEventListener("pointercancel", this.onPointerUp, true);
		doc.removeEventListener("keydown", this.onDragKey, true);
		this.press = null;
		const drag = this.drag;
		this.drag = null;
		if (!drag) return;
		window.clearTimeout(drag.hoverTimer);
		drag.ghost.remove();
		drag.line.remove();
		doc.querySelectorAll(".is-drag-source").forEach((el) => el.removeClass("is-drag-source"));
		doc.querySelectorAll(".rtb-group.is-drop-target").forEach((el) => el.removeClass("is-drop-target"));
		this.root?.removeClass("is-dragging");
	}
}
