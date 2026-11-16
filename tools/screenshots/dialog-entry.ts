// Dev-only harness: opens the real Insert symbol dialog with the real stylesheet.
import type { App } from "obsidian";
import { SymbolModal } from "../../src/view/modals";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
document.body.className = `theme-${theme}`;

const app = {} as unknown as App;
const chosen: string[] = [];
const modal = new SymbolModal(app, (symbol) => {
	if (symbol !== null) chosen.push(symbol);
});
modal.open();

const input = document.querySelector<HTMLInputElement>(".rtb-symbol-search");
if (input && params.get("q")) {
	input.value = params.get("q") ?? "";
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

const w = window as unknown as Record<string, unknown>;
w.modal = modal;
w.chosen = chosen;
w.type = (value: string): void => {
	const el = document.querySelector<HTMLInputElement>(".rtb-symbol-search");
	if (!el) return;
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
};
w.press = (key: string): void => {
	document.querySelector<HTMLInputElement>(".rtb-symbol-search")?.dispatchEvent(
		new KeyboardEvent("keydown", { key, bubbles: true }),
	);
};
w.symbols = (): string[] =>
	Array.from(document.querySelectorAll<HTMLElement>(".rtb-symbol")).map((el) => el.textContent ?? "");
w.ready = true;
