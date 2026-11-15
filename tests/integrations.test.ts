import type { App, Command } from "obsidian";
import { describe, expect, it } from "vitest";
import { detect, featureSet } from "../src/integrations";
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
