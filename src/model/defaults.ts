/*
 * The default ribbon layout. Pure data, editable by the user afterwards.
 *
 * Every button is just a command id. Buttons whose plugin is not installed show greyed
 * out, so the layout can safely name commands of optional plugins. A tab or group that only
 * makes sense with an optional plugin carries `requires`, so it is hidden rather than shown
 * full of dead buttons.
 *
 *   own:        this plugin's commands (ribbon-toolbar:*)
 *   core:       Obsidian and its core plugins
 *   community:  Tasks, Markdown Spreadsheets, Excalidraw
 */

import { normalizeLayout, type ColorName, type FeatureKey, type RibbonGroup, type RibbonItem, type RibbonLayout, type RibbonTab } from "./layout";

const O = "ribbon-toolbar:";
const M = "markdown-spreadsheets:";
const T = "obsidian-tasks-plugin:";
const X = "obsidian-excalidraw-plugin:";

type Extra = { requires?: FeatureKey; when?: "spreadsheet" };

const L = (command: string, label: string, icon: string, color?: ColorName, extra?: Extra): RibbonItem => ({
	id: "",
	command,
	label,
	icon,
	size: "large",
	...(color ? { color } : {}),
	...extra,
});

const S = (command: string, label: string, icon: string, color?: ColorName, extra?: Extra): RibbonItem => ({
	id: "",
	command,
	label,
	icon,
	size: "small",
	...(color ? { color } : {}),
	...extra,
});

const G = (id: string, name: string, items: RibbonItem[], priority: RibbonGroup["priority"] = "normal", requires?: FeatureKey): RibbonGroup => ({
	id,
	name,
	priority,
	...(requires ? { requires } : {}),
	items,
});

const TAB = (id: string, name: string, groups: RibbonGroup[], extra?: { requires?: FeatureKey; context?: "spreadsheet" }): RibbonTab => ({
	id,
	name,
	hidden: false,
	...(extra?.requires ? { requires: extra.requires } : {}),
	...(extra?.context ? { context: extra.context } : {}),
	groups,
});

/** The spreadsheet buttons all act on the open grid, so they disable rather than hide. */
const onGrid: Extra = { when: "spreadsheet" };
const withSpreadsheets: Extra = { requires: "spreadsheet" };

