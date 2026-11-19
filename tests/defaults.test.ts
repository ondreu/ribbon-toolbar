/*
 * Guards on the built-in layout, not on user edits.
 *
 * These are the two failure modes a ribbon made of command ids has:
 *   - the same function appears twice, so the bar feels crowded and arbitrary;
 *   - a command id is wrong or was removed, so the button is dead on arrival.
 * Both are cheap to check here and expensive to notice in a vault.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultLayout, DEFAULTS_VERSION, LEGACY_DEFAULT_HASH } from "../src/model/defaults";
import { layoutHash, type RibbonItem } from "../src/model/layout";

interface Fixture {
	generatedFrom: string;
	ids: string[];
}

const fixture = JSON.parse(readFileSync(new URL("./fixtures/obsidian-commands.json", import.meta.url), "utf8")) as Fixture;
const CORE_COMMANDS = new Set(fixture.ids);

/** Prefixes owned by community plugins; their ids are checked against the plugin, not Obsidian. */
const COMMUNITY_PREFIXES = [
	"markdown-spreadsheets:",
	"obsidian-tasks-plugin:",
	"obsidian-excalidraw-plugin:",
	"templater-obsidian:",
	"synonym:",
	"obsidian-languagetool-plugin:",
	"table-editor-obsidian:",
	"obsidian-kanban:",
	"obsidian-git:",
	"advanced-pdf-export:",
];

const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const OWN_COMMANDS = new Set<string>();
for (const match of mainSource.matchAll(/id:\s*"([^"]+)"/g)) OWN_COMMANDS.add(`ribbon-toolbar:${match[1]}`);
for (const match of mainSource.matchAll(/addFormatCommand\("([^"]+)"/g)) OWN_COMMANDS.add(`ribbon-toolbar:${match[1]}`);

function items(): RibbonItem[] {
	return defaultLayout().tabs.flatMap((tab) => tab.groups.flatMap((group) => group.items));
}

describe("default layout", () => {
	it("never puts the same command on the ribbon twice", () => {
		const seen = new Map<string, string[]>();
		for (const tab of defaultLayout().tabs) {
			for (const group of tab.groups) {
				for (const item of group.items) {
					const where = `${tab.name} > ${group.name}`;
					seen.set(item.command, [...(seen.get(item.command) ?? []), where]);
				}
			}
		}
		const duplicates = [...seen.entries()].filter(([, places]) => places.length > 1);
		expect(duplicates).toEqual([]);
	});

	it("uses unique tab and group ids", () => {
		const layout = defaultLayout();
		const tabIds = layout.tabs.map((tab) => tab.id);
		expect(new Set(tabIds).size).toBe(tabIds.length);
		const groupIds = layout.tabs.flatMap((tab) => tab.groups.map((group) => group.id));
		expect(new Set(groupIds).size).toBe(groupIds.length);
	});

	it("gives every button a label and every group at least one button", () => {
		for (const tab of defaultLayout().tabs) {
			expect(tab.groups.length).toBeGreaterThan(0);
			for (const group of tab.groups) {
				expect(group.items.length, `${tab.name} > ${group.name}`).toBeGreaterThan(0);
				for (const item of group.items) expect(item.label, item.command).toBeTruthy();
			}
		}
	});

	it("only points at core commands Obsidian actually registers", () => {
		expect(fixture.ids.length).toBeGreaterThan(150);
		const unknown = items()
			.map((item) => item.command)
			.filter((command) => !command.startsWith("ribbon-toolbar:"))
			.filter((command) => !COMMUNITY_PREFIXES.some((prefix) => command.startsWith(prefix)))
			.filter((command) => !CORE_COMMANDS.has(command));
		expect(unknown).toEqual([]);
	});

	it("only points at plugin commands this plugin registers", () => {
		const unknown = items()
			.map((item) => item.command)
			.filter((command) => command.startsWith("ribbon-toolbar:"))
			.filter((command) => !OWN_COMMANDS.has(command));
		expect(unknown).toEqual([]);
	});

	it("is a newer generation than the layout it can upgrade from", () => {
		const layout = defaultLayout();
		expect(layout.defaultsVersion).toBe(DEFAULTS_VERSION);
		expect(DEFAULTS_VERSION).toBeGreaterThan(1);
		// If these ever match, the in-place upgrade would replace the current layout with itself.
		expect(layoutHash(layout)).not.toBe(LEGACY_DEFAULT_HASH);
	});
});
