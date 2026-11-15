// Dev-only harness: mounts the real RibbonView with the real stylesheet in a plain browser.
import { setIcon, type App, type Command } from "obsidian";
import { RibbonView } from "../../src/view/RibbonView";
import { defaultLayout } from "../../src/model/defaults";
import type { Capabilities, RibbonItem } from "../../src/model/layout";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
document.body.className = `theme-${theme}`;

const layout = defaultLayout();
const commands = new Map<string, Command>();
const iconOf = new Map<string, string>();
for (const tab of layout.tabs) {
	for (const group of tab.groups) {
		for (const item of group.items as RibbonItem[]) {
			commands.set(item.command, {
				id: item.command,
				name: (item.label ?? item.command.split(":")[1] ?? item.command).replace(/-/g, " "),
				icon: item.icon,
			});
			if (item.icon) iconOf.set(item.command, item.icon);
		}
	}
}

const app = {
	commands: {
		listCommands: () => [...commands.values()],
		findCommand: (id: string) => commands.get(id) ?? null,
		executeCommandById: () => true,
	},
	hotkeyManager: { printHotkeyForCommand: () => "" },
	plugins: { manifests: {}, plugins: {}, enabledPlugins: new Set<string>() },
	internalPlugins: { plugins: {} },
	keymap: { pushScope: () => {}, popScope: () => {} },
	scope: {},
	workspace: {},
} as unknown as App;

const features = new Set<string>([
	"html",
	"tasks",
	"spreadsheet",
	"excalidraw",
	"bases",
	"templates",
	"templater",
	"thesaurus",
	"languagetool",
	"advanced-tables",
	"kanban",
]);
if (params.get("html") === "0") features.delete("html");

const host = {
	app,
	layout,
	state: {
		ribbonTab: params.get("tab") ?? "home",
		ribbonCollapsed: params.get("collapsed") === "1",
	},
	settings: { height: params.get("height") === "full" ? ("full" as const) : ("compact" as const) },
	caps: (): Capabilities => ({ features, contexts: new Set(["spreadsheet"]) }),
	rows: (): number => (host.settings.height === "compact" ? 2 : 3),
	canShow: (): boolean => true,
	runCommand: (id: string): void => {
		(window as unknown as Record<string, unknown>).lastCommand = id;
	},
	saveLayout: (): void => {},
	saveState: (): void => {},
	promptText: async (): Promise<string | null> => null,
	confirm: async (): Promise<boolean> => false,
	exportLayoutFile: (): void => {},
	importLayoutFile: (): void => {},
	resetLayout: (): void => {},
	toggleRibbon: (): void => {
		host.state.ribbonCollapsed = !host.state.ribbonCollapsed;
		view.render();
	},
};

const appContainer = document.getElementById("app");
if (!appContainer) throw new Error("No #app container");
const root = (appContainer.createDiv as (o?: unknown) => HTMLElement)("rtb");
// Same place the plugin uses: before the workspace, not after it.
appContainer.insertBefore(root, appContainer.firstChild);
const tabrow = (root.createDiv as (o?: unknown) => HTMLElement)("rtb-tabrow");
const quick = (tabrow.createDiv as (o?: unknown) => HTMLElement)("rtb-qat");
for (const [icon, label] of [
	["undo", "Undo"],
	["redo", "Redo"],
] as const) {
	const button = (quick.createEl as (tag: string, o?: unknown) => HTMLElement)("button", {
		cls: "rtb-tool",
		attr: { type: "button", "aria-label": label, "data-tooltip-position": "bottom" },
	});
	setIcon(button, icon);
}
const tabsEl = (tabrow.createDiv as (o?: unknown) => HTMLElement)({ cls: "rtb-tabs", attr: { role: "tablist" } });
(tabrow.createDiv as (o?: unknown) => HTMLElement)("rtb-tabrow-spacer");
const end = (tabrow.createDiv as (o?: unknown) => HTMLElement)("rtb-tabrow-end");
const toggle = (end.createEl as (tag: string, o?: unknown) => HTMLElement)("button", {
	cls: "rtb-toggle",
	attr: { type: "button", "data-tooltip-position": "bottom" },
});
const body = root.createDiv({ cls: "rtb-ribbon", attr: { id: "rtb-ribbon-panel", role: "tabpanel" } });

const view = new RibbonView(host);
view.mount(root, tabsEl, body, toggle);
if (params.get("editing") === "1") view.setEditing(true);

const w = window as unknown as Record<string, unknown>;
w.view = view;
w.setHeight = (height: "full" | "compact"): void => {
	host.settings.height = height;
	view.remeasure();
};
w.setCollapsed = (collapsed: boolean): void => {
	host.state.ribbonCollapsed = collapsed;
	view.render();
};
w.setTab = (id: string): void => {
	host.state.ribbonTab = id;
	view.render();
};
w.setEditing = (on: boolean): void => view.setEditing(on);
w.ready = true;
