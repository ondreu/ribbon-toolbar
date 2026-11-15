import { describe, expect, it } from "vitest";
import {
	activeTab,
	addGroup,
	addItem,
	addTab,
	commandsIn,
	exportLayout,
	importLayout,
	moveItem,
	moveTab,
	normalizeLayout,
	packColumns,
	removeItem,
	removeTab,
	setTabHidden,
	visibleGroups,
	visibleTabs,
	type Capabilities,
	type RibbonItem,
	type RibbonLayout,
} from "../src/model/layout";

const caps = (features: string[] = [], contexts: string[] = []): Capabilities => ({
	features: new Set(features),
	contexts: new Set(contexts),
});

const item = (command: string, size: "large" | "small" = "small"): RibbonItem => ({ id: command, command, size });

describe("normalizeLayout", () => {
	it("fills in ids, sizes and priorities and drops unknown fields", () => {
		const layout = normalizeLayout({
			tabs: [
				{
					name: "Home",
					groups: [{ name: "Text", items: [{ command: "editor:toggle-bold", size: "huge", colour: "red" }] }],
				},
			],
		});
		expect(layout.version).toBe(1);
		expect(layout.tabs).toHaveLength(1);
		const group = layout.tabs[0]?.groups[0];
		expect(group?.priority).toBe("normal");
		expect(group?.items[0]?.size).toBe("small");
		expect(group?.items[0]?.id).toBeTruthy();
		expect(group?.items[0]).not.toHaveProperty("colour");
	});

	it("keeps requires, context and hidden", () => {
		const layout = normalizeLayout({
			tabs: [{ name: "HTML", hidden: true, requires: "html", context: "spreadsheet", groups: [] }],
		});
		expect(layout.tabs[0]).toMatchObject({ hidden: true, requires: "html", context: "spreadsheet" });
	});

	it("makes ids unique", () => {
		const layout = normalizeLayout({
			tabs: [{ id: "x", name: "A", groups: [] }, { id: "x", name: "B", groups: [] }],
		});
		expect(layout.tabs[0]?.id).not.toBe(layout.tabs[1]?.id);
	});

	it("rejects something that is not a layout", () => {
		expect(() => normalizeLayout({ nope: 1 })).toThrow(/not a ribbon layout/i);
	});
});

describe("visibility", () => {
	const layout = normalizeLayout({
		tabs: [
			{ id: "home", name: "Home", groups: [{ id: "g", name: "G", items: [{ command: "a:b" }] }] },
			{ id: "html", name: "HTML", requires: "html", groups: [{ id: "h", name: "H", items: [{ command: "c:d" }] }] },
			{ id: "sheet", name: "Sheet", context: "spreadsheet", groups: [{ id: "s", name: "S", items: [{ command: "e:f" }] }] },
			{ id: "hidden", name: "Hidden", hidden: true, groups: [] },
		],
	});

	it("hides tabs whose feature or context is missing", () => {
		expect(visibleTabs(layout, caps()).map((t) => t.id)).toEqual(["home"]);
		expect(visibleTabs(layout, caps([], ["spreadsheet"])).map((t) => t.id)).toEqual(["home", "sheet"]);
		expect(visibleTabs(layout, caps(["html"], ["spreadsheet"])).map((t) => t.id)).toEqual(["home", "html", "sheet"]);
	});

	it("falls back to the first visible tab", () => {
		expect(activeTab(layout, "html", caps())?.id).toBe("home");
		expect(activeTab(layout, "html", caps(["html"]))?.id).toBe("html");
	});

	it("drops a group whose items are all hidden", () => {
		const gated = normalizeLayout({
			tabs: [
				{
					id: "t",
					name: "T",
					groups: [{ id: "g", name: "G", items: [{ command: "a:b", requires: "html" }] }],
				},
			],
		});
		expect(visibleGroups(gated.tabs[0]!, caps())).toHaveLength(0);
		expect(visibleGroups(gated.tabs[0]!, caps(["html"]))).toHaveLength(1);
	});
});

