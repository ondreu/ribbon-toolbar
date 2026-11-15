/*
 * Optional integrations: which features the host can offer right now, and the contract by
 * which another plugin can ask to have its toolbar hosted here.
 *
 * The contract is deliberately tiny and versioned. Markdown Spreadsheets checks for a plugin
 * instance exposing `ribbonHostApi` with `version === 1` and `acceptsIntegration(id) === true`;
 * when it says yes, that plugin hides its own toolbar and this ribbon shows its commands.
 * Nothing here imports the other plugin, so either side can be installed alone.
 */

import type { App } from "obsidian";
import { findCommand, isPluginEnabled, pluginInstance } from "./internal";
import type { FeatureKey } from "./model/layout";
import type { RibbonSettings } from "./settings";

export const MDS_PLUGIN_ID = "markdown-spreadsheets";
export const MDS_VIEW_TYPE = "markdown-spreadsheet-view";
export const HOST_API_VERSION = 1;

/** What a plugin offers to other plugins. */
export interface RibbonHostApi {
	version: number;
	acceptsIntegration(id: string): boolean;
}

/** What Markdown Spreadsheets offers back, if it wants to be asked for a refresh. */
export interface SpreadsheetHost {
	refreshRibbonHost?: () => void;
}

/** Which optional plugins and core features are available. Print this in the settings tab. */
export interface Detected {
	tasks: boolean;
	spreadsheet: boolean;
	excalidraw: boolean;
	bases: boolean;
	templates: boolean;
}

export function detect(app: App): Detected {
	return {
		tasks: isPluginEnabled(app, "obsidian-tasks-plugin"),
		spreadsheet: isPluginEnabled(app, MDS_PLUGIN_ID),
		excalidraw: isPluginEnabled(app, "obsidian-excalidraw-plugin"),
		bases: !!findCommand(app, "bases:new-file"),
		templates: !!findCommand(app, "insert-template"),
	};
}

/** The features the ribbon may show at all, given the settings and what is installed. */
export function featureSet(app: App, settings: RibbonSettings, detected = detect(app)): Set<FeatureKey> {
	const features = new Set<FeatureKey>();
	if (settings.enableHtml) features.add("html");
	if (detected.tasks) features.add("tasks");
	if (detected.spreadsheet && settings.integrateSpreadsheet) features.add("spreadsheet");
	if (detected.excalidraw) features.add("excalidraw");
	if (detected.bases) features.add("bases");
	if (detected.templates) features.add("templates");
	return features;
}

/** True while a Markdown Spreadsheets grid is the active view. */
export function spreadsheetActive(app: App): boolean {
	try {
		// Markdown Spreadsheets knows its own view class, so it answers the question. Doing it
		// here would need either importing that class (no: either plugin must work alone) or
		// `workspace.activeLeaf` (deprecated, and the lint rules forbid silencing that).
		const mds = pluginInstance<{ isGridActive?: () => boolean }>(app, MDS_PLUGIN_ID);
		return mds?.isGridActive?.() === true;
	} catch {
		return false;
	}
}

/** Ask Markdown Spreadsheets to re-check whether its own toolbar should be visible. */
export function refreshSpreadsheetHost(app: App): void {
	pluginInstance<SpreadsheetHost>(app, MDS_PLUGIN_ID)?.refreshRibbonHost?.();
}
