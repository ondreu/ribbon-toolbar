/*
 * The only file that touches Obsidian internals that are not in the official API
 * (obsidian.d.ts). Everything else in the plugin goes through these functions, so when an
 * Obsidian update changes one of these internals the fix stays in this file. Each function
 * fails soft: it returns null / false / "" instead of throwing.
 *
 * Why each internal is needed:
 *
 *   app.commands.commands / listCommands() / findCommand() / executeCommandById()
 *       The official API can register commands but not list, look up or run one by id.
 *       A ribbon button that can show "any command" needs all four.
 *   app.hotkeyManager.printHotkeyForCommand(id)
 *       Only for showing the shortcut in a button's tooltip. Optional.
 *   app.plugins.manifests / plugins / enabledPlugins, app.internalPlugins.plugins
 *       Capability detection (which optional integration is installed) and the tooltip of a
 *       greyed-out button ("plugin X is turned off").
 *   .app-container > .horizontal-main-container
 *       Obsidian has no official slot for a full-width bar above the workspace, so the
 *       ribbon is inserted before this element. Obsidian's own ribbon is not touched.
 *   menuItem.dom
 *       Only to show a colour dot next to each choice in the "Icon colour" menu. Cosmetic.
 */

import type { App, Command, MenuItem, PluginManifest } from "obsidian";

interface AppInternals extends App {
	commands?: {
		commands?: Record<string, Command>;
		editorCommands?: Record<string, Command>;
		listCommands?: () => Command[];
		findCommand?: (id: string) => Command | null;
		executeCommandById?: (id: string) => boolean;
	};
	hotkeyManager?: { printHotkeyForCommand?: (id: string) => string };
	plugins?: {
		manifests?: Record<string, PluginManifest>;
		plugins?: Record<string, unknown>;
		enabledPlugins?: Set<string>;
	};
	internalPlugins?: {
		plugins?: Record<string, { enabled?: boolean; instance?: { name?: string } }>;
	};
}

/** Command id prefixes of core plugins whose id differs from the prefix. */
const CORE_PREFIX: Record<string, string> = {
	"insert-template": "templates",
	"insert-current-date": "templates",
	"insert-current-time": "templates",
	"outgoing-links": "outgoing-link",
};

/** Prefixes that belong to Obsidian itself, not to a plugin that can be turned off. */
const BUILT_IN = new Set(["editor", "workspace", "app", "theme", "markdown", "window", "mobile", "file-explorer"]);

export function listCommands(app: App): Command[] {
	try {
		const commands = (app as AppInternals).commands;
		if (!commands) return [];
		if (typeof commands.listCommands === "function") return commands.listCommands();
		return Object.values(commands.commands ?? {});
	} catch {
		return [];
	}
}

export function findCommand(app: App, id: string): Command | null {
	try {
		const commands = (app as AppInternals).commands;
		if (!commands) return null;
		if (typeof commands.findCommand === "function") return commands.findCommand(id) ?? null;
		return commands.commands?.[id] ?? commands.editorCommands?.[id] ?? null;
	} catch {
		return null;
	}
}

/** Runs a command. Returns false if it doesn't exist or can't run right now. */
export function executeCommand(app: App, id: string): boolean {
	try {
		const commands = (app as AppInternals).commands;
		if (!commands || !findCommand(app, id)) return false;
		if (typeof commands.executeCommandById !== "function") return false;
		return commands.executeCommandById(id) !== false;
	} catch (error) {
		console.error("Ribbon toolbar: command failed", id, error);
		return false;
	}
}

/** The command's shortcut as text ("Ctrl + B"), or "" if it has none. */
export function hotkeyText(app: App, id: string): string {
	try {
		const manager = (app as AppInternals).hotkeyManager;
		if (!manager || typeof manager.printHotkeyForCommand !== "function") return "";
		return manager.printHotkeyForCommand(id) || "";
	} catch {
		return "";
	}
}

/** Why a command is missing, as a sentence for the tooltip of its greyed-out button. */
export function missingReason(app: App, commandId: string): string {
	const prefix = commandId.includes(":") ? commandId.slice(0, commandId.indexOf(":")) : commandId;
	try {
		if (BUILT_IN.has(prefix)) return "This command is not available in this version of Obsidian.";
		const internals = app as AppInternals;
		const manifest = internals.plugins?.manifests?.[prefix];
		if (manifest) {
			const on = !!internals.plugins?.plugins?.[prefix];
			return on
				? `The plugin "${manifest.name}" doesn't offer this command any more.`
				: `The plugin "${manifest.name}" is turned off. Turn it on in Settings → Community plugins.`;
		}
		const core = internals.internalPlugins?.plugins;
		const corePlugin = core?.[CORE_PREFIX[prefix] ?? prefix];
		if (corePlugin) {
			const name = corePlugin.instance?.name ?? prefix;
			return corePlugin.enabled
				? `The core plugin "${name}" doesn't offer this command any more.`
				: `The core plugin "${name}" is turned off. Turn it on in Settings → Core plugins.`;
		}
	} catch {
		/* fall through to the general message */
	}
	return `Needs the plugin "${prefix}", which is not installed or is turned off.`;
}

/** Colours the icon of a menu item (the dots in the "Icon colour" menu). Cosmetic only. */
export function tintMenuItem(menuItem: MenuItem, colour: string): void {
	try {
		const dom = (menuItem as MenuItem & { dom?: HTMLElement }).dom;
		const icon = dom?.querySelector<HTMLElement>(".menu-item-icon");
		if (icon && colour && colour !== "none") icon.dataset.rtbColor = colour;
	} catch {
		/* the menu simply shows no colour dot */
	}
}

/** Where the ribbon is inserted: { parent, before } or null if Obsidian's layout changed. */
export function mountPoint(doc: Document): { parent: HTMLElement; before: HTMLElement } | null {
	const parent = doc.body.querySelector<HTMLElement>(".app-container");
	const before = parent?.querySelector<HTMLElement>(":scope > .horizontal-main-container");
	return parent && before ? { parent, before } : null;
}

export function isPluginEnabled(app: App, id: string): boolean {
	try {
		const internals = app as AppInternals;
		const plugins = internals.plugins;
		if (!plugins) return false;
		if (plugins.enabledPlugins) return plugins.enabledPlugins.has(id) && !!plugins.plugins?.[id];
		return !!plugins.plugins?.[id];
	} catch {
		return false;
	}
}

/** The value a plugin exposes on its own instance, or undefined. Never throws. */
export function pluginInstance<T>(app: App, id: string): T | undefined {
	try {
		return (app as AppInternals).plugins?.plugins?.[id] as T | undefined;
	} catch {
		return undefined;
	}
}