const TABS: RibbonTab[] = [
	TAB("home", "Home", [
		G(
			"home-clipboard",
			"Clipboard",
			[
				L(O + "paste", "Paste", "clipboard-paste"),
				S(O + "cut", "Cut", "scissors"),
				S(O + "copy", "Copy", "copy"),
				S("editor:clear-formatting", "Clear", "eraser", "pink"),
			],
			"last",
		),
		G("home-text", "Text", [
			S("editor:toggle-bold", "Bold", "bold"),
			S("editor:toggle-italics", "Italic", "italic"),
			S("editor:toggle-strikethrough", "Strike", "strikethrough"),
			S(O + "highlight", "Highlight", "highlighter", "yellow"),
			S("editor:toggle-code", "Code", "code"),
			S(O + "subscript", "Subscript", "subscript"),
			S(O + "superscript", "Superscript", "superscript"),
		]),
		G("home-paragraph", "Paragraph", [
			S("editor:toggle-bullet-list", "Bullets", "list"),
			S("editor:toggle-numbered-list", "Numbering", "list-ordered"),
			S("editor:toggle-checklist-status", "Checkbox", "list-checks"),
			S("editor:unindent-list", "Outdent", "outdent"),
			S("editor:indent-list", "Indent", "indent"),
			S("editor:toggle-blockquote", "Quote", "quote"),
		]),
		G("home-styles", "Styles", [
			S(O + "style-h1", "Heading 1", "heading-1", "blue"),
			S(O + "style-h2", "Heading 2", "heading-2", "blue"),
			S(O + "style-h3", "Heading 3", "heading-3", "blue"),
			S(O + "style-h4", "Heading 4", "heading-4", "blue"),
			S(O + "style-normal", "Normal", "pilcrow"),
		]),
		G(
			"home-notes",
			"Notes",
			[
				L("file-explorer:new-file", "New note", "file-plus"),
				S("canvas:new-file", "New canvas", "layout-dashboard"),
				S("insert-template", "Template", "layout-template"),
				S("bases:new-file", "New base", "layout-list", undefined, { requires: "bases" }),
			],
			"last",
		),
		G(
			"home-editing",
			"Editing",
			[
				S("editor:open-search", "Find", "search"),
				S("editor:open-search-replace", "Replace", "replace"),
				S("editor:toggle-spellcheck", "Spelling", "spell-check"),
			],
			"first",
		),
	]),

	TAB("insert", "Insert", [
		G("insert-files", "Files", [
			L("editor:attach-file", "Attachment", "paperclip"),
			S("editor:insert-embed", "Embed note", "file-input"),
			S("insert-template", "Template", "layout-template"),
			S(X + "excalidraw-autocreate-and-embed", "Embed drawing", "image-plus", undefined, { requires: "excalidraw" }),
		]),
		G("insert-links", "Links", [
			S("editor:insert-link", "Link", "link"),
			S("editor:insert-wikilink", "Note link", "file-symlink"),
			S("editor:insert-tag", "Tag", "tag", "cyan"),
			S("editor:insert-footnote", "Footnote", "file-signature"),
		]),
		G("insert-blocks", "Blocks", [
			L("editor:insert-callout", "Callout", "message-square", "cyan"),
			S("editor:insert-codeblock", "Code block", "code-2"),
			S("editor:insert-horizontal-rule", "Divider", "minus"),
			S("editor:toggle-blockquote", "Quote", "quote"),
			S("editor:insert-mathblock", "Equation", "sigma", "purple"),
			S("editor:toggle-inline-math", "Inline math", "square-function"),
		]),
		G("insert-pages", "Pages", [
			L("canvas:new-file", "New canvas", "layout-dashboard"),
			S("bases:insert", "Insert base", "between-horizontal-start", undefined, { requires: "bases" }),
			S("bases:new-file", "New base", "layout-list", undefined, { requires: "bases" }),
			S("file-explorer:new-file", "New note", "file-plus"),
		]),
		G("insert-symbols", "Symbols", [L(O + "insert-symbol", "Symbol", "omega")], "last"),
	]),

	TAB("table", "Table", [
		G("table-insert", "Table", [
			L(O + "insert-table", "Insert table", "table"),
			S("editor:insert-table", "Quick table", "table-2"),
		]),
		G("table-rows", "Rows", [
			S("editor:table-row-before", "Add above", "arrow-up-to-line", "green"),
			S("editor:table-row-after", "Add below", "arrow-down-to-line", "green"),
			S("editor:table-row-delete", "Delete row", "trash-2", "red"),
			S("editor:table-row-up", "Move up", "arrow-up"),
			S("editor:table-row-down", "Move down", "arrow-down"),
			S("editor:table-row-copy", "Duplicate", "copy"),
		]),
		G("table-columns", "Columns", [
			S("editor:table-col-before", "Add left", "arrow-left-to-line", "green"),
			S("editor:table-col-after", "Add right", "arrow-right-to-line", "green"),
			S("editor:table-col-delete", "Delete column", "trash-2", "red"),
			S("editor:table-col-left", "Move left", "arrow-left"),
			S("editor:table-col-right", "Move right", "arrow-right"),
			S("editor:table-col-copy", "Duplicate", "copy"),
		]),
		G("table-align", "Alignment", [
			S("editor:table-col-align-left", "Left", "align-left"),
			S("editor:table-col-align-center", "Center", "align-center"),
			S("editor:table-col-align-right", "Right", "align-right"),
		]),
		G(
			"table-spreadsheet",
			"Spreadsheet",
			[
				L(M + "open-table-in-grid", "Open in grid", "table-properties", undefined, withSpreadsheets),
				S(M + "insert-table", "New spreadsheet", "table-2", undefined, withSpreadsheets),
				S(M + "reformat-all-tables", "Reformat tables", "align-justify", undefined, withSpreadsheets),
			],
			"first",
		),
	]),

	TAB(
		"spreadsheet",
		"Spreadsheet",
		[
			G("ss-table", "Table", [
				L(M + "open-table-in-grid", "Open in grid", "table-properties", undefined, onGrid),
				S(M + "grid-reload", "Reload", "refresh-cw", undefined, onGrid),
				S(M + "grid-open-note", "Open note", "file-text", undefined, onGrid),
				S(M + "grid-reformat", "Reformat", "align-justify", undefined, onGrid),
			]),
			G("ss-rows", "Rows", [
				S(M + "grid-row-above", "Above", "arrow-up-to-line", "green", onGrid),
				S(M + "grid-row-below", "Below", "arrow-down-to-line", "green", onGrid),
				S(M + "grid-row-duplicate", "Duplicate", "copy", undefined, onGrid),
				S(M + "grid-row-delete", "Delete", "trash-2", "red", onGrid),
				S(M + "grid-row-up", "Move up", "arrow-up", undefined, onGrid),
				S(M + "grid-row-down", "Move down", "arrow-down", undefined, onGrid),
			]),
			G("ss-columns", "Columns", [
				S(M + "grid-col-left", "Left", "arrow-left-to-line", "green", onGrid),
				S(M + "grid-col-right", "Right", "arrow-right-to-line", "green", onGrid),
				S(M + "grid-col-duplicate", "Duplicate", "copy", undefined, onGrid),
				S(M + "grid-col-delete", "Delete", "trash-2", "red", onGrid),
				S(M + "grid-col-left-move", "Move left", "arrow-left", undefined, onGrid),
				S(M + "grid-col-right-move", "Move right", "arrow-right", undefined, onGrid),
			]),
			G("ss-format", "Format", [
				S(M + "grid-bold", "Bold", "bold", undefined, onGrid),
				S(M + "grid-italic", "Italic", "italic", undefined, onGrid),
				S(M + "grid-strike", "Strike", "strikethrough", undefined, onGrid),
				S(M + "grid-code", "Code", "code", undefined, onGrid),
				S(M + "grid-wrap", "Wrap", "wrap-text", undefined, onGrid),
				S(M + "grid-render", "Rendered", "eye", undefined, onGrid),
				S(M + "grid-align-left", "Left", "align-left", undefined, onGrid),
				S(M + "grid-align-center", "Center", "align-center", undefined, onGrid),
				S(M + "grid-align-right", "Right", "align-right", undefined, onGrid),
			]),
			G("ss-data", "Data", [
				S(M + "grid-sort-asc", "Sort A→Z", "arrow-down-a-z", undefined, onGrid),
				S(M + "grid-sort-desc", "Sort Z→A", "arrow-up-a-z", undefined, onGrid),
				S(M + "grid-sort-multi", "Sort…", "arrow-up-down", undefined, onGrid),
				S(M + "grid-filter", "Filter", "filter", undefined, onGrid),
				S(M + "grid-filter-clear", "Clear filters", "filter-x", "red", onGrid),
				S(M + "grid-find", "Find", "search", undefined, onGrid),
				S(M + "grid-remove-duplicates", "Remove duplicates", "copy-x", undefined, onGrid),
				S(M + "grid-text-to-columns", "Split column", "split", undefined, onGrid),
				S(M + "grid-merge-columns", "Merge columns", "merge", undefined, onGrid),
				S(M + "grid-change-text", "Change case", "case-sensitive", undefined, onGrid),
				S(M + "grid-pivot", "Pivot", "pivot", undefined, onGrid),
			]),
			G("ss-calculate", "Calculate", [
				L(M + "grid-calc", "Calculate", "calculator", undefined, onGrid),
				S(M + "grid-calc-again", "Again", "refresh-cw", undefined, onGrid),
				S(M + "grid-totals-row", "Totals row", "sigma", undefined, onGrid),
				S(M + "grid-compute-column", "Compute column", "function-square", undefined, onGrid),
				S(M + "grid-number-format", "Numbers", "hash", undefined, onGrid),
				S(M + "grid-column-stats", "Statistics", "chart-column", undefined, onGrid),
			]),
			G("ss-layout", "Layout", [
				S(M + "grid-autofit-all", "Autofit", "move-horizontal", undefined, onGrid),
				S(M + "grid-freeze-header", "Freeze header", "pin", undefined, onGrid),
				S(M + "grid-freeze-col", "Freeze column", "pin", undefined, onGrid),
				S(M + "grid-freeze-panes", "Freeze panes", "grid-2x2", undefined, onGrid),
				S(M + "grid-freeze-none", "Unfreeze", "pin-off", undefined, onGrid),
				S(M + "grid-hide-cols", "Hide columns", "eye-off", undefined, onGrid),
				S(M + "grid-show-cols", "Show columns", "eye", undefined, onGrid),
			]),
			G(
				"ss-zoom",
				"Zoom",
				[
					S(M + "grid-zoom-in", "Zoom in", "zoom-in", undefined, onGrid),
					S(M + "grid-zoom-out", "Zoom out", "zoom-out", undefined, onGrid),
					S(M + "grid-zoom-reset", "100%", "scan", undefined, onGrid),
				],
				"last",
			),
			G(
				"ss-export",
				"Export",
				[
					L(M + "grid-xlsx", "Excel", "file-spreadsheet", undefined, onGrid),
					S(M + "grid-csv", "CSV", "file-down", undefined, onGrid),
					S(M + "grid-json", "JSON", "file-json", undefined, onGrid),
					S(M + "grid-copy-md", "Copy table", "copy", undefined, onGrid),
					S(M + "grid-copy-html", "Copy formatted", "clipboard-copy", undefined, onGrid),
				],
				"last",
			),
			G(
				"ss-import",
				"Import",
				[
					S(M + "grid-import", "Import file", "upload", undefined, onGrid),
					S(M + "grid-merge-file", "Merge file", "git-merge", undefined, onGrid),
					S(M + "grid-paste-special", "Paste special", "clipboard-paste", undefined, onGrid),
				],
				"first",
			),
		],
		{ requires: "spreadsheet", context: "spreadsheet" },
	),

	TAB("draw", "Draw", [
		G(
			"draw-excalidraw",
			"Excalidraw",
			[
				L(X + "excalidraw-autocreate", "New drawing", "pencil-ruler", undefined, { requires: "excalidraw" }),
				S(X + "excalidraw-autocreate-and-embed", "Embed drawing", "image-plus", undefined, { requires: "excalidraw" }),
				S(X + "excalidraw-open", "Open drawing", "folder-open", undefined, { requires: "excalidraw" }),
				S(X + "toggle-excalidraw-view", "Drawing / text", "repeat", undefined, { requires: "excalidraw" }),
			],
			"normal",
			"excalidraw",
		),
		G("draw-canvas", "Canvas", [
			L("canvas:new-file", "New canvas", "layout-dashboard"),
			S("canvas:jump-to-group", "Jump to group", "move"),
			S("canvas:convert-to-file", "Convert to note", "file-input"),
			S("canvas:export-as-image", "Export image", "image"),
		]),
	]),

	TAB(
		"tasks",
		"Tasks",
		[
			G(
				"tasks-plugin",
				"Tasks",
				[
					L(T + "edit-task", "Create / edit", "pencil"),
					S(T + "toggle-done", "Toggle done", "check-circle", "green"),
				],
				"normal",
				"tasks",
			),
			G("tasks-checkbox", "Checkbox", [
				L(O + "insert-task", "New task", "list-checks", "blue"),
				S("editor:toggle-checklist-status", "Toggle", "check-square"),
			]),
			G("tasks-search", "Search", [
				S("global-search:open", "Search vault", "search"),
				S("editor:open-search", "Find in note", "text-search"),
			], "last"),
		],
		{ requires: "tasks" },
	),

	TAB("view", "View", [
		G("view-views", "Views", [
			L("markdown:toggle-preview", "Read / Edit", "book-open"),
			S("editor:toggle-source", "Source mode", "code-2"),
			S("editor:toggle-readable-line-length", "Line width", "ruler"),
			S("editor:toggle-line-numbers", "Line numbers", "list-ordered"),
		]),
		G(
			"view-zoom",
			"Zoom",
			[
				L("window:zoom-in", "Zoom in", "zoom-in"),
				L("window:zoom-out", "Zoom out", "zoom-out"),
				L("window:reset-zoom", "100%", "scan"),
			],
			"last",
		),
		G("view-panels", "Panels", [
			S("outline:open", "Outline", "list-tree"),
			S("backlink:open-backlinks", "Backlinks", "links-coming-in"),
			S("properties:open-local", "Properties", "info"),
			S("file-explorer:reveal-active-file", "Show in list", "locate"),
		]),
		G("view-window", "Window", [
			S("workspace:split-vertical", "Split right", "separator-vertical"),
			S("workspace:split-horizontal", "Split down", "separator-horizontal"),
			S("workspace:open-in-new-window", "New window", "app-window"),
			S("workspace:new-tab", "New tab", "plus", "green"),
			S("workspace:close", "Close tab", "x", "red"),
		]),
		G(
			"view-theme",
			"Theme",
			[
				L("theme:toggle-light-dark", "Light / Dark", "sun-moon"),
				S("theme:switch", "Theme", "palette", "purple"),
			],
			"first",
		),
	]),

	TAB("utilities", "Utilities", [
		G(
			"util-obsidian",
			"Obsidian",
			[
				L("app:open-settings", "Settings", "settings"),
				S("command-palette:open", "Commands", "terminal-square"),
				S("app:open-help", "Help", "help-circle"),
			],
			"last",
		),
		G(
			"util-ribbon",
			"Ribbon",
			[
				L(O + "customise", "Customise", "move"),
				S(O + "toggle-ribbon", "Collapse", "chevrons-up"),
				S(O + "export", "Export layout", "download"),
				S(O + "import", "Import layout", "upload"),
				S(O + "reset", "Reset ribbon", "rotate-ccw", "red"),
			],
			"first",
		),
		G("util-file", "File", [
			S("workspace:edit-file-title", "Rename", "pencil"),
			S("workspace:copy-path", "Copy path", "copy"),
			S("workspace:copy-url", "Copy link", "link-2"),
			S("workspace:export-pdf", "Export PDF", "file-down"),
		]),
	]),

	TAB(
		"html",
		"HTML",
		[
			G("html-format", "Format", [
				L(O + "html-underline", "Underline", "underline"),
				S(O + "html-color", "Font colour", "baseline", "red"),
				S(O + "html-highlight", "Highlight", "highlighter", "yellow"),
				S(O + "html-clear", "Clear HTML", "eraser", "pink"),
			]),
		],
		{ requires: "html" },
	),
];

export function defaultLayout(): RibbonLayout {
	return normalizeLayout({ tabs: JSON.parse(JSON.stringify(TABS)) as RibbonTab[] });
}
