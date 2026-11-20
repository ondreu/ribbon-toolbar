import type { App, Command } from "obsidian";
import { describe, expect, it } from "vitest";
import { detect, featureSet, gridCommandFor } from "../src/integrations";
import type { RibbonSettings } from "../src/settings";

const settings: RibbonSettings = {
	height: "compact",
	startCollapsed: false,
	enableHtml: false,
	integrateSpreadsheet: true,
	autoSwitchSpreadsheetTab: true,
};

function appWithCommands(ids: string[]): App {
	const commands: Record<string, Command> = {};
	for (const id of ids) commands[id] = { id, name: id };
	return {
		commands: { commands },
		plugins: { enabledPlugins: new Set<string>(), manifests: {} },
		internalPlugins: { plugins: {} },
	} as unknown as App;
}

describe("Templater detection", () => {
	it("uses the insert-template command as the capability signal", () => {
		const detected = detect(appWithCommands(["templater-obsidian:insert-templater", "insert-template"]));
		expect(detected.templater).toBe(true);
		expect(detected.templates).toBe(true);
		const features = featureSet(appWithCommands(["templater-obsidian:insert-templater"]), settings);
		expect(features.has("templater")).toBe(true);
		expect(features.has("templates")).toBe(false);
	});

	it("does not offer Templater when the plugin is off", () => {
		const features = featureSet(appWithCommands(["insert-template"]), settings);
		expect(features.has("templates")).toBe(true);
		expect(features.has("templater")).toBe(false);
	});
});

describe("Review and table integrations", () => {
	it("enables each action only when its plugin command exists", () => {
		const app = appWithCommands([
			"synonym:show",
			"obsidian-languagetool-plugin:ltcheck-text",
			"table-editor-obsidian:format-table",
			"obsidian-kanban:create-new-kanban-board",
		]);
		const detected = detect(app);
		expect(detected.thesaurus).toBe(true);
		expect(detected.languagetool).toBe(true);
		expect(detected.advancedTables).toBe(true);
		expect(detected.kanban).toBe(true);
		const features = featureSet(app, settings);
		for (const key of ["thesaurus", "languagetool", "advanced-tables", "kanban"] as const) {
			expect(features.has(key)).toBe(true);
		}
	});

	it("hides every action when the plugins are absent", () => {
		const app = appWithCommands([]);
		const features = featureSet(app, settings);
		for (const key of ["thesaurus", "languagetool", "advanced-tables", "kanban"] as const) {
			expect(features.has(key)).toBe(false);
		}
	});
});

describe("Git integration", () => {
	it("uses the commit-and-sync command as the capability signal", () => {
		const app = appWithCommands(["obsidian-git:push", "obsidian-git:pull"]);
		const detected = detect(app);
		expect(detected.git).toBe(true);
		expect(featureSet(app, settings).has("git")).toBe(true);
	});

	it("does not offer Git when the plugin is absent", () => {
		const features = featureSet(appWithCommands([]), settings);
		expect(features.has("git")).toBe(false);
	});
});

describe("Advanced PDF Export integration", () => {
	it("uses the open-panel command as the capability signal", () => {
		const app = appWithCommands(["advanced-pdf-export:open-panel"]);
		const detected = detect(app);
		expect(detected.advancedPdf).toBe(true);
		expect(featureSet(app, settings).has("advanced-pdf")).toBe(true);
	});

	it("does not offer the advanced PDF button when the plugin is absent", () => {
		const features = featureSet(appWithCommands(["workspace:export-pdf"]), settings);
		expect(features.has("advanced-pdf")).toBe(false);
	});
});

describe("spreadsheet formatting routing", () => {
	it("maps the formatting buttons to the grid's own commands", () => {
		expect(gridCommandFor("editor:toggle-bold")).toBe("markdown-spreadsheets:grid-bold");
		expect(gridCommandFor("editor:toggle-italics")).toBe("markdown-spreadsheets:grid-italic");
		expect(gridCommandFor("editor:toggle-strikethrough")).toBe("markdown-spreadsheets:grid-strike");
		expect(gridCommandFor("editor:toggle-code")).toBe("markdown-spreadsheets:grid-code");
		expect(gridCommandFor("ribbon-toolbar:highlight")).toBe("markdown-spreadsheets:grid-highlight");
	});

	it("leaves commands without a grid equivalent alone", () => {
		expect(gridCommandFor("editor:set-heading-1")).toBeNull();
		expect(gridCommandFor("workspace:export-pdf")).toBeNull();
	});
});
