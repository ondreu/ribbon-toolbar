/*
 * Text edits the ribbon's formatting buttons perform.
 *
 * Pure functions over a plain string, so they run under vitest without Obsidian. The caller
 * turns offsets back into editor positions and applies the edit with one `transaction`, which
 * keeps the change a single undo step and leaves the cursor where a user expects it.
 *
 * Markdown only: bold/italic/strike/code/highlight are core commands, and everything here is
 * either native Markdown or the two tags Markdown lacks (sub and sup). The HTML formatting
 * that the plugin offers as an opt-in feature lives in `html.ts` and is never reached unless
 * the setting is on.
 */

export interface TextEdit {
	text: string;
	/** Selection after the edit, as offsets into `text`. */
	from: number;
	to: number;
}

export interface Selection {
	from: number;
	to: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function lineStart(text: string, offset: number): number {
	const at = clamp(offset, 0, text.length);
	const nl = text.lastIndexOf("\n", at - 1);
	return nl < 0 ? 0 : nl + 1;
}

export function lineEnd(text: string, offset: number): number {
	const at = clamp(offset, 0, text.length);
	const nl = text.indexOf("\n", at);
	return nl < 0 ? text.length : nl;
}

/** Whole lines touched by the selection. An empty selection covers its own line. */
export function expandToLines(text: string, from: number, to: number): Selection {
	return { from: lineStart(text, from), to: lineEnd(text, to) };
}

function normalize(from: number, to: number): Selection {
	return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * Lines that are fenced code, including the fence lines themselves. Line prefixes and
 * headings must leave these alone: turning ``` into `# ``` destroys the block.
 */
function fenceMask(lines: string[]): boolean[] {
	let fence: string | null = null;
	return lines.map((line) => {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]?.[0] ?? null;
		if (marker) {
			if (fence === null) {
				fence = marker;
				return true;
			}
			if (fence === marker) {
				fence = null;
				return true;
			}
		}
		return fence !== null;
	});
}

/**
 * Wraps the selection in `before`/`after`, or removes the markers when they are already there.
 *
 * Markers are looked for in three places, because Obsidian hides Markdown syntax in Live
 * Preview and a selection made by dragging often sits *inside* the markers rather than
 * including them: the selection itself, and the text immediately before and after it.
 */
export function toggleInline(text: string, from: number, to: number, before: string, after = before): TextEdit {
	const sel = normalize(from, to);
	if (sel.from === sel.to) {
		return {
			text: text.slice(0, sel.from) + before + after + text.slice(sel.from),
			from: sel.from + before.length,
			to: sel.from + before.length,
		};
	}
	const selected = text.slice(sel.from, sel.to);
	if (selected.length >= before.length + after.length && selected.startsWith(before) && selected.endsWith(after)) {
		const inner = selected.slice(before.length, selected.length - after.length);
		return {
			text: text.slice(0, sel.from) + inner + text.slice(sel.to),
			from: sel.from,
			to: sel.from + inner.length,
		};
	}
	const outerFrom = sel.from - before.length;
	const outerTo = sel.to + after.length;
	if (
		outerFrom >= 0 &&
		outerTo <= text.length &&
		text.slice(outerFrom, sel.from) === before &&
		text.slice(sel.to, outerTo) === after
	) {
		return {
			text: text.slice(0, outerFrom) + selected + text.slice(outerTo),
			from: outerFrom,
			to: outerFrom + selected.length,
		};
	}
	return {
		text: text.slice(0, sel.from) + before + selected + after + text.slice(sel.to),
		from: sel.from + before.length,
		to: sel.to + before.length,
	};
}

/** `<sub>` and `<sup>`: Markdown has no syntax for them, so they are the one sanctioned exception. */
export function toggleTag(text: string, from: number, to: number, tag: string): TextEdit {
	return toggleInline(text, from, to, `<${tag}>`, `</${tag}>`);
}

/** Sets the heading level of every line in the selection. 0 is a normal paragraph. */
export function setHeading(text: string, from: number, to: number, level: number): TextEdit {
	const block = expandToLines(text, from, to);
	const lines = text.slice(block.from, block.to).split("\n");
	const fenced = fenceMask(lines);
	const next = lines.map((line, index) => {
		if (fenced[index]) return line;
		const indent = /^\s*/.exec(line)?.[0] ?? "";
		const body = line.slice(indent.length).replace(/^#{1,6}\s+/, "");
		return level > 0 ? `${indent}${"#".repeat(level)} ${body}` : `${indent}${body}`;
	});
	const replacement = next.join("\n");
	return {
		text: text.slice(0, block.from) + replacement + text.slice(block.to),
		from: block.from,
		to: block.from + replacement.length,
	};
}

/** Adds a line prefix (`- [ ] `, `> `) to every line of the selection, or removes it when all have it. */
export function toggleLinePrefix(text: string, from: number, to: number, prefix: string): TextEdit {
	const block = expandToLines(text, from, to);
	const lines = text.slice(block.from, block.to).split("\n");
	const fenced = fenceMask(lines);
	const has = (line: string): boolean => line.trimStart().startsWith(prefix);
	const all = lines.filter((line, index) => !fenced[index] && line.trim() !== "").every(has);
	const next = lines.map((line, index) => {
		if (fenced[index] || !line.trim()) return line;
		if (all) {
			const at = line.indexOf(prefix, line.length - line.trimStart().length);
			return at >= 0 ? line.slice(0, at) + line.slice(at + prefix.length) : line;
		}
		const indent = /^\s*/.exec(line)?.[0] ?? "";
		return `${indent}${prefix}${line.slice(indent.length)}`;
	});
	const replacement = next.join("\n");
	return {
		text: text.slice(0, block.from) + replacement + text.slice(block.to),
		from: block.from,
		to: block.from + replacement.length,
	};
}

/** Adds a line prefix (`- [ ] `, `> `) to every line of the selection, leaving lines that already have it. */
export function addLinePrefix(text: string, from: number, to: number, prefix: string): TextEdit {
	const block = expandToLines(text, from, to);
	const lines = text.slice(block.from, block.to).split("\n");
	const fenced = fenceMask(lines);
	const next = lines.map((line, index) => {
		if (fenced[index] || !line.trim()) return line;
		if (line.trimStart().startsWith(prefix)) return line;
		const indent = /^\s*/.exec(line)?.[0] ?? "";
		return `${indent}${prefix}${line.slice(indent.length)}`;
	});
	const replacement = next.join("\n");
	return {
		text: text.slice(0, block.from) + replacement + text.slice(block.to),
		from: block.from,
		to: block.from + replacement.length,
	};
}

/**
 * Inserts a block on its own lines at `offset`. Returns the cursor at the end of the block,
 * or `caret` characters into it when the block wants the cursor inside (a table's first cell,
 * a link's target).
 */
export function insertBlock(text: string, offset: number, block: string, caret?: number): TextEdit {
	const at = clamp(offset, 0, text.length);
	const before = text.slice(0, at);
	const after = text.slice(at);
	const lead = before.length > 0 && !before.endsWith("\n") ? "\n\n" : "";
	const tail = after.length > 0 && !after.startsWith("\n") ? "\n" : after.length === 0 ? "\n" : "";
	const inserted = lead + block + tail;
	return {
		text: before + inserted + after,
		from: at + lead.length + (caret ?? block.length),
		to: at + lead.length + (caret ?? block.length),
	};
}

/** A GFM table with a header row and blank body rows, the same shape Word's Insert Table makes. */
export function tableMarkdown(rows: number, cols: number): string {
	const n = Math.max(1, Math.min(50, Math.floor(cols)));
	const r = Math.max(2, Math.min(200, Math.floor(rows)));
	const header = "| " + Array.from({ length: n }, (_, i) => `Column ${i + 1}`).join(" | ") + " |";
	const separator = "|" + " --- |".repeat(n);
	const body = Array.from({ length: r - 1 }, () => "|" + "     |".repeat(n));
	return [header, separator, ...body].join("\n");
}