describe("editing", () => {
	const base = (): RibbonLayout =>
		normalizeLayout({
			tabs: [{ id: "home", name: "Home", groups: [{ id: "g", name: "G", items: [{ command: "a:b" }] }] }],
		});

	it("adds tabs and groups", () => {
		const layout = base();
		const tab = addTab(layout, "Data", "home");
		expect(layout.tabs.map((t) => t.id)).toEqual(["home", tab.id]);
		const group = addGroup(layout, tab.id, "Group");
		expect(group).not.toBeNull();
		expect(layout.tabs[1]?.groups).toHaveLength(1);
	});

	it("adds an item into a group", () => {
		const layout = base();
		const added = addItem(layout, "g", "editor:toggle-bold", { size: "large" });
		expect(added?.size).toBe("large");
		expect(commandsIn(layout)).toEqual(["a:b", "editor:toggle-bold"]);
	});

	it("moves items between groups and refuses no-op moves", () => {
		const layout = base();
		const group = addGroup(layout, "home", "Second");
		const added = addItem(layout, "g", "c:d");
		expect(moveItem(layout, added!.id, group!.id)).toBe(true);
		expect(layout.tabs[0]?.groups[1]?.items).toHaveLength(1);
		expect(moveItem(layout, added!.id, group!.id)).toBe(false);
	});

	it("removes items and tabs but keeps one visible tab", () => {
		const layout = base();
		const item = layout.tabs[0]!.groups[0]!.items[0]!;
		expect(removeItem(layout, item.id)).toBe(true);
		expect(removeTab(layout, "home", caps())).toBe(false);
		expect(setTabHidden(layout, "home", true, caps())).toBe(false);
	});

	it("moves tabs among visible tabs", () => {
		const layout = base();
		const second = addTab(layout, "Second");
		addTab(layout, "Third");
		expect(moveTab(layout, second.id, 1)).toBe(true);
		expect(layout.tabs.map((t) => t.name)).toEqual(["Home", "Third", "Second"]);
	});
});

describe("packColumns", () => {
	it("stacks small buttons three high and gives large buttons their own column", () => {
		const items = [item("a", "small"), item("b", "small"), item("c", "small"), item("d", "small"), item("e", "large")];
		const cols = packColumns(items, 0);
		expect(cols.map((c) => c.kind)).toEqual(["stack", "stack", "large"]);
		expect(cols[0]?.items).toHaveLength(3);
		expect(cols[1]?.items).toHaveLength(1);
	});

	it("uses two rows in the compact ribbon", () => {
		const items = [item("a"), item("b"), item("c")];
		const cols = packColumns(items, 0, 2);
		expect(cols.map((c) => c.items.length)).toEqual([2, 1]);
	});

	it("makes every button small at level 1 and icon-only at level 2", () => {
		const items = [item("a", "large"), item("b", "small")];
		expect(packColumns(items, 1).every((c) => c.kind === "stack")).toBe(true);
		expect(packColumns(items, 2).every((c) => c.kind === "stack")).toBe(true);
	});
});

describe("export and import", () => {
	const layout = (): RibbonLayout =>
		normalizeLayout({
			tabs: [
				{
					id: "home",
					name: "Home",
					requires: "html",
					groups: [{ id: "g", name: "G", items: [{ command: "a:b", label: "A", icon: "star", color: "red" }] }],
				},
			],
		});

	it("round-trips through JSON", () => {
		const text = exportLayout(layout());
		const back = importLayout(text);
		expect(back.tabs[0]?.requires).toBe("html");
		expect(back.tabs[0]?.groups[0]?.items[0]).toMatchObject({ command: "a:b", label: "A", icon: "star", color: "red" });
	});

	it("accepts a whole data.json", () => {
		const text = JSON.stringify({ settings: {}, layout: JSON.parse(exportLayout(layout())) as unknown });
		expect(importLayout(text).tabs).toHaveLength(1);
	});

	it("rejects a newer layout and broken JSON", () => {
		expect(() => importLayout("{")).toThrow(/valid JSON/i);
		expect(() => importLayout(JSON.stringify({ version: 99, tabs: [] }))).toThrow(/newer version/i);
	});

	it("unhides the first tab when everything is hidden", () => {
		const text = JSON.stringify({ tabs: [{ name: "Only", hidden: true, groups: [] }] });
		expect(importLayout(text).tabs[0]?.hidden).toBe(false);
	});
});
