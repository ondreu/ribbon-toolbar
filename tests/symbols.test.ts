import { describe, expect, it } from "vitest";
import { SYMBOLS, SYMBOL_CATEGORIES, normalizeSymbolQuery, searchSymbols } from "../src/format/symbols";

const chars = (query: string, limit = 8): string[] =>
	searchSymbols(query)
		.slice(0, limit)
		.map((entry) => entry.char);

describe("the symbol catalogue", () => {
	it("is wide enough to be worth searching", () => {
		expect(SYMBOLS.length).toBeGreaterThan(150);
	});

	it("has no duplicate characters", () => {
		const seen = new Set<string>();
		for (const entry of SYMBOLS) {
			expect(seen.has(entry.char), `duplicate ${entry.char} (${entry.name})`).toBe(false);
			seen.add(entry.char);
		}
	});

	it("gives every entry a name and a known category", () => {
		for (const entry of SYMBOLS) {
			expect(entry.name.trim()).not.toBe("");
			expect(SYMBOL_CATEGORIES).toContain(entry.category);
		}
	});

	it("keeps every visible name in English ASCII", () => {
		// Keywords may be localised; the name is what the tooltip and hint show, so it stays English.
		for (const entry of SYMBOLS) {
			expect(entry.name, `${entry.char} has a non-ASCII name`).toMatch(/^[\x20-\x7E]+$/);
		}
	});

	it("keeps every category populated", () => {
		for (const category of SYMBOL_CATEGORIES) {
			expect(SYMBOLS.some((entry) => entry.category === category)).toBe(true);
		}
	});
});

describe("normalizeSymbolQuery", () => {
	it("folds case and Czech diacritics", () => {
		expect(normalizeSymbolQuery("  MÍ ")).toBe("mi");
		expect(normalizeSymbolQuery("Šípka")).toBe("sipka");
	});

	it("leaves ASCII untouched", () => {
		expect(normalizeSymbolQuery("Ohm")).toBe("ohm");
	});
});

describe("searchSymbols", () => {
	it("finds omega when the user types the unit they mean", () => {
		const found = chars("ohm");
		expect(found).toContain("Ω");
		expect(found).toContain("ω");
	});

	it("finds both omegas by name", () => {
		expect(chars("omega")).toEqual(expect.arrayContaining(["Ω", "ω"]));
	});

	it("ranks the engineering sense first", () => {
		expect(searchSymbols("ohm")[0]?.char).toBe("Ω");
	});

	it("matches Czech names and keywords", () => {
		expect(chars("odpor")).toContain("Ω");
		expect(chars("sipka")).toContain("→");
		expect(chars("mensi nebo rovno")).toContain("≤");
		expect(chars("stupen")).toContain("°");
		expect(chars("koruna")).toContain("Kč");
	});

	it("ignores diacritics and case in the query", () => {
		expect(chars("SIPKA")).toContain("→");
		expect(chars("mikro")).toContain("µ");
		expect(chars("MÍ")).toContain("µ");
	});

	it("narrows when the query has several words", () => {
		const found = chars("arrow right", 12);
		expect(found[0]).toBe("→");
		expect(found).not.toContain("←");
		expect(found).not.toContain("↑");
	});

	it("finds a character typed as is", () => {
		expect(searchSymbols("Ω")[0]?.char).toBe("Ω");
	});

	it("returns the whole catalogue for an empty query", () => {
		expect(searchSymbols("")).toHaveLength(SYMBOLS.length);
		expect(searchSymbols("   ")).toHaveLength(SYMBOLS.length);
	});

	it("returns nothing for a query no symbol answers", () => {
		expect(searchSymbols("xyzzy")).toEqual([]);
	});

	it("keeps result order stable across repeated searches", () => {
		expect(chars("ohm")).toEqual(chars("ohm"));
	});
});
