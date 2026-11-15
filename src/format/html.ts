/*
 * HTML formatting — opt-in, off by default.
 *
 * Obsidian renders inline HTML, so underline, font colour and a coloured highlight are
 * possible. They are also the one thing that makes a note unreadable in a plain Markdown
 * viewer, so the feature is a setting: while it is off, its tab is hidden and its commands
 * do not appear in the command palette. Subscript and superscript do not live here — those
 * two are the sanctioned exception and are always available.
 */

import type { TextEdit } from "./text";

export interface Pen {
	name: string;
	color: string;
}

/** The palette Word puts in front of you: a row of theme colours and a row of neutrals. */
export const TEXT_COLORS: Pen[] = [
	{ name: "Red", color: "#C00000" },
	{ name: "Orange", color: "#ED7D31" },
	{ name: "Gold", color: "#BF9000" },
	{ name: "Green", color: "#00B050" },
	{ name: "Teal", color: "#00B0A0" },
	{ name: "Blue", color: "#0070C0" },
	{ name: "Indigo", color: "#3333A0" },
	{ name: "Purple", color: "#7030A0" },
	{ name: "Pink", color: "#C00080" },
	{ name: "Grey", color: "#7F7F7F" },
];

export const HIGHLIGHT_COLORS: Pen[] = [
	{ name: "Yellow", color: "#FFF2A8" },
	{ name: "Green", color: "#C6EFCE" },
	{ name: "Turquoise", color: "#CCF2F4" },
	{ name: "Blue", color: "#DDEBF7" },
	{ name: "Pink", color: "#FCE4EC" },
	{ name: "Orange", color: "#FCE4D6" },
	{ name: "Purple", color: "#E9E1F5" },
	{ name: "Grey", color: "#EDEDED" },
];

const escapeAttr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** True when `offset` sits between `<` and `>` of an HTML tag, e.g. inside a style value. */
function insideTag(text: string, offset: number): boolean {
	if (offset <= 0) return false;
	const open = text.lastIndexOf("<", offset - 1);
	if (open < 0) return false;
	if (open < text.lastIndexOf(">", offset - 1)) return false;
	return text.indexOf(">", offset) >= 0;
}

/**
 * Wraps the selection in `<tag style="property: value">`, or replaces the style when the
 * selection is already such a tag. A null value removes the wrapper entirely.
 */
export function applyStyledTag(
	text: string,
	from: number,
	to: number,
	tag: string,
	property: string,
	value: string | null,
): TextEdit {
	const sel = from <= to ? { from, to } : { from: to, to: from };
	// A selection inside an attribute value (double-clicking "red" in style="color: red") must
	// not be wrapped: that would write markup into the attribute and break the note.
	if (insideTag(text, sel.from) || insideTag(text, sel.to)) return { text, from: sel.from, to: sel.to };
	const open = value === null ? "" : `<${tag} style="${property}: ${escapeAttr(value)}">`;
	const close = value === null ? "" : `</${tag}>`;
	const exact = new RegExp(`^<${tag}\\s+style="[^"]*">((?:(?!<${tag}\\b|</${tag}>)[\\s\\S])*)</${tag}>$`);

	if (sel.from === sel.to) {
		return {
			text: text.slice(0, sel.from) + open + close + text.slice(sel.from),
			from: sel.from + open.length,
			to: sel.from + open.length,
		};
	}
	const selected = text.slice(sel.from, sel.to);
	const match = exact.exec(selected);
	if (match) {
		const inner = match[1] ?? "";
		const replacement = value === null ? inner : open + inner + close;
		return {
			text: text.slice(0, sel.from) + replacement + text.slice(sel.to),
			from: sel.from,
			to: sel.from + replacement.length,
		};
	}
	// The tags may sit just outside the selection: Obsidian hides them in Live Preview.
	const openTag = new RegExp(`<${tag}\\s+style="[^"]*">$`).exec(text.slice(0, sel.from))?.[0];
	const closeTag = `</${tag}>`;
	if (openTag && text.startsWith(closeTag, sel.to)) {
		const openStart = sel.from - openTag.length;
		const replacement = value === null ? selected : open + selected + close;
		return {
			text: text.slice(0, openStart) + replacement + text.slice(sel.to + closeTag.length),
			from: openStart,
			to: openStart + replacement.length,
		};
	}
	if (value === null) {
		// Several coloured spans in one selection: remove each wrapper, but never cut through
		// a nested span (the old greedy capture wrote back a stray </span> in that case).
		const nested = new RegExp(`<${tag}\\b`, "i");
		const stripped = selected.replace(
			new RegExp(`<${tag}\\s+style="[^"]*">([\\s\\S]*?)</${tag}>`, "gi"),
			(whole: string, inner: string) => (nested.test(inner) ? whole : inner),
		);
		if (stripped !== selected) {
			return {
				text: text.slice(0, sel.from) + stripped + text.slice(sel.to),
				from: sel.from,
				to: sel.from + stripped.length,
			};
		}
		return { text, from: sel.from, to: sel.to };
	}
	return {
		text: text.slice(0, sel.from) + open + selected + close + text.slice(sel.to),
		from: sel.from + open.length,
		to: sel.to + open.length,
	};
}

export function applyColor(text: string, from: number, to: number, color: string | null): TextEdit {
	return applyStyledTag(text, from, to, "span", "color", color);
}

export function applyHighlight(text: string, from: number, to: number, color: string | null): TextEdit {
	return applyStyledTag(text, from, to, "mark", "background-color", color);
}

/** Removes inline HTML tags from the selection, leaving the words. */
export function clearHtml(text: string, from: number, to: number): TextEdit {
	const sel = from <= to ? { from, to } : { from: to, to: from };
	if (insideTag(text, sel.from) || insideTag(text, sel.to)) return { text, from: sel.from, to: sel.to };
	const selected = text.slice(sel.from, sel.to);
	const clean = selected.replace(/<\/?(?:u|sub|sup|mark|span|font|div|p)(?:\s[^>]*)?>/gi, "");
	return {
		text: text.slice(0, sel.from) + clean + text.slice(sel.to),
		from: sel.from,
		to: sel.from + clean.length,
	};
}
