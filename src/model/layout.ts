/*
 * The ribbon layout: tabs -> groups -> buttons.
 *
 * Pure data and functions, no Obsidian and no DOM, so the whole model runs in plain Node
 * under vitest. Every function that changes a layout changes it in place and returns true
 * when something changed.
 *
 *   layout = { version, tabs: [tab] }
 *   tab    = { id, name, hidden, requires?, context?, groups: [group] }
 *   group  = { id, name, priority, requires?, items: [item] }
 *   item   = { id, command, size, label?, icon?, color?, requires?, when? }
 *
 * `command` is an Obsidian command id such as "editor:toggle-bold". `label` and `icon` are
 * optional overrides; without them the command's own name and icon are used.
 *
 * `requires` names a feature the host must offer for the thing to be shown at all: the HTML
 * formatting tab, or a tab that belongs to an optional plugin. `context` / `when` only disable
 * rather than hide, so a tab can stay put while it has nothing to act on (the Spreadsheet tab
 * outside a spreadsheet).
 */

export const LAYOUT_VERSION = 1;
export const EXPORT_FORMAT = "ribbon-toolbar-layout";
export const PRIORITIES = ["first", "normal", "last"] as const;
export const SIZES = ["large", "small"] as const;
/** Icon colours. 'accent' and the names follow the theme; 'none' is the plain icon colour. */
export const COLORS = ["accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "none"] as const;
/** Small buttons are stacked this many high, like in Office. The compact ribbon stacks two. */
export const STACK = 3;

export type Priority = (typeof PRIORITIES)[number];
export type ItemSize = (typeof SIZES)[number];
export type ColorName = (typeof COLORS)[number];
export type FeatureKey =
	| "html"
	| "tasks"
	| "spreadsheet"
	| "excalidraw"
	| "bases"
	| "templates"
	| "templater"
	| "thesaurus"
	| "languagetool"
	| "advanced-tables"
	| "kanban";
export type ContextKey = "spreadsheet";

export interface RibbonItem {
	id: string;
	command: string;
	size: ItemSize;
	label?: string;
	icon?: string;
	color?: ColorName;
	requires?: FeatureKey;
	when?: ContextKey;
}

export interface RibbonGroup {
	id: string;
	name: string;
	priority: Priority;
	requires?: FeatureKey;
	items: RibbonItem[];
}

export interface RibbonTab {
	id: string;
	name: string;
	hidden: boolean;
	requires?: FeatureKey;
	context?: ContextKey;
	groups: RibbonGroup[];
}

export interface RibbonLayout {
	version: number;
	tabs: RibbonTab[];
}

/** What the host can offer right now. `undefined` on a requirement means "always". */
export interface Capabilities {
	features: ReadonlySet<string>;
	contexts: ReadonlySet<string>;
}

let counter = 0;

export function uid(prefix: string): string {
	counter += 1;
	return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const optionalStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function optionalFeature(v: unknown): FeatureKey | undefined {
	return typeof v === "string" && v.trim() ? (v.trim() as FeatureKey) : undefined;
}

/**
 * Returns a clean copy of `raw`: unknown fields dropped, missing ones filled in, ids made
 * unique. Throws an Error with a readable message if `raw` is not a layout at all.
 */
export function normalizeLayout(raw: unknown): RibbonLayout {
	if (!raw || typeof raw !== "object" || !Array.isArray((raw as { tabs?: unknown }).tabs)) {
		throw new Error("This is not a ribbon layout (no list of tabs found).");
	}
	const source = raw as { tabs: unknown[] };
	const seen = new Set<string>();
	const id = (wanted: unknown, prefix: string): string => {
		let v = str(wanted, "") || uid(prefix);
		while (seen.has(v)) v = uid(prefix);
		seen.add(v);
		return v;
	};
	const tabs: RibbonTab[] = [];
	for (const rawTab of source.tabs) {
		if (!rawTab || typeof rawTab !== "object") continue;
		const t = rawTab as Record<string, unknown>;
		const requires = optionalFeature(t.requires);
		const tab: RibbonTab = {
			id: id(t.id, "tab"),
			name: str(t.name, "Tab"),
			hidden: t.hidden === true,
			...(requires ? { requires } : {}),
			...(t.context === "spreadsheet" ? { context: "spreadsheet" as const } : {}),
			groups: [],
		};
		for (const rawGroup of Array.isArray(t.groups) ? t.groups : []) {
			if (!rawGroup || typeof rawGroup !== "object") continue;
			const g = rawGroup as Record<string, unknown>;
			const groupRequires = optionalFeature(g.requires);
			const group: RibbonGroup = {
				id: id(g.id, "grp"),
				name: str(g.name, "Group"),
				priority: PRIORITIES.includes(g.priority as Priority) ? (g.priority as Priority) : "normal",
				...(groupRequires ? { requires: groupRequires } : {}),
				items: [],
			};
			for (const rawItem of Array.isArray(g.items) ? g.items : []) {
				if (!rawItem || typeof rawItem !== "object") continue;
				const i = rawItem as Record<string, unknown>;
				if (!str(i.command, "")) continue;
				const item: RibbonItem = {
					id: id(i.id, "btn"),
					command: str(i.command, ""),
					size: SIZES.includes(i.size as ItemSize) ? (i.size as ItemSize) : "small",
				};
				const label = optionalStr(i.label);
				if (label) item.label = label;
				const icon = optionalStr(i.icon);
				if (icon) item.icon = icon;
				if (COLORS.includes(i.color as ColorName)) item.color = i.color as ColorName;
				const itemRequires = optionalFeature(i.requires);
				if (itemRequires) item.requires = itemRequires;
				if (i.when === "spreadsheet") item.when = "spreadsheet";
				group.items.push(item);
			}
			tab.groups.push(group);
		}
		tabs.push(tab);
	}
	return { version: LAYOUT_VERSION, tabs };
}

export function cloneLayout(layout: RibbonLayout): RibbonLayout {
	return JSON.parse(JSON.stringify(layout)) as RibbonLayout;
}

/* ---------- capability filtering ---------- */

export function featureAvailable(requires: FeatureKey | undefined, caps: Capabilities): boolean {
	return !requires || caps.features.has(requires);
}

export function contextAvailable(context: ContextKey | undefined, caps: Capabilities): boolean {
	return !context || caps.contexts.has(context);
}

export function visibleTabs(layout: RibbonLayout, caps: Capabilities): RibbonTab[] {
	return layout.tabs.filter((t) => !t.hidden && featureAvailable(t.requires, caps) && contextAvailable(t.context, caps));
}

export function visibleGroups(tab: RibbonTab, caps: Capabilities): RibbonGroup[] {
	return tab.groups.filter((g) => featureAvailable(g.requires, caps) && visibleItems(g, caps).length > 0);
}

export function visibleItems(group: RibbonGroup, caps: Capabilities): RibbonItem[] {
	return group.items.filter((i) => featureAvailable(i.requires, caps));
}

/** The tab to show: the wanted one if it is visible, else the first visible tab. */
export function activeTab(layout: RibbonLayout, wantedId: string, caps: Capabilities): RibbonTab | null {
	const visible = visibleTabs(layout, caps);
	return visible.find((t) => t.id === wantedId) ?? visible[0] ?? null;
}

/** Every command id used in the layout (or in one tab). */
export function commandsIn(layout: RibbonLayout, tabId?: string): string[] {
	const out: string[] = [];
	for (const tab of layout.tabs) {
		if (tabId && tab.id !== tabId) continue;
		for (const g of tab.groups) for (const i of g.items) out.push(i.command);
	}
	return out;
}

/* ---------- lookups ---------- */

export function findTab(layout: RibbonLayout, tabId: string): RibbonTab | null {
	return layout.tabs.find((t) => t.id === tabId) ?? null;
}

export function findGroup(layout: RibbonLayout, groupId: string): { tab: RibbonTab; group: RibbonGroup; index: number } | null {
	for (const tab of layout.tabs) {
		const index = tab.groups.findIndex((g) => g.id === groupId);
		if (index >= 0) return { tab, group: tab.groups[index] as RibbonGroup, index };
	}
	return null;
}

export function findItem(
	layout: RibbonLayout,
	itemId: string,
): { tab: RibbonTab; group: RibbonGroup; item: RibbonItem; index: number } | null {
	for (const tab of layout.tabs) {
		for (const group of tab.groups) {
			const index = group.items.findIndex((i) => i.id === itemId);
			if (index >= 0) return { tab, group, item: group.items[index] as RibbonItem, index };
		}
	}
	return null;
}

function shift<T>(list: T[], index: number, dir: number): boolean {
	const to = index + dir;
	if (index < 0 || to < 0 || to >= list.length) return false;
	const [x] = list.splice(index, 1);
	list.splice(to, 0, x as T);
	return true;
}

/* ---------- tabs ---------- */

export function addTab(layout: RibbonLayout, name: string, afterTabId?: string | null): RibbonTab {
	const tab: RibbonTab = { id: uid("tab"), name: str(name, "New tab"), hidden: false, groups: [] };
	const at = layout.tabs.findIndex((t) => t.id === afterTabId);
	layout.tabs.splice(at >= 0 ? at + 1 : layout.tabs.length, 0, tab);
	return tab;
}

export function renameTab(layout: RibbonLayout, tabId: string, name: string): boolean {
	const tab = findTab(layout, tabId);
	if (!tab || !str(name, "")) return false;
	tab.name = name.trim();
	return true;
}

/** Hides or shows a tab. The last visible tab can't be hidden. */
export function setTabHidden(layout: RibbonLayout, tabId: string, hidden: boolean, caps: Capabilities): boolean {
	const tab = findTab(layout, tabId);
	if (!tab || tab.hidden === hidden) return false;
	if (hidden && visibleTabs(layout, caps).length <= 1) return false;
	tab.hidden = hidden;
	return true;
}

/** Moves a tab one step among the visible tabs (hidden tabs are skipped over). */
export function moveTab(layout: RibbonLayout, tabId: string, dir: number): boolean {
	const from = layout.tabs.findIndex((t) => t.id === tabId);
	if (from < 0) return false;
	let to = from + dir;
	while (to >= 0 && to < layout.tabs.length && layout.tabs[to]?.hidden) to += dir;
	if (to < 0 || to >= layout.tabs.length) return false;
	const [tab] = layout.tabs.splice(from, 1);
	layout.tabs.splice(to, 0, tab as RibbonTab);
	return true;
}

/** Drops a tab right before (or after) another tab. Used by drag and drop. */
export function moveTabNextTo(layout: RibbonLayout, tabId: string, targetId: string, after: boolean): boolean {
	const from = layout.tabs.findIndex((t) => t.id === tabId);
	if (from < 0 || tabId === targetId || !findTab(layout, targetId)) return false;
	const [tab] = layout.tabs.splice(from, 1);
	const to = layout.tabs.findIndex((t) => t.id === targetId) + (after ? 1 : 0);
	layout.tabs.splice(to, 0, tab as RibbonTab);
	return to !== from;
}

export function removeTab(layout: RibbonLayout, tabId: string, caps: Capabilities): boolean {
	const index = layout.tabs.findIndex((t) => t.id === tabId);
	if (index < 0) return false;
	const tab = layout.tabs[index] as RibbonTab;
	if (!tab.hidden && visibleTabs(layout, caps).length <= 1) return false;
	layout.tabs.splice(index, 1);
	return true;
}

/* ---------- groups ---------- */

export function addGroup(layout: RibbonLayout, tabId: string, name: string, afterGroupId?: string | null): RibbonGroup | null {
	const tab = findTab(layout, tabId);
	if (!tab) return null;
	const group: RibbonGroup = { id: uid("grp"), name: str(name, "New group"), priority: "normal", items: [] };
	const at = tab.groups.findIndex((g) => g.id === afterGroupId);
	tab.groups.splice(at >= 0 ? at + 1 : tab.groups.length, 0, group);
	return group;
}

export function renameGroup(layout: RibbonLayout, groupId: string, name: string): boolean {
	const found = findGroup(layout, groupId);
	if (!found || !str(name, "")) return false;
	found.group.name = name.trim();
	return true;
}

export function moveGroup(layout: RibbonLayout, groupId: string, dir: number): boolean {
	const found = findGroup(layout, groupId);
	return !!found && shift(found.tab.groups, found.index, dir);
}

/**
 * Moves a group to `index` of tab `toTabId` (any tab). `index` counts positions in the
 * target tab as it is before the move; leave it out to append. Used by drag and drop.
 */
export function moveGroupTo(layout: RibbonLayout, groupId: string, toTabId: string, index?: number): boolean {
	const from = findGroup(layout, groupId);
	const to = findTab(layout, toTabId);
	if (!from || !to) return false;
	let at = typeof index === "number" ? Math.max(0, Math.min(index, to.groups.length)) : to.groups.length;
	if (from.tab === to) {
		if (at === from.index || at === from.index + 1) return false;
		if (at > from.index) at -= 1;
	}
	from.tab.groups.splice(from.index, 1);
	to.groups.splice(at, 0, from.group);
	return true;
}

export function removeGroup(layout: RibbonLayout, groupId: string): boolean {
	const found = findGroup(layout, groupId);
	if (!found) return false;
	found.tab.groups.splice(found.index, 1);
	return true;
}

export function setGroupPriority(layout: RibbonLayout, groupId: string, priority: Priority): boolean {
	const found = findGroup(layout, groupId);
	if (!found || !PRIORITIES.includes(priority) || found.group.priority === priority) return false;
	found.group.priority = priority;
	return true;
}

/* ---------- buttons ---------- */

export function addItem(
	layout: RibbonLayout,
	groupId: string,
	command: string,
	opts?: { size?: ItemSize; label?: string; icon?: string; color?: ColorName; index?: number; requires?: FeatureKey; when?: ContextKey },
): RibbonItem | null {
	const found = findGroup(layout, groupId);
	if (!found || !str(command, "")) return null;
	const o = opts ?? {};
	const item: RibbonItem = {
		id: uid("btn"),
		command: command.trim(),
		size: o.size && SIZES.includes(o.size) ? o.size : "small",
	};
	if (o.label && str(o.label, "")) item.label = o.label.trim();
	if (o.icon && str(o.icon, "")) item.icon = o.icon.trim();
	if (o.color && COLORS.includes(o.color)) item.color = o.color;
	if (o.requires) item.requires = o.requires;
	if (o.when) item.when = o.when;
	const at =
		typeof o.index === "number" ? Math.max(0, Math.min(o.index, found.group.items.length)) : found.group.items.length;
	found.group.items.splice(at, 0, item);
	return item;
}

export function removeItem(layout: RibbonLayout, itemId: string): boolean {
	const found = findItem(layout, itemId);
	if (!found) return false;
	found.group.items.splice(found.index, 1);
	return true;
}

/** Moves a button one step left (-1) or right (+1) inside its group. */
export function shiftItem(layout: RibbonLayout, itemId: string, dir: number): boolean {
	const found = findItem(layout, itemId);
	return !!found && shift(found.group.items, found.index, dir);
}

/**
 * Moves a button to `index` of group `toGroupId` (any tab). `index` counts positions in
 * the target group as it is before the move; leave it out to append.
 */
export function moveItem(layout: RibbonLayout, itemId: string, toGroupId: string, index?: number): boolean {
	const from = findItem(layout, itemId);
	const to = findGroup(layout, toGroupId);
	if (!from || !to) return false;
	let at = typeof index === "number" ? Math.max(0, Math.min(index, to.group.items.length)) : to.group.items.length;
	if (from.group === to.group) {
		if (at === from.index || at === from.index + 1) return false;
		if (at > from.index) at -= 1;
	}
	from.group.items.splice(from.index, 1);
	to.group.items.splice(at, 0, from.item);
	return true;
}

export function setItemSize(layout: RibbonLayout, itemId: string, size: ItemSize): boolean {
	const found = findItem(layout, itemId);
	if (!found || !SIZES.includes(size) || found.item.size === size) return false;
	found.item.size = size;
	return true;
}

/** Sets the button's own label. An empty name goes back to the command's name. */
export function renameItem(layout: RibbonLayout, itemId: string, label: string): boolean {
	const found = findItem(layout, itemId);
	if (!found) return false;
	if (str(label, "")) found.item.label = label.trim();
	else delete found.item.label;
	return true;
}

/** Sets the button's own icon. An empty icon goes back to the command's icon. */
export function setItemIcon(layout: RibbonLayout, itemId: string, icon: string): boolean {
	const found = findItem(layout, itemId);
	if (!found) return false;
	if (str(icon, "")) found.item.icon = icon.trim();
	else delete found.item.icon;
	return true;
}

/** Sets the icon's colour (one of COLORS). An empty colour goes back to the default. */
export function setItemColor(layout: RibbonLayout, itemId: string, color: ColorName | ""): boolean {
	const found = findItem(layout, itemId);
	if (!found || (color && !COLORS.includes(color)) || (found.item.color ?? "") === color) return false;
	if (color) found.item.color = color;
	else delete found.item.color;
	return true;
}

/** The colour an icon is drawn in: its own, else accent for large and none for small. */
export function iconColor(item: RibbonItem, large: boolean): ColorName {
	return item.color ?? (large ? "accent" : "none");
}

/* ---------- columns ---------- */

export interface RibbonColumn {
	kind: "large" | "stack";
	items: RibbonItem[];
}

/**
 * Packs a group's buttons into ribbon columns for one size level.
 *   level 0: as chosen by the user - a large button is its own column, runs of small
 *            buttons are stacked (three high, two in the compact ribbon)
 *   level 1: every button small (icon + label), stacked
 *   level 2: every button icon-only, stacked
 * Returns [{ kind: 'large' | 'stack', items: [...] }].
 */
export function packColumns(items: RibbonItem[], level: number, stack = STACK): RibbonColumn[] {
	const cols: RibbonColumn[] = [];
	let run: RibbonColumn | null = null;
	for (const item of items) {
		if (level === 0 && item.size === "large") {
			run = null;
			cols.push({ kind: "large", items: [item] });
			continue;
		}
		if (!run || run.items.length >= stack) {
			run = { kind: "stack", items: [] };
			cols.push(run);
		}
		run.items.push(item);
	}
	return cols;
}

/* ---------- export / import ---------- */

export function exportLayout(layout: RibbonLayout): string {
	return JSON.stringify(
		{ format: EXPORT_FORMAT, version: LAYOUT_VERSION, tabs: normalizeLayout(layout).tabs },
		null,
		2,
	);
}

/** Parses an exported file. Throws an Error with a readable message when it can't be used. */
export function importLayout(text: string): RibbonLayout {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error("This file is not valid JSON.");
	}
	// A whole data.json is accepted too, so a user can restore from a vault backup.
	if (raw && typeof raw === "object" && "layout" in raw) {
		const wrapped = (raw as { layout?: unknown }).layout;
		if (wrapped && typeof wrapped === "object" && Array.isArray((wrapped as { tabs?: unknown }).tabs)) raw = wrapped;
	}
	if (raw && typeof raw === "object" && typeof (raw as { version?: unknown }).version === "number") {
		if ((raw as { version: number }).version > LAYOUT_VERSION) {
			throw new Error("This layout was made by a newer version of the plugin.");
		}
	}
	const layout = normalizeLayout(raw);
	if (!layout.tabs.length) throw new Error("This layout has no tabs.");
	const caps: Capabilities = { features: new Set(), contexts: new Set() };
	if (!visibleTabs(layout, caps).length) {
		const first = layout.tabs[0];
		if (first) first.hidden = false;
	}
	return layout;
}
