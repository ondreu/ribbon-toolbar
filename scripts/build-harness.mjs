/**
 * Builds the dev-only render harness in tools/screenshots.
 *
 * The harness renders the real RibbonView and the real styles.css in a plain browser, so the
 * ribbon can be judged (and screenshotted) without launching Obsidian. Both generated files are
 * ignored by git: the icon set is 1.3 MB and only the harness needs it.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const iconDir = "node_modules/lucide-static/icons";
const files = readdirSync(iconDir).filter((file) => file.endsWith(".svg"));
const icons = {};
for (const file of files) icons[file.slice(0, -4)] = readFileSync(`${iconDir}/${file}`, "utf8");
writeFileSync("tools/screenshots/icons.js", `window.LUCIDE=${JSON.stringify(icons)};`);

const builds = [
	["tools/screenshots/entry.ts", "tools/screenshots/bundle.js"],
	["tools/screenshots/dialog-entry.ts", "tools/screenshots/dialog.js"],
];

for (const [entry, outfile] of builds) {
	execFileSync(
		"./node_modules/.bin/esbuild",
		[
			entry,
			"--bundle",
			"--format=iife",
			`--alias:obsidian=${process.cwd()}/tools/screenshots/obsidian-shim.ts`,
			`--outfile=${outfile}`,
			"--log-level=warning",
		],
		{ stdio: "inherit" },
	);
}

process.stdout.write(`Harness ready: tools/screenshots/page.html (${files.length} icons)\n`);
