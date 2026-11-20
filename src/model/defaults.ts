/*
 * The default ribbon layout. Pure data, editable by the user afterwards.
 *
 * Every button is a command id. Buttons whose command is unavailable are greyed out; a button or
 * group with `requires` disappears with its plugin, and a group left with no visible buttons is
 * hidden. A tab or group that only makes sense with an optional plugin carries `requires`, so it
 * is hidden rather than shown full of dead buttons.
 *
 * Two rules keep the bar readable, and tests/defaults.test.ts enforces both:
 *
 *   1. No command appears twice. Creating something lives in Insert > Pages; a tab with a
 *      `requires` survives only where the action belongs to that plugin.
 *   2. Every core command id exists in Obsidian 1.15.1 (tests/fixtures/obsidian-commands.json).
 *      Community ids are checked against the plugin that registers them.
 *
 *   own:        this plugin's commands (ribbon-toolbar:*)
 *   core:       Obsidian and its core plugins
 *   community:  Tasks, Markdown Spreadsheets, Excalidraw, Templater, Synonym, LanguageTool,
 *               Advanced Tables, Kanban, Git, Advanced PDF Export
 */

import { normalizeLayout, type ColorName, type FeatureKey, type RibbonGroup, type RibbonItem, type RibbonLayout, type RibbonTab } from "./layout";

