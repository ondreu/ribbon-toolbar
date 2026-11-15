// Minimal stand-in for the parts of the Obsidian API the ribbon touches, for a headless browser.
type Info = { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null>; type?: string; href?: string } | string;

function apply(el: HTMLElement, o?: Info): void {
	if (o === undefined) return;
	if (typeof o === "string") {
		el.className = o;
		return;
	}
	if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
	if (o.text !== undefined) el.textContent = o.text;
	if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v !== null) el.setAttribute(k, String(v));
	if (o.type) el.setAttribute("type", o.type);
	if (o.href) el.setAttribute("href", o.href);
}

const P = HTMLElement.prototype as unknown as Record<string, unknown>;
const E = Element.prototype as unknown as Record<string, unknown>;
const N = Node.prototype as unknown as Record<string, unknown>;

P.createEl = function (this: HTMLElement, tag: string, o?: Info) {
	const el = document.createElement(tag);
	apply(el, o);
	this.appendChild(el);
	return el;
};
P.createDiv = function (this: HTMLElement, o?: Info) {
	return (this.createEl as (tag: string, o?: Info) => HTMLElement)("div", o);
};
P.createSpan = function (this: HTMLElement, o?: Info) {
	return (this.createEl as (tag: string, o?: Info) => HTMLElement)("span", o);
};
(window as unknown as Record<string, unknown>).createEl = (tag: string, o?: Info) => {
	const el = document.createElement(tag);
	apply(el, o);
	return el;
};
(window as unknown as Record<string, unknown>).activeDocument = document;
(window as unknown as Record<string, unknown>).activeWindow = window;
N.empty = function (this: Node) {
	while (this.firstChild) this.removeChild(this.firstChild);
};
N.detach = function (this: Node) {
	this.parentNode?.removeChild(this);
};
N.instanceOf = function (this: Node, type: new () => unknown) {
	return this instanceof type;
};
E.addClass = function (this: Element, ...c: string[]) {
	this.classList.add(...c);
};
E.removeClass = function (this: Element, ...c: string[]) {
	this.classList.remove(...c);
};
E.toggleClass = function (this: Element, c: string, v: boolean) {
	this.classList.toggle(c, v);
};
E.hasClass = function (this: Element, c: string) {
	return this.classList.contains(c);
};
E.setText = function (this: Element, t: string) {
	this.textContent = t;
};
E.getText = function (this: Element) {
	return this.textContent ?? "";
};
E.find = function (this: Element, s: string) {
	return this.querySelector(s);
};
E.findAll = function (this: Element, s: string) {
	return Array.from(this.querySelectorAll(s));
};
P.setCssProps = function (this: HTMLElement, props: Record<string, string>) {
	for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v);
};
P.setCssStyles = function (this: HTMLElement, props: Record<string, string>) {
	Object.assign(this.style, props);
};
P.setAttr = function (this: HTMLElement, key: string, value: string) {
	this.setAttribute(key, value);
};

export class Component {
	load(): void {}
	unload(): void {}
	addChild<T>(c: T): T {
		return c;
	}
	register(): void {}
}

interface MenuItemApi {
	setTitle(t: string): MenuItemApi;
	setIcon(): MenuItemApi;
	setChecked(): MenuItemApi;
	setDisabled(): MenuItemApi;
	setWarning(): MenuItemApi;
	setIsLabel(): MenuItemApi;
	setSection(): MenuItemApi;
	onClick(cb: () => void): MenuItemApi;
}

export class Menu {
	items: Array<{ title: string; disabled: boolean; cb: () => void }> = [];
	addItem(fn: (i: MenuItemApi) => void): this {
		const item = { title: "", disabled: false, cb: () => {} };
		const api: MenuItemApi = {
			setTitle(t: string) {
				item.title = t;
				return api;
			},
			setIcon() {
				return api;
			},
			setChecked() {
				return api;
			},
			setDisabled() {
				return api;
			},
			setWarning() {
				return api;
			},
			setIsLabel() {
				return api;
			},
			setSection() {
				return api;
			},
			onClick(cb: () => void) {
				item.cb = cb;
				return api;
			},
		};
		fn(api);
		this.items.push(item);
		return this;
	}
	addSeparator(): this {
		return this;
	}
	showAtMouseEvent(): void {
		(window as unknown as Record<string, unknown>).lastMenu = this;
	}
	showAtPosition(at: { x: number; y: number }): void {
		(window as unknown as Record<string, unknown>).lastMenu = this;
		(window as unknown as Record<string, unknown>).lastMenuAt = at;
	}
}

export class Notice {
	constructor(message: string) {
		const w = window as unknown as Record<string, unknown>;
		w.notices = [...((w.notices as string[] | undefined) ?? []), message];
	}
}

