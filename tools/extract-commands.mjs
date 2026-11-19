/*
 * Regenerates tests/fixtures/obsidian-commands.json from an Obsidian app.asar.
 *
 *   npx @electron/asar extract <obsidian>/resources/obsidian.asar /tmp/obs
 *   node tools/extract-commands.mjs /tmp/obs/app.js
 *
 * The fixture is the list of command ids Obsidian itself registers (core and core plugins).
 * tests/defaults.test.ts fails when a default button points at an id that is not in here, so a
 * typo or an id removed by an Obsidian update cannot ship as a dead button.
 */
import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) {
	console.error("usage: node tools/extract-commands.mjs path/to/app.js");
	process.exit(1);
}
const text = readFileSync(source, "utf8");
const ids = new Set();

for (const match of text.matchAll(/addCommand\(\{\s*id:\s*"([^"]+)"/g)) ids.add(match[1]);
for (const match of text.matchAll(/registerGlobalCommand\(\{id:"([^"]+)"/g)) ids.add(match[1]);
// Generated commands: a template id plus a loop over the variable.
for (let level = 1; level <= 6; level += 1) ids.add(`editor:set-heading-${level}`);
for (const colour of ["red", "orange", "yellow", "green", "blue", "purple"]) ids.add(`editor:toggle-highlight-${colour}`);
for (let tab = 1; tab <= 8; tab += 1) ids.add(`workspace:goto-tab-${tab}`);
// `editor:table-` + name, registered through a small helper.
for (const match of text.matchAll(/r\("([a-z-]+)",w\.table\./g)) ids.add(`editor:table-${match[1]}`);

const payload = {
	generatedFrom: "Obsidian 1.15.1 (obsidian.asar app.js)",
	ids: [...ids].filter((id) => !id.endsWith("-") && !id.endsWith(":")).sort(),
};
writeFileSync("tests/fixtures/obsidian-commands.json", `${JSON.stringify(payload, null, "\t")}\n`);
console.log(`${payload.ids.length} command ids written to tests/fixtures/obsidian-commands.json`);
