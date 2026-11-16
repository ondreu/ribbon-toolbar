/*
 * The symbol catalogue behind Insert symbol.
 *
 * Every entry carries a Unicode character plus the words people actually type when they look
 * for it: the English name, the Czech name and the engineering sense (Ω is "ohm" and "odpor",
 * ∑ is "sum" and "součet"). Search scores all of those, so no one has to know the code point
 * or the English letter name.
 *
 * Plain Unicode text, never HTML: an inserted character survives every Markdown renderer.
 */

export type SymbolCategory =
	| "Greek"
	| "Math"
	| "Physics and units"
	| "Arrows"
	| "Currency"
	| "Typography"
	| "Marks"
	| "Fractions and powers";

export interface SymbolEntry {
	char: string;
	name: string;
	category: SymbolCategory;
	keywords?: readonly string[];
}

type Row = readonly [char: string, name: string, keywords?: readonly string[]];

function group(category: SymbolCategory, rows: readonly Row[]): SymbolEntry[] {
	return rows.map(([char, name, keywords]) => ({ char, name, category, keywords }));
}

export const SYMBOLS: readonly SymbolEntry[] = [
	...group("Greek", [
		["Α", "Alpha", ["alfa"]],
		["α", "alpha", ["alfa"]],
		["Β", "Beta", ["beta"]],
		["β", "beta", ["beta"]],
		["Γ", "Gamma", ["gama"]],
		["γ", "gamma", ["gama"]],
		["Δ", "Delta", ["změna", "difference", "difference operator"]],
		["δ", "delta", ["změna", "difference"]],
		["Ε", "Epsilon"],
		["ε", "epsilon", ["permittivity", "deformace", "strain"]],
		["Ζ", "Zeta"],
		["ζ", "zeta"],
		["Η", "Eta"],
		["η", "eta", ["účinnost", "efficiency", "viscosity", "viskozita"]],
		["Θ", "Theta", ["úhel", "angle"]],
		["θ", "theta", ["úhel", "angle"]],
		["Ι", "Iota"],
		["ι", "iota"],
		["Κ", "Kappa"],
		["κ", "kappa"],
		["Λ", "Lambda", ["vlnová délka", "wavelength"]],
		["λ", "lambda", ["vlnová délka", "wavelength"]],
		["Μ", "Mu", ["mí", "mikro", "micro"]],
		["μ", "mu", ["mí", "mikro", "micro", "permeability", "permeabilita"]],
		["Ν", "Nu", ["ný"]],
		["ν", "nu", ["ný", "frekvence", "frequency", "kinematická viskozita"]],
		["Ξ", "Xi", ["ksí"]],
		["ξ", "xi", ["ksí"]],
		["Ο", "Omicron", ["omikron"]],
		["ο", "omicron", ["omikron"]],
		["Π", "Pi", ["pí", "kruh", "circle"]],
		["π", "pi", ["pí", "kruh", "circle", "3,14"]],
		["Ρ", "Rho", ["ró"]],
		["ρ", "rho", ["ró", "hustota", "density", "měrný odpor", "resistivity"]],
		["Σ", "Sigma", ["suma", "součet", "sum"]],
		["σ", "sigma", ["suma", "součet", "sum", "směrodatná odchylka", "standard deviation", "měrná vodivost"]],
		["Τ", "Tau", ["tau"]],
		["τ", "tau", ["časová konstanta", "time constant", "smykové napětí", "shear stress"]],
		["Υ", "Upsilon", ["ypsilon"]],
		["υ", "upsilon", ["ypsilon"]],
		["Φ", "Phi", ["fí", "fáze", "phase", "flux"]],
		["φ", "phi", ["fí", "fáze", "phase", "flux", "průměr", "diameter"]],
		["Χ", "Chi", ["chí"]],
		["χ", "chi", ["chí"]],
		["Ψ", "Psi", ["psí"]],
		["ψ", "psi", ["psí", "vlnová funkce", "wave function"]],
		["Ω", "Omega", ["ohm", "ómega", "odpor", "resistance", "impedance", "úhlová frekvence", "angular frequency"]],
		["ω", "omega", ["ohm", "ómega", "odpor", "resistance", "impedance", "úhlová frekvence", "angular frequency", "úhlová rychlost"]],
		["ϑ", "theta symbol", ["varianta theta", "variant"]],
		["ϕ", "phi symbol", ["varianta phi", "varianta fí", "variant"]],
		["ϵ", "lunate epsilon", ["varianta epsilon", "variant"]],
		["ς", "final sigma", ["koncové sigma", "variant"]],
	]),
	...group("Math", [
		["±", "plus-minus", ["plus mínus", "plusminus", "tolerance"]],
		["×", "multiplication sign", ["krát", "krat", "násobení", "nasobeni", "times", "multiply"]],
		["÷", "division sign", ["děleno", "deleno", "dělení", "deleni", "divide"]],
		["≈", "almost equal", ["přibližně", "priblizne", "approximately", "rovná se přibližně"]],
		["≠", "not equal", ["nerovná se", "nerovna se", "not equal"]],
		["≤", "less than or equal", ["menší nebo rovno", "mensi nebo rovno", "leq"]],
		["≥", "greater than or equal", ["větší nebo rovno", "vetsi nebo rovno", "geq"]],
		["≪", "much less than", ["mnohem menší", "mnohem mensi"]],
		["≫", "much greater than", ["mnohem větší", "mnohem vetsi"]],
		["∞", "infinity", ["nekonečno", "nekonecno", "infinity"]],
		["√", "square root", ["odmocnina", "druhá odmocnina", "sqrt", "root"]],
		["∛", "cube root", ["třetí odmocnina", "treti odmocnina"]],
		["∑", "n-ary summation", ["suma", "součet", "soucet", "sum", "sigma"]],
		["∏", "n-ary product", ["součin", "soucin", "product"]],
		["∫", "integral", ["integrál", "integral"]],
		["∬", "double integral", ["dvojný integrál", "dvojny integral"]],
		["∂", "partial differential", ["parciální derivace", "parcialni derivace", "partial"]],
		["∇", "nabla", ["gradient", "nabla", "operátor"]],
		["∆", "increment", ["přírůstek", "prirustek", "delta", "změna"]],
		["∈", "element of", ["je prvkem", "patří do", "belongs to"]],
		["∉", "not an element of", ["není prvkem", "not element"]],
		["⊂", "subset of", ["podmnožina", "podmnozina", "subset"]],
		["⊃", "superset of", ["nadmnožina", "nadmnozina", "superset"]],
		["∪", "union", ["sjednocení", "sjednoceni", "union"]],
		["∩", "intersection", ["průnik", "prunik", "intersection"]],
		["∅", "empty set", ["prázdná množina", "prazdna mnozina", "empty set", "průměr", "prumer", "diameter"]],
		["≡", "identical to", ["identicky", "totožné", "equivalent"]],
		["≅", "approximately equal to", ["kongruentní", "kongruentni", "přibližně rovno"]],
		["∝", "proportional to", ["úměrné", "umerne", "proportional"]],
		["∴", "therefore", ["tedy", "proto", "therefore"]],
		["∵", "because", ["protože", "protoze", "because"]],
		["∠", "angle", ["úhel", "uhel", "angle"]],
		["⊥", "perpendicular", ["kolmý", "kolmy", "kolmice", "perpendicular"]],
		["∥", "parallel", ["rovnoběžný", "rovnobezny", "parallel"]],
		["¬", "not sign", ["negace", "not", "logická negace"]],
		["∧", "logical and", ["a", "konjunkce", "logický součin", "and", "conjunction"]],
		["∨", "logical or", ["nebo", "disjunkce", "logický součet", "or", "disjunction"]],
		["⊕", "exclusive or", ["xor", "exkluzivní nebo"]],
		["⊗", "tensor product", ["tenzorový součin", "tensor product"]],
		["⌈", "left ceiling", ["ceil", "horní celá část"]],
		["⌉", "right ceiling", ["ceil"]],
		["⌊", "left floor", ["floor", "dolní celá část"]],
		["⌋", "right floor", ["floor"]],
	]),
	...group("Physics and units", [
		["µ", "micro sign", ["mikro", "micro", "mikrometr", "μm", "mikrofarad", "µF"]],
		["°", "degree sign", ["stupeň", "stupen", "degree", "teplota", "úhel"]],
		["℃", "degree celsius", ["celsius", "stupně celsia", "°c"]],
		["℉", "degree fahrenheit", ["fahrenheit", "stupně fahrenheita", "°f"]],
		["Å", "angstrom sign", ["angström", "angstrom", "0,1 nm"]],
		["⌀", "diameter sign", ["průměr", "prumer", "diameter", "ø"]],
		["Ø", "latin capital letter o with stroke", ["průměr", "prumer", "diameter", "ø"]],
		["ℏ", "planck constant over two pi", ["hbar", "planck", "redukovaná planckova konstanta"]],
		["ℓ", "script small l", ["litr", "liter", "litre"]],
		["%", "percent sign", ["procento", "procenta", "percent"]],
	]),
	...group("Arrows", [
		["→", "rightwards arrow", ["vpravo", "doprava", "šipka", "sipka", "right", "to"]],
		["←", "leftwards arrow", ["vlevo", "doleva", "šipka", "sipka", "left"]],
		["↑", "upwards arrow", ["nahoru", "šipka", "sipka", "up"]],
		["↓", "downwards arrow", ["dolů", "dolu", "šipka", "sipka", "down"]],
		["↔", "left right arrow", ["obousměrná", "obousmerna", "šipka", "left right"]],
		["↕", "up down arrow", ["svislá", "svisla", "up down"]],
		["⇒", "rightwards double arrow", ["vyplývá", "vyplyva", "implies", "then"]],
		["⇐", "leftwards double arrow", ["implied by"]],
		["⇔", "left right double arrow", ["ekvivalent", "právě když", "pravě když", "iff"]],
		["⇄", "rightwards arrow over leftwards arrow", ["výměna", "vymena", "swap"]],
		["⇅", "upwards arrow leftwards of downwards arrow", ["swap"]],
		["↦", "rightwards arrow from bar", ["maps to", "zobrazuje na"]],
		["⟶", "long rightwards arrow", ["dlouhá šipka", "long arrow"]],
		["⟵", "long leftwards arrow", ["dlouhá šipka", "long arrow"]],
		["↗", "north east arrow", ["šikmo nahoru doprava", "diagonal"]],
		["↘", "south east arrow", ["šikmo dolů doprava", "diagonal"]],
		["↖", "north west arrow", ["šikmo nahoru doleva", "diagonal"]],
		["↙", "south west arrow", ["šikmo dolů doleva", "diagonal"]],
		["↺", "anticlockwise open circle arrow", ["zpět", "zpet", "undo", "rotate"]],
		["↻", "clockwise open circle arrow", ["znovu", "redo", "refresh", "rotate"]],
		["⟳", "clockwise gapped circle arrow", ["refresh", "reload", "rotate"]],
		["⤴", "arrow pointing rightwards then curving upwards", ["odbočit nahoru", "turn up"]],
		["⤵", "arrow pointing rightwards then curving downwards", ["odbočit dolů", "turn down"]],
		["↩", "leftwards arrow with hook", ["enter", "odřádkování", "odradkovani", "return"]],
		["↪", "rightwards arrow with hook", ["tab", "reply"]],
		["⇥", "rightwards arrow to bar", ["tab", "tabulátor", "tabulator"]],
		["⇤", "leftwards arrow to bar", ["backtab", "tabulátor"]],
	]),
	...group("Currency", [
		["€", "euro sign", ["euro", "eura", "eur"]],
		["$", "dollar sign", ["dolar", "dollar", "usd"]],
		["£", "pound sign", ["libra", "pound", "gbp"]],
		["¥", "yen sign", ["jen", "yen", "jpy"]],
		["¢", "cent sign", ["cent"]],
		["₹", "indian rupee sign", ["rupie", "rupee", "inr"]],
		["₽", "ruble sign", ["rubl", "ruble", "rub"]],
		["₩", "won sign", ["won", "krw"]],
		["₪", "new shekel sign", ["šekel", "shekel", "ils"]],
		["₿", "bitcoin sign", ["bitcoin", "btc"]],
		["₺", "turkish lira sign", ["lira", "try"]],
		["₴", "hryvnia sign", ["hřivna", "hryvnia", "uah"]],
		["₦", "naira sign", ["naira", "ngn"]],
		["₱", "peso sign", ["peso", "php"]],
		["₡", "colon sign", ["colon", "crc"]],
		["₫", "dong sign", ["dong", "vnd"]],
		["Kč", "Czech koruna", ["koruna", "koruny", "kc", "kč", "czk"]],
	]),
	...group("Typography", [
		["—", "em dash", ["dlouhá pomlčka", "dlouha pomlcka", "pomlčka", "dash"]],
		["–", "en dash", ["pomlčka", "pomlcka", "rozsah", "range", "dash"]],
		["…", "horizontal ellipsis", ["tři tečky", "tri tecky", "trojtečka", "ellipsis"]],
		["•", "bullet", ["odrážka", "odrazka", "bullet", "tečka"]],
		["·", "middle dot", ["střední tečka", "stredni tecka", "interpunct"]],
		["§", "section sign", ["paragraf", "section"]],
		["¶", "pilcrow sign", ["odstavec", "paragraph"]],
		["©", "copyright sign", ["autorské právo", "autorske pravo", "copyright"]],
		["®", "registered sign", ["registrovaná známka", "registrovana znamka", "registered"]],
		["™", "trade mark sign", ["ochranná známka", "ochranna znamka", "trademark"]],
		["†", "dagger", ["křížek", "krizek", "poznámka pod čarou", "dagger"]],
		["‡", "double dagger", ["dvojitý křížek", "double dagger"]],
		["«", "left guillemet", ["francouzské uvozovky", "uvozovka", "guillemet"]],
		["»", "right guillemet", ["francouzské uvozovky", "uvozovka", "guillemet"]],
		["‹", "single left guillemet", ["uvozovka", "guillemet"]],
		["›", "single right guillemet", ["uvozovka", "guillemet"]],
		["„", "double low quoted bracket", ["české uvozovky", "ceske uvozovky", "uvozovka", "quotes"]],
		["“", "left double quotation mark", ["uvozovka", "quotes", "opening quote"]],
		["”", "right double quotation mark", ["uvozovka", "quotes", "closing quote"]],
		["‚", "single low quoted bracket", ["uvozovka", "quotes"]],
		["‘", "left single quotation mark", ["uvozovka", "apostrof", "quotes"]],
		["’", "right single quotation mark", ["uvozovka", "apostrof", "apostrophe", "quotes"]],
		["⟨", "left angle bracket", ["matice", "závorka", "zavorka", "angle bracket"]],
		["⟩", "right angle bracket", ["matice", "závorka", "zavorka", "angle bracket"]],
		["\u00A0", "no-break space", ["nedělitelná mezera", "nedelitelna mezera", "nbsp", "mezera", "space"]],
		["\u00AD", "soft hyphen", ["měkký spojovník", "mekky spojovnik", "soft hyphen"]],
	]),
	...group("Marks", [
		["✓", "check mark", ["fajfka", "zaškrtnuto", "zaskrtnuto", "hotovo", "check", "done", "yes"]],
		["✔", "heavy check mark", ["fajfka", "check", "done"]],
		["✗", "ballot x", ["křížek", "krizek", "ne", "chyba", "cross", "no"]],
		["✘", "heavy ballot x", ["křížek", "chyba", "cross"]],
		["☐", "ballot box", ["čtvereček", "ctverecek", "checkbox", "zaškrtávací políčko"]],
		["☑", "ballot box with check", ["zaškrtnutý čtvereček", "zaskrtnuty ctverecek", "checkbox", "checked"]],
		["☒", "ballot box with x", ["křížkový čtvereček", "checkbox", "crossed"]],
		["●", "black circle", ["kolečko", "kolecko", "tečka", "filled circle"]],
		["○", "white circle", ["kroužek", "krouzek", "circle"]],
		["◐", "circle with left half black", ["půlkruh", "pulkruh", "half circle"]],
		["◑", "circle with right half black", ["půlkruh", "pulkruh", "half circle"]],
		["■", "black square", ["čtverec", "ctverec", "filled square"]],
		["□", "white square", ["čtverec", "ctverec", "square"]],
		["▲", "black up-pointing triangle", ["trojúhelník nahoru", "trojuhelnik nahoru", "triangle"]],
		["▼", "black down-pointing triangle", ["trojúhelník dolů", "trojuhelnik dolu", "triangle"]],
		["◆", "black diamond", ["kosočtverec", "kosostverec", "diamond"]],
		["◇", "white diamond", ["kosočtverec", "diamond"]],
		["★", "black star", ["hvězdička", "hvezdicka", "oblíbené", "oblibene", "star"]],
		["☆", "white star", ["hvězdička", "hvezdicka", "star"]],
		["♥", "black heart suit", ["srdce", "heart"]],
		["♡", "white heart suit", ["srdce", "heart"]],
		["☺", "white smiling face", ["smajlík", "smajlik", "smiley"]],
		["☹", "white frowning face", ["smutný", "smutny", "sad"]],
		["⚠", "warning sign", ["varování", "varovani", "pozor", "warning"]],
		["⚡", "high voltage sign", ["elektro", "blesk", "napětí", "napeti", "voltage", "flash"]],
	]),
	...group("Fractions and powers", [
		["½", "vulgar fraction one half", ["jedna polovina", "polovina", "half"]],
		["⅓", "vulgar fraction one third", ["jedna třetina", "tretina", "third"]],
		["⅔", "vulgar fraction two thirds", ["dvě třetiny", "dve tretiny", "two thirds"]],
		["¼", "vulgar fraction one quarter", ["čtvrtina", "ctvrtina", "quarter"]],
		["¾", "vulgar fraction three quarters", ["tři čtvrtiny", "tri ctvrtiny", "three quarters"]],
		["⅕", "vulgar fraction one fifth", ["pětina", "petina", "fifth"]],
		["⅖", "vulgar fraction two fifths", ["dvě pětiny", "two fifths"]],
		["⅗", "vulgar fraction three fifths", ["tři pětiny", "three fifths"]],
		["⅘", "vulgar fraction four fifths", ["čtyři pětiny", "four fifths"]],
		["⅙", "vulgar fraction one sixth", ["šestina", "sestina", "sixth"]],
		["⅚", "vulgar fraction five sixths", ["pět šestin", "five sixths"]],
		["⅛", "vulgar fraction one eighth", ["osmina", "eighth"]],
		["⅜", "vulgar fraction three eighths", ["tři osminy", "three eighths"]],
		["⅝", "vulgar fraction five eighths", ["pět osmin", "five eighths"]],
		["⅞", "vulgar fraction seven eighths", ["sedm osmin", "seven eighths"]],
		["⁰", "superscript zero", ["mocnina", "na nultou", "superscript"]],
		["¹", "superscript one", ["mocnina", "na prvou", "superscript"]],
		["²", "superscript two", ["mocnina", "na druhou", "čtvereční", "ctverecni", "squared", "superscript"]],
		["³", "superscript three", ["mocnina", "na třetí", "na treti", "kubický", "kubicky", "cubed", "superscript"]],
		["⁴", "superscript four", ["mocnina", "na čtvrtou", "superscript"]],
		["⁵", "superscript five", ["mocnina", "na pátou", "superscript"]],
		["⁶", "superscript six", ["mocnina", "superscript"]],
		["⁷", "superscript seven", ["mocnina", "superscript"]],
		["⁸", "superscript eight", ["mocnina", "superscript"]],
		["⁹", "superscript nine", ["mocnina", "superscript"]],
		["₀", "subscript zero", ["index", "dolní index", "subscript"]],
		["₁", "subscript one", ["index", "dolní index", "subscript"]],
		["₂", "subscript two", ["index", "dolní index", "subscript"]],
		["₃", "subscript three", ["index", "dolní index", "subscript"]],
		["₄", "subscript four", ["index", "dolní index", "subscript"]],
		["₅", "subscript five", ["index", "dolní index", "subscript"]],
		["₆", "subscript six", ["index", "dolní index", "subscript"]],
		["₇", "subscript seven", ["index", "dolní index", "subscript"]],
		["₈", "subscript eight", ["index", "dolní index", "subscript"]],
		["₉", "subscript nine", ["index", "dolní index", "subscript"]],
	]),
];

