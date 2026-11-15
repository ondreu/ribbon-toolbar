import { describe, expect, it } from "vitest";
import { fitGroups, fitTabs, LEVEL_COLLAPSED, LEVEL_FULL, LEVEL_ICONS, LEVEL_SMALL } from "../src/model/fit";

const widths = (full: number, small: number, icons: number, collapsed: number): number[] => [full, small, icons, collapsed];

describe("fitGroups", () => {
	it("keeps every group at its own size when there is room", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", widths: widths(100, 60, 40, 30) },
				{ id: "b", widths: widths(100, 60, 40, 30) },
			],
			available: 400,
		});
		expect(fit.overflow).toEqual([]);
		expect(fit.levels).toEqual({ a: LEVEL_FULL, b: LEVEL_FULL });
		expect(fit.used).toBe(200);
	});

	it("shrinks the group furthest to the right first", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", widths: widths(100, 60, 40, 30) },
				{ id: "b", widths: widths(100, 60, 40, 30) },
			],
			available: 170,
		});
		expect(fit.levels.a).toBe(LEVEL_FULL);
		expect(fit.levels.b).toBe(LEVEL_SMALL);
	});

	it("shrinks 'first' groups before normal ones", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", priority: "first", widths: widths(100, 60, 40, 30) },
				{ id: "b", widths: widths(100, 60, 40, 30) },
			],
			available: 170,
		});
		expect(fit.levels.a).toBe(LEVEL_SMALL);
		expect(fit.levels.b).toBe(LEVEL_FULL);
	});

	it("goes all the way to icon-only before overflowing", () => {
		const fit = fitGroups({
			groups: [{ id: "a", widths: widths(100, 60, 40, 30) }],
			available: 45,
		});
		expect(fit.overflow).toEqual([]);
		expect(fit.levels.a).toBe(LEVEL_ICONS);
	});

	it("collapses what still does not fit into More", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", widths: widths(100, 60, 40, 30) },
				{ id: "b", widths: widths(100, 60, 40, 30) },
				{ id: "c", widths: widths(100, 60, 40, 30) },
			],
			available: 70,
			moreWidth: 40,
		});
		expect(fit.overflow).toEqual(["b", "c"]);
		expect(fit.levels.a).toBe(LEVEL_COLLAPSED);
		expect(fit.used).toBe(70);
	});

	it("never claims a width wider than it was given", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", widths: widths(300, 200, 100, 50) },
				{ id: "b", widths: widths(300, 200, 100, 50) },
				{ id: "c", widths: widths(300, 200, 100, 50) },
			],
			available: 120,
			moreWidth: 40,
		});
		expect(fit.used).toBeLessThanOrEqual(120);
	});

	it("ignores a step that does not make a group narrower", () => {
		const fit = fitGroups({
			groups: [{ id: "a", widths: widths(40, 40, 40, 40) }],
			available: 40,
		});
		expect(fit.levels.a).toBe(LEVEL_FULL);
		expect(fit.overflow).toEqual([]);
	});

	it("collapses a single group rather than shrinking it when collapse is the only step left", () => {
		const fit = fitGroups({
			groups: [{ id: "a", widths: widths(200, 150, 100, 50) }],
			available: 60,
			moreWidth: 40,
		});
		expect(fit.levels.a).toBe(LEVEL_COLLAPSED);
	});

	it("skips icon-only groups when the ribbon has two rows", () => {
		const fit = fitGroups({
			groups: [
				{ id: "a", widths: widths(300, 300, 100, 60) },
				{ id: "b", widths: widths(300, 300, 100, 60) },
			],
			available: 400,
			iconOnly: false,
		});
		expect(fit.levels.a).not.toBe(LEVEL_ICONS);
		expect(fit.levels.b).not.toBe(LEVEL_ICONS);
	});
});

describe("fitTabs", () => {
	it("shows everything when it fits", () => {
		expect(fitTabs({ widths: [50, 50, 50], available: 200 })).toEqual({ visible: [0, 1, 2], overflow: [] });
	});

	it("moves tabs from the right into overflow but keeps the active one", () => {
		const fit = fitTabs({ widths: [50, 50, 50], available: 120, active: 2, moreWidth: 30 });
		expect(fit.overflow).toEqual([0, 1]);
		expect(fit.visible).toContain(2);
	});
});