const O = "ribbon-toolbar:";
const M = "markdown-spreadsheets:";
const T = "obsidian-tasks-plugin:";
const X = "obsidian-excalidraw-plugin:";
const TE = "templater-obsidian:";
const SY = "synonym:";
const LT = "obsidian-languagetool-plugin:";
const AT = "table-editor-obsidian:";
const K = "obsidian-kanban:";
const GIT = "obsidian-git:";
const PDF = "advanced-pdf-export:";

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
				S("editor:undo", "Undo", "undo-2"),
				S("editor:redo", "Redo", "redo-2"),
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
			S("editor:toggle-comments", "Comment", "message-square-text"),
		]),
		G("home-paragraph", "Paragraph", [
			S("editor:toggle-bullet-list", "Bullets", "list"),
			S("editor:toggle-numbered-list", "Numbering", "list-ordered"),
			S("editor:toggle-checklist-status", "Checkbox", "list-checks"),
			S("editor:unindent-list", "Outdent", "outdent"),
			S("editor:indent-list", "Indent", "indent"),
			S("editor:swap-line-up", "Move up", "arrow-up"),
			S("editor:swap-line-down", "Move down", "arrow-down"),
			S("editor:toggle-blockquote", "Quote", "quote"),
		]),
		G("home-styles", "Styles", [
			S(O + "style-h1", "Heading 1", "heading-1", "blue"),
			S(O + "style-h2", "Heading 2", "heading-2", "blue"),
			S(O + "style-h3", "Heading 3", "heading-3", "blue"),
			S(O + "style-h4", "Heading 4", "heading-4", "blue"),
			S(O + "style-normal", "Normal", "pilcrow"),
		]),
		G("home-review", "Review", [
			L(SY + "show", "Thesaurus", "book-a", "purple", { requires: "thesaurus" }),
			L(LT + "ltcheck-text", "Check text", "spell-check-2", undefined, { requires: "languagetool" }),
			S(LT + "ltclear", "Clear grammar", "remove-formatting", "pink", { requires: "languagetool" }),
		]),
	]),

	TAB("insert", "Insert", [
		G("insert-files", "Files", [
			L("editor:insert-embed", "Embed", "file-input"),
			S("editor:attach-file", "Attachment", "paperclip"),
			S(O + "embed-canvas", "Embed canvas", "layout-dashboard"),
		]),
		G("insert-pages", "Pages", [
			L("file-explorer:new-file", "New note", "file-plus"),
			S("canvas:new-file", "New canvas", "layout-dashboard"),
			S("bases:new-file", "New base", "layout-list", undefined, { requires: "bases" }),
			S(K + "create-new-kanban-board", "New board", "square-kanban", undefined, { requires: "kanban" }),
		]),
		G("insert-templates", "Templates", [
			L("insert-template", "Template", "layout-template", undefined, { requires: "templates" }),
			S(TE + "insert-templater", "Templater", "layout-template", "purple", { requires: "templater" }),
			S(TE + "create-new-note-from-template", "New from template", "file-plus", undefined, { requires: "templater" }),
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
			S("editor:insert-mathblock", "Equation", "sigma", "purple"),
			S("editor:toggle-inline-math", "Inline math", "square-function"),
		]),
		G("insert-date", "Date and time", [
			L("insert-current-date", "Date", "calendar-days"),
			S("insert-current-time", "Time", "clock"),
		]),
		G("insert-symbols", "Symbols", [L(O + "insert-symbol", "Symbol", "omega")], "last"),
	]),

	TAB("table", "Table", [
		G("table-insert", "Table", [
			L(O + "insert-table", "Insert table", "table"),
			S("editor:insert-table", "Quick table", "table-2"),
			S(AT + "format-table", "Format table", "align-justify", undefined, { requires: "advanced-tables" }),
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
		"sheet-home",
		"Home",
		[
			G(
				"sheet-clipboard",
				"Clipboard",
				[
					L(M + "grid-paste", "Paste", "clipboard-paste", undefined, onGrid),
					S(M + "grid-cut", "Cut", "scissors", undefined, onGrid),
					S(M + "grid-copy", "Copy", "copy", undefined, onGrid),
					S(M + "grid-paste-special", "Paste special", "clipboard-copy", undefined, onGrid),
					S(M + "grid-undo", "Undo", "undo-2", undefined, onGrid),
					S(M + "grid-redo", "Redo", "redo-2", undefined, onGrid),
				],
				"last",
			),
			G("sheet-rows", "Rows", [
				L(M + "grid-row-above", "Row above", "arrow-up-to-line", "green", onGrid),
				S(M + "grid-row-below", "Row below", "arrow-down-to-line", "green", onGrid),
				S(M + "grid-row-duplicate", "Duplicate", "copy", undefined, onGrid),
				S(M + "grid-row-delete", "Delete row", "trash-2", "red", onGrid),
				S(M + "grid-row-up", "Move up", "arrow-up", undefined, onGrid),
				S(M + "grid-row-down", "Move down", "arrow-down", undefined, onGrid),
			]),
			G("sheet-columns", "Columns", [
				L(M + "grid-col-left", "Column left", "arrow-left-to-line", "green", onGrid),
				S(M + "grid-col-right", "Column right", "arrow-right-to-line", "green", onGrid),
				S(M + "grid-col-duplicate", "Duplicate", "copy", undefined, onGrid),
				S(M + "grid-col-delete", "Delete column", "trash-2", "red", onGrid),
				S(M + "grid-col-left-move", "Move left", "arrow-left", undefined, onGrid),
				S(M + "grid-col-right-move", "Move right", "arrow-right", undefined, onGrid),
			]),
			G("sheet-align", "Alignment", [
				S(M + "grid-align-left", "Left", "align-left", undefined, onGrid),
				S(M + "grid-align-center", "Center", "align-center", undefined, onGrid),
				S(M + "grid-align-right", "Right", "align-right", undefined, onGrid),
				S(M + "grid-align-none", "Default", "align-justify", undefined, onGrid),
			]),
			G(
				"sheet-format",
				"Format",
				[
					L(M + "grid-bold", "Bold", "bold", undefined, onGrid),
					S(M + "grid-italic", "Italic", "italic", undefined, onGrid),
					S(M + "grid-strike", "Strike", "strikethrough", undefined, onGrid),
					S(M + "grid-code", "Code", "code", undefined, onGrid),
					S(M + "grid-highlight", "Highlight", "highlighter", "yellow", onGrid),
					S(M + "grid-cf", "Conditional", "paintbrush", undefined, onGrid),
					S(M + "grid-link", "Link", "link", undefined, onGrid),
					S(M + "grid-wrap", "Wrap", "wrap-text", undefined, onGrid),
					S(M + "grid-render", "Rendered", "eye", undefined, onGrid),
				],
				"last",
			),
		],
		{ requires: "spreadsheet", context: "spreadsheet" },
	),

	TAB(
		"sheet-data",
		"Data",
		[
			G("sheet-sort", "Sort", [
				L(M + "grid-sort-asc", "Sort ascending", "arrow-down-a-z", undefined, onGrid),
				S(M + "grid-sort-desc", "Sort descending", "arrow-up-a-z", undefined, onGrid),
				S(M + "grid-sort-multi", "Sort by several columns", "arrow-up-down", undefined, onGrid),
			]),
			G("sheet-filter", "Filter", [
				L(M + "grid-filter", "Filter", "filter", undefined, onGrid),
				S(M + "grid-filter-clear", "Clear", "filter-x", "red", onGrid),
			]),
			G("sheet-editing", "Editing", [
				L(M + "grid-find", "Find and replace", "search", undefined, onGrid),
				S(M + "grid-go-to", "Go to cell", "locate", undefined, onGrid),
				S(M + "grid-fill-down", "Fill down", "arrow-down-to-line", undefined, onGrid),
				S(M + "grid-fill-right", "Fill right", "arrow-right-to-line", undefined, onGrid),
				S(M + "grid-insert-date", "Insert date", "calendar-days", undefined, onGrid),
				S(M + "grid-clear", "Clear contents", "eraser", "pink", onGrid),
			]),
			G("sheet-tools", "Tools", [
				L(M + "grid-pivot", "Pivot", "pivot", undefined, onGrid),
				S(M + "grid-text-to-columns", "Split into columns", "split", undefined, onGrid),
				S(M + "grid-merge-columns", "Merge columns", "merge", undefined, onGrid),
				S(M + "grid-remove-duplicates", "Remove duplicates", "copy-x", undefined, onGrid),
				S(M + "grid-change-text", "Change text", "case-sensitive", undefined, onGrid),
			]),
		],
		{ requires: "spreadsheet", context: "spreadsheet" },
	),

	TAB(
		"sheet-calculate",
		"Calculate",
		[
			G("sheet-quick", "Quick", [
				L(M + "grid-calc", "Calculate", "calculator", undefined, onGrid),
				S(M + "grid-calc-again", "Again", "refresh-cw", undefined, onGrid),
			]),
			G("sheet-formulas", "Formulas", [
				L(M + "grid-insert-formula", "Insert formula", "square-function", undefined, onGrid),
				S(M + "grid-totals-row", "Totals row", "sigma", undefined, onGrid),
				S(M + "grid-compute-column", "Compute column", "function-square", undefined, onGrid),
				S(M + "grid-flatten", "Flatten", "layers", undefined, onGrid),
			]),
			G("sheet-numbers", "Numbers", [
				L(M + "grid-date-format", "Show as date", "calendar-days", undefined, onGrid),
				S(M + "grid-number-format", "Format numbers", "hash", undefined, onGrid),
				S(M + "grid-column-stats", "Column statistics", "chart-column", undefined, onGrid),
			]),
		],
		{ requires: "spreadsheet", context: "spreadsheet" },
	),

	TAB(
		"sheet-table",
		"Table",
		[
			G("sheet-size", "Size", [
				L(M + "grid-colw", "Width", "move-horizontal", undefined, onGrid),
				S(M + "grid-rowh", "Height", "move-vertical", undefined, onGrid),
			]),
			G("sheet-autofit", "Autofit", [
				L(M + "grid-autofit-col", "Autofit columns", "move-horizontal", undefined, onGrid),
				S(M + "grid-autofit-row", "Autofit rows", "move-vertical", undefined, onGrid),
				S(M + "grid-autofit-all", "Autofit all", "maximize", undefined, onGrid),
				S(M + "grid-reset-row", "Reset row height", "rotate-ccw", undefined, onGrid),
			]),
			G("sheet-freeze", "Freeze", [
				L(M + "grid-freeze-header", "Freeze header", "pin", undefined, onGrid),
				S(M + "grid-freeze-col", "Freeze first column", "pin", undefined, onGrid),
				S(M + "grid-freeze-panes", "Freeze panes", "grid-2x2", undefined, onGrid),
				S(M + "grid-freeze-none", "Unfreeze", "pin-off", undefined, onGrid),
			]),
			G("sheet-view", "View", [
				S(M + "grid-zoom-out", "Zoom out", "zoom-out", undefined, onGrid),
				S(M + "grid-zoom-reset", "100%", "scan", undefined, onGrid),
				S(M + "grid-zoom-in", "Zoom in", "zoom-in", undefined, onGrid),
				S(M + "grid-hide-cols", "Hide columns", "eye-off", undefined, onGrid),
				S(M + "grid-show-cols", "Show columns", "eye", undefined, onGrid),
			]),
			G("sheet-reformat", "Table", [
				L(M + "grid-reformat", "Reformat", "align-justify", undefined, onGrid),
				S(M + "grid-shrink", "Shrink to data", "minimize-2", undefined, onGrid),
				S(M + "grid-restore", "Restore a version", "history", undefined, onGrid),
			]),
		],
		{ requires: "spreadsheet", context: "spreadsheet" },
	),

	TAB(
		"sheet-export",
		"Export",
		[
			G("sheet-files", "Files", [
				L(M + "grid-xlsx", "Excel", "file-spreadsheet", undefined, onGrid),
				S(M + "grid-csv", "CSV", "file-down", undefined, onGrid),
				S(M + "grid-json", "JSON", "file-json", undefined, onGrid),
				S(M + "grid-import", "Import", "upload", undefined, onGrid),
				S(M + "grid-merge-file", "Merge", "git-merge", undefined, onGrid),
			]),
			G("sheet-clipboard-out", "Clipboard", [
				L(M + "grid-copy-md", "Copy as Markdown", "copy", undefined, onGrid),
				S(M + "grid-copy-html", "Copy formatted", "clipboard-copy", undefined, onGrid),
				S(M + "grid-copy-json", "Copy as JSON", "file-json", undefined, onGrid),
				S(M + "grid-copy-tsv", "Copy as text", "clipboard-paste", undefined, onGrid),
			]),
			G("sheet-note", "Note", [
				L(M + "grid-save", "Save", "save", undefined, onGrid),
				S(M + "grid-reload", "Reload", "refresh-cw", undefined, onGrid),
				S(M + "grid-open-note", "Open the note", "file-text", undefined, onGrid),
			]),
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
			L("canvas:export-as-image", "Export image", "image"),
			S("canvas:jump-to-group", "Jump to group", "move"),
			S("canvas:convert-to-file", "Convert to note", "file-input"),
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
			G("tasks-new", "New task", [L(O + "insert-task", "New task", "list-checks", "blue")], "last"),
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
		G("view-navigation", "Navigation", [
			L("switcher:open", "Quick switcher", "file-search"),
			S("app:go-back", "Back", "arrow-left"),
			S("app:go-forward", "Forward", "arrow-right"),
		]),
		G("view-editing", "Editing", [
			S("editor:open-search", "Find", "search"),
			S("editor:open-search-replace", "Replace", "replace"),
			S("editor:toggle-spellcheck", "Spelling", "spell-check"),
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
			S("file-explorer:duplicate-file", "Duplicate", "copy-plus"),
			S("file-explorer:move-file", "Move", "folder-input"),
			S("workspace:copy-path", "Copy path", "copy"),
			S("workspace:copy-url", "Copy link", "link-2"),
			S("workspace:export-pdf", "Export PDF", "file-down"),
			S(PDF + "open-panel", "Advanced PDF", "printer", undefined, { requires: "advanced-pdf" }),
		]),
	]),

	TAB(
		"git",
		"Git",
		[
			G(
				"git-sync",
				"Sync",
				[
					L(GIT + "push", "Commit and sync", "refresh-cw", "green"),
					S(GIT + "pull", "Pull", "arrow-down-to-line"),
					S(GIT + "push2", "Push", "arrow-up-from-line"),
					S(GIT + "commit", "Commit all", "git-commit-horizontal"),
				],
				"first",
			),
			G(
				"git-repository",
				"Repository",
				[
					S(GIT + "open-git-view", "Source control", "git-branch"),
					S(GIT + "open-history-view", "History", "history"),
					S(GIT + "fetch", "Fetch", "cloud-download"),
				],
				"last",
			),
		],
		{ requires: "git" },
	),

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

/** Bumped whenever TABS changes shape; lets a stored layout from an older default upgrade. */
export const DEFAULTS_VERSION = 4;

/**
 * FNV-1a hashes of every default layout this plugin has shipped. A vault still running one of
 * them untouched is upgraded in place when a newer build starts; a customised layout is not.
 */
export const LEGACY_DEFAULT_HASHES = ["c67ca54f", "737bc0db", "968b9837"];

export function defaultLayout(): RibbonLayout {
	return normalizeLayout({ defaultsVersion: DEFAULTS_VERSION, tabs: JSON.parse(JSON.stringify(TABS)) as RibbonTab[] });
}
