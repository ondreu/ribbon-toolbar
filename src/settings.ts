/*
 * Settings and the settings pane.
 *
 * Small on purpose: the ribbon itself is customised in place (right-click / drag and drop),
 * so the pane only holds the decisions that apply to the whole ribbon — its height, whether
 * it starts collapsed, the opt-in HTML formatting, and whether Markdown Spreadsheets should
 * hand its toolbar over.
 */

import { PluginSettingTab, Setting, type App } from "obsidian";
import { detect, type Detected } from "./integrations";
import type RibbonToolbarPlugin from "./main";
export interface RibbonSettings {
	/** Full is three rows of small buttons; compact is two and one third shorter. */
	height: "full" | "compact";
	/** The ribbon starts rolled up to its tab row on every launch. */
	startCollapsed: boolean;
	/** Underline, font colour and coloured highlight. Off by default: they are inline HTML. */
	enableHtml: boolean;
	/** Markdown Spreadsheets hides its own toolbar and shows its commands in the Spreadsheet tab. */
	integrateSpreadsheet: boolean;
	/** Opening a spreadsheet switches the ribbon to its tab. */
	autoSwitchSpreadsheetTab: boolean;
}

export const DEFAULT_SETTINGS: RibbonSettings = {
	height: "compact",
	startCollapsed: false,
	enableHtml: false,
	integrateSpreadsheet: true,
	autoSwitchSpreadsheetTab: true,
};

const DETECT_LABEL: Array<[keyof Detected, string]> = [
	["tasks", "Tasks"],
	["spreadsheet", "Markdown Spreadsheets"],
	["excalidraw", "Excalidraw"],
	["bases", "Bases"],
	["templates", "Templates"],
	["templater", "Templater"],
];

export class RibbonSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: RibbonToolbarPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName("Appearance").setHeading();

		new Setting(containerEl)
			.setName("Ribbon height")
			.setDesc("Compact keeps two rows of buttons and is about a third shorter than the full ribbon.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("compact", "Compact — two rows")
					.addOption("full", "Full — three rows")
					.setValue(this.plugin.settings.height)
					.onChange(async (value) => {
						this.plugin.settings.height = value === "full" ? "full" : "compact";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Start collapsed")
			.setDesc("Show only the tab row when Obsidian starts. Click a tab to unfold the ribbon.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.startCollapsed).onChange(async (value) => {
					this.plugin.settings.startCollapsed = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Formatting").setHeading();

		new Setting(containerEl)
			.setName("HTML formatting")
			.setDesc(
				"Adds underline, font colour and a coloured highlight, which are inline HTML rather than Markdown. " +
					"Off by default, and the HTML tab stays hidden until it is on. Subscript and superscript are always available.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableHtml).onChange(async (value) => {
					this.plugin.settings.enableHtml = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Integrations").setHeading();

		const detected = detect(this.app);
		new Setting(containerEl)
			.setName("Markdown spreadsheets")
			.setDesc(
				detected.spreadsheet
					? "Hide that plugin's own toolbar and put its actions in the Spreadsheet tab of this ribbon."
					: "Markdown Spreadsheets is not installed or is turned off.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.integrateSpreadsheet)
					.setDisabled(!detected.spreadsheet)
					.onChange(async (value) => {
						this.plugin.settings.integrateSpreadsheet = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Open the spreadsheet tab automatically")
			.setDesc("Switch to the spreadsheet tab when a spreadsheet becomes the active view.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSwitchSpreadsheetTab)
					.setDisabled(!detected.spreadsheet || !this.plugin.settings.integrateSpreadsheet)
					.onChange(async (value) => {
						this.plugin.settings.autoSwitchSpreadsheetTab = value;
						await this.plugin.saveSettings();
					}),
			);

		const list = containerEl.createDiv("rtb-detect");
		list.createDiv({ cls: "rtb-detect-title", text: "Plugins found" });
		for (const [key, label] of DETECT_LABEL) {
			const row = list.createDiv("rtb-detect-row");
			row.createSpan({ cls: `rtb-detect-dot${detected[key] ? " is-on" : ""}` });
			row.createSpan({ text: label });
			row.createSpan({ cls: "rtb-detect-state", text: detected[key] ? "available" : "not found" });
		}

		new Setting(containerEl).setName("Customise").setHeading();
		new Setting(containerEl)
			.setName("Tabs, groups and buttons")
			.setDesc("Right-click the ribbon to add, rename, move or remove anything. Drag and drop works in customise mode.")
			.addButton((button) =>
				button.setButtonText("Customise the ribbon").onClick(() => {
					this.plugin.startCustomising();
				}),
			)
			.addButton((button) =>
				button.setButtonText("Reset to default").onClick(async () => {
					await this.plugin.resetLayout();
				}),
			);
	}
}
