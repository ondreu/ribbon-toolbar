/*
 * Adaptive sizing: decides how each group of a tab is drawn for a given ribbon width.
 *
 * Pure functions, no DOM. The view measures how wide each group is at each level and
 * passes the numbers in; this file decides. It never returns a result wider than the
 * space it was given (unless the "more" button alone doesn't fit), so the ribbon never
 * needs a horizontal scroll bar.
 *
 * Levels of a group:
 *   0  as the user set it up (large and small buttons)
 *   1  every button small: icon + label, stacked
 *   2  every button icon-only, stacked
 *   3  the whole group collapses into one drop-down button
 * After that, groups that still don't fit move into the "More" drop-down at the right end.
 *
 * Shrinking is step by step, like Office: first everything goes small, then icon-only,
 * then groups collapse. A group's priority shifts when its steps happen:
 *   'first' shrinks one and a half levels ahead of normal groups
 *   'last'  shrinks one and a half levels behind
 * Among equals, the group furthest to the right goes first.
 */

export const LEVEL_FULL = 0;
export const LEVEL_SMALL = 1;
export const LEVEL_ICONS = 2;
export const LEVEL_COLLAPSED = 3;

const BIAS: Record<string, number> = { first: -1.5, normal: 0, last: 1.5 };

const bias = (g: { priority?: string }): number => (g.priority && g.priority in BIAS ? (BIAS[g.priority] as number) : 0);

export interface GroupFitInput {
	id: string;
	priority?: string;
	/** Width at LEVEL_FULL, LEVEL_SMALL, LEVEL_ICONS, LEVEL_COLLAPSED. */
	widths: number[];
}

export interface GroupFit {
	levels: Record<string, number>;
	overflow: string[];
	used: number;
}

/** The order in which shrink steps are taken. `iconOnly` false skips the icon-only level. */
export function shrinkSteps(
	groups: Array<{ id: string; priority?: string }>,
	iconOnly = true,
): Array<{ id: string; level: number }> {
	const steps: Array<{ id: string; level: number; key: number; index: number }> = [];
	groups.forEach((g, index) => {
		const levels = iconOnly ? [LEVEL_SMALL, LEVEL_ICONS, LEVEL_COLLAPSED] : [LEVEL_SMALL, LEVEL_COLLAPSED];
		for (const level of levels) {
			steps.push({ id: g.id, level, key: level + bias(g), index });
		}
	});
	steps.sort((a, b) => a.key - b.key || b.index - a.index || a.level - b.level);
	return steps.map(({ id, level }) => ({ id, level }));
}

/** The order in which groups move into the "More" drop-down: 'first' groups, then from the right. */
export function overflowOrder(groups: Array<{ id: string; priority?: string }>): string[] {
	return groups
		.map((g, index) => ({ id: g.id, key: bias(g), index }))
		.sort((a, b) => a.key - b.key || b.index - a.index)
		.map((x) => x.id);
}

function totalWidth(groups: GroupFitInput[], levels: Record<string, number>, gap: number): number {
	let w = 0;
	for (const g of groups) w += g.widths[levels[g.id] ?? LEVEL_FULL] ?? 0;
	return w + gap * Math.max(0, groups.length - 1);
}

function shrinkToFit(
	groups: GroupFitInput[],
	available: number,
	gap: number,
	iconOnly: boolean,
): { levels: Record<string, number>; used: number; fits: boolean } {
	const levels: Record<string, number> = {};
	for (const g of groups) levels[g.id] = LEVEL_FULL;
	const byId = new Map(groups.map((g) => [g.id, g]));
	let used = totalWidth(groups, levels, gap);
	if (used <= available) return { levels, used, fits: true };
	for (const step of shrinkSteps(groups, iconOnly)) {
		const g = byId.get(step.id);
		if (!g) continue;
		const current = levels[g.id] ?? LEVEL_FULL;
		// Skip steps that don't make the group narrower (a group of small buttons has no
		// "small" step, a one-button group gains nothing from collapsing).
		if (step.level <= current || !((g.widths[step.level] ?? 0) < (g.widths[current] ?? 0))) continue;
		levels[g.id] = step.level;
		used = totalWidth(groups, levels, gap);
		if (used <= available) return { levels, used, fits: true };
	}
	return { levels, used, fits: false };
}

/**
 * Fits a tab's groups into `available` pixels.
 *
 *   groups     [{ id, priority, widths: [w0, w1, w2, w3] }] in ribbon order
 *   available  width of the ribbon strip
 *   gap        space between two groups
 *   moreWidth  width of the "More" button, including its gap
 *   iconOnly   allow the icon-only level. The compact ribbon turns it off: dropping every
 *              label makes a two-row ribbon read like a toolbar of guesses, so it collapses
 *              whole groups into labelled drop-downs instead.
 *
 * Returns { levels: { [id]: 0..3 }, overflow: [ids in ribbon order], used }.
 * `used` is the width taken, including the "More" button when there is overflow.
 */
export function fitGroups({
	groups,
	available,
	gap = 0,
	moreWidth = 0,
	iconOnly = true,
}: {
	groups: GroupFitInput[];
	available: number;
	gap?: number;
	moreWidth?: number;
	iconOnly?: boolean;
}): GroupFit {
	const all = shrinkToFit(groups, available, gap, iconOnly);
	if (all.fits) return { levels: all.levels, overflow: [], used: all.used };

	const order = overflowOrder(groups);
	const hidden = new Set<string>();
	for (const id of order) {
		hidden.add(id);
		const rest = groups.filter((g) => !hidden.has(g.id));
		const fit = shrinkToFit(rest, available - moreWidth, gap, iconOnly);
		if (fit.fits || !rest.length) {
			return {
				levels: fit.levels,
				overflow: groups.filter((g) => hidden.has(g.id)).map((g) => g.id),
				used: fit.used + moreWidth,
			};
		}
	}
	return { levels: {}, overflow: groups.map((g) => g.id), used: moreWidth };
}

/**
 * Fits the tab labels into the tab row. Tabs that don't fit (from the right, never the
 * active one) move into a drop-down.
 *
 *   widths     width of each tab label, in order
 *   available  width of the tab area
 *   active     index of the active tab (-1 for none)
 *   moreWidth  width of the drop-down button
 *
 * Returns { visible: [indexes], overflow: [indexes] }.
 */
export function fitTabs({
	widths,
	available,
	active = -1,
	moreWidth = 0,
}: {
	widths: number[];
	available: number;
	active?: number;
	moreWidth?: number;
}): { visible: number[]; overflow: number[] } {
	const all = widths.map((_, i) => i);
	let used = widths.reduce((a, b) => a + b, 0);
	if (used <= available) return { visible: all, overflow: [] };
	const hidden = new Set<number>();
	used += moreWidth;
	for (let i = widths.length - 1; i >= 0 && used > available; i--) {
		if (i === active) continue;
		hidden.add(i);
		used -= widths[i] ?? 0;
	}
	return { visible: all.filter((i) => !hidden.has(i)), overflow: all.filter((i) => hidden.has(i)) };
}