export const SYMBOL_CATEGORIES: readonly SymbolCategory[] = [
	"Greek",
	"Math",
	"Physics and units",
	"Arrows",
	"Currency",
	"Typography",
	"Marks",
	"Fractions and powers",
];

interface IndexedSymbol {
	entry: SymbolEntry;
	char: string;
	name: string;
	keywords: readonly string[];
	category: string;
	order: number;
}

/** Diacritics out, lowercase, trimmed: "MÍ" and "mikro" have to meet in the middle. */
export function normalizeSymbolQuery(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

const INDEX: readonly IndexedSymbol[] = SYMBOLS.map((entry, order) => ({
	entry,
	char: normalizeSymbolQuery(entry.char),
	name: normalizeSymbolQuery(entry.name),
	keywords: (entry.keywords ?? []).map(normalizeSymbolQuery),
	category: normalizeSymbolQuery(entry.category),
	order,
}));

/**
 * 0 is the best possible hit. Every additional step is a weaker reason to show the symbol, so
 * "ohm" beats a symbol whose Czech keyword merely contains the letters somewhere.
 */
function rankToken(item: IndexedSymbol, token: string): number | null {
	if (item.char === token) return 0;
	if (item.name === token) return 1;
	if (item.keywords.includes(token)) return 1.5;
	if (item.name.startsWith(token)) return 2;
	if (item.keywords.some((keyword) => keyword.startsWith(token))) return 2.5;
	if (item.name.includes(token)) return 3;
	if (item.keywords.some((keyword) => keyword.includes(token))) return 3.5;
	if (item.category.includes(token)) return 5;
	return null;
}

/**
 * Ranked search over names, Czech keywords, engineering senses and categories. Every word of
 * the query has to match, so "arrow right" narrows instead of widening. An empty query returns
 * the catalogue in its curated order, which is what the grouped palette shows.
 */
export function searchSymbols(query: string): SymbolEntry[] {
	const normalized = normalizeSymbolQuery(query);
	if (normalized === "") return SYMBOLS.map((entry) => entry);

	const tokens = normalized.split(/\s+/).filter((token) => token !== "");
	const ranked: { item: IndexedSymbol; score: number }[] = [];
	for (const item of INDEX) {
		let score = 0;
		let matched = true;
		for (const token of tokens) {
			const tokenScore = rankToken(item, token);
			if (tokenScore === null) {
				matched = false;
				break;
			}
			score += tokenScore;
		}
		if (matched) ranked.push({ item, score });
	}

	ranked.sort((a, b) => a.score - b.score || a.item.order - b.item.order);
	return ranked.map(({ item }) => item.entry);
}