export class Scope {
	register(): void {}
	constructor(_parent?: unknown) {}
}

const LUCIDE = (window as unknown as Record<string, unknown>).LUCIDE as Record<string, string> | undefined;

export function getIcon(name: string): SVGSVGElement | null {
	if (!LUCIDE) return document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const svg = LUCIDE[name];
	if (!svg) return null;
	const holder = document.createElement("div");
	holder.innerHTML = svg;
	const el = holder.firstElementChild as SVGSVGElement;
	el.classList.add("svg-icon");
	return el;
}

export function setIcon(el: HTMLElement, name: string): void {
	el.textContent = "";
	el.setAttribute("data-icon", name);
	const svg = getIcon(name);
	if (svg && LUCIDE) el.appendChild(svg);
}

export function getIconIds(): string[] {
	return Object.keys(LUCIDE ?? {});
}

export class App {
	commands = {};
}

export interface Command {
	id: string;
	name: string;
	icon?: string;
}

export interface FuzzyMatch<T> {
	item: T;
	match: unknown;
}

export class FuzzySuggestModal<T> {
	modalEl = document.createElement("div");
	limit = 50;
	constructor(public app: unknown) {}
	setPlaceholder(): void {}
	setInstructions(): void {}
	getItems(): T[] {
		return [];
	}
	getItemText(): string {
		return "";
	}
	renderSuggestion(): void {}
	onChooseItem(): void {}
	open(): void {}
}

export class Modal {
	contentEl = document.createElement("div");
	titleEl = document.createElement("div");
	modalEl = document.createElement("div");
	constructor(public app: unknown) {}
	open(): void {
		this.onOpen();
	}
	close(): void {
		this.onClose();
	}
	onOpen(): void {}
	onClose(): void {}
}

interface SettingApi {
	setName(name: string): SettingApi;
	setDesc(desc: string): SettingApi;
	setHeading(): SettingApi;
	addSlider(cb: (slider: SliderApi) => void): SettingApi;
	addToggle(cb: (toggle: ToggleApi) => void): SettingApi;
	addText(cb: (text: TextApi) => void): SettingApi;
	addDropdown(cb: (dropdown: DropdownApi) => void): SettingApi;
	addButton(cb: (button: ButtonApi) => void): SettingApi;
}

interface SliderApi {
	setLimits(min: number, max: number, step: number): SliderApi;
	setValue(value: number): SliderApi;
	onChange(cb: (value: number) => void): SliderApi;
}
interface ToggleApi {
	setValue(value: boolean): ToggleApi;
	onChange(cb: (value: boolean) => void): ToggleApi;
}
interface TextApi {
	setValue(value: string): TextApi;
	onChange(cb: (value: string) => void): TextApi;
}
interface DropdownApi {
	addOption(value: string, label: string): DropdownApi;
	setValue(value: string): DropdownApi;
	onChange(cb: (value: string) => void): DropdownApi;
}
interface ButtonApi {
	setButtonText(text: string): ButtonApi;
	setCta(): ButtonApi;
	onClick(cb: () => void): ButtonApi;
}

export class Setting {
	constructor(private readonly containerEl: HTMLElement) {
		this.containerEl.createDiv("setting-item");
	}
	setName(name: string): SettingApi {
		this.containerEl.createDiv({ cls: "setting-item-name", text: name });
		return this as unknown as SettingApi;
	}
	setDesc(desc: string): SettingApi {
		this.containerEl.createDiv({ cls: "setting-item-description", text: desc });
		return this as unknown as SettingApi;
	}
	setHeading(): SettingApi {
		return this as unknown as SettingApi;
	}
	addSlider(cb: (slider: SliderApi) => void): SettingApi {
		const api: SliderApi = {
			setLimits: () => api,
			setValue: () => api,
			onChange: () => api,
		};
		cb(api);
		return this as unknown as SettingApi;
	}
	addToggle(cb: (toggle: ToggleApi) => void): SettingApi {
		const api: ToggleApi = { setValue: () => api, onChange: () => api };
		cb(api);
		return this as unknown as SettingApi;
	}
	addText(cb: (text: TextApi) => void): SettingApi {
		const api: TextApi = { setValue: () => api, onChange: () => api };
		cb(api);
		return this as unknown as SettingApi;
	}
	addDropdown(cb: (dropdown: DropdownApi) => void): SettingApi {
		const api: DropdownApi = { addOption: () => api, setValue: () => api, onChange: () => api };
		cb(api);
		return this as unknown as SettingApi;
	}
	addButton(cb: (button: ButtonApi) => void): SettingApi {
		const api: ButtonApi = { setButtonText: () => api, setCta: () => api, onClick: () => api };
		cb(api);
		return this as unknown as SettingApi;
	}
}

export const Platform = { isMobile: false, isPhone: false, isDesktop: true };
