import { describe, expect, it } from "vitest";
import { addLinePrefix, expandToLines, insertBlock, setHeading, tableMarkdown, toggleInline, toggleLinePrefix, toggleTag } from "../src/format/text";
import { applyColor, applyHighlight, clearHtml } from "../src/format/html";

describe("toggleInline", () => {
	it("wraps a selection", () => {
		const edit = toggleInline("make me bold", 8, 12, "**");
		expect(edit.text).toBe("make me **bold**");
		expect(edit.text.slice(edit.from, edit.to)).toBe("bold");
	});

	it("unwraps when the selection includes the markers", () => {
		expect(toggleInline("a **bold** b", 2, 10, "**").text).toBe("a bold b");
	});

	it("unwraps when the markers sit just outside the selection", () => {
		const edit = toggleInline("a **bold** b", 4, 8, "**");
		expect(edit.text).toBe("a bold b");
		expect(edit.from).toBe(2);
		expect(edit.to).toBe(6);
	});

	it("inserts an empty pair at the cursor and puts the caret inside", () => {
		const edit = toggleInline("hello", 5, 5, "**");
		expect(edit.text).toBe("hello****");
		expect(edit.from).toBe(7);
		expect(edit.to).toBe(7);
	});

	it("handles different opening and closing markers", () => {
		const edit = toggleInline("hello", 0, 5, "<u>", "</u>");
		expect(edit.text).toBe("<u>hello</u>");
	});
});

describe("toggleTag", () => {
	it("wraps in sub and sup", () => {
		expect(toggleTag("H2O", 1, 2, "sub").text).toBe("H<sub>2</sub>O");
		expect(toggleTag("x2", 1, 2, "sup").text).toBe("x<sup>2</sup>");
	});

	it("unwraps a tag that is already there", () => {
		expect(toggleTag("H<sub>2</sub>O", 6, 7, "sub").text).toBe("H2O");
	});
});

describe("setHeading", () => {
	it("adds a heading to the current line only", () => {
		expect(setHeading("one\ntwo", 0, 0, 2).text).toBe("## one\ntwo");
	});

	it("replaces an existing level instead of stacking hashes", () => {
		expect(setHeading("### one", 0, 0, 1).text).toBe("# one");
	});

	it("sets every selected line and keeps indentation", () => {
		const edit = setHeading("  one\n\t# two\nthree", 0, 17, 3);
		expect(edit.text).toBe("  ### one\n\t### two\n### three");
	});

	it("turns a heading back into a paragraph", () => {
		expect(setHeading("## one", 0, 0, 0).text).toBe("one");
	});

	it("leaves fenced code blocks untouched", () => {
		const text = "```\nconst x = 1;\n```\n## title";
		expect(setHeading(text, 0, text.length, 1).text).toBe("```\nconst x = 1;\n```\n# title");
		expect(addLinePrefix(text, 0, text.length, "- [ ] ").text).toBe("```\nconst x = 1;\n```\n- [ ] ## title");
	});
});

describe("toggleLinePrefix", () => {
	it("adds a task prefix to every non-empty line", () => {
		expect(toggleLinePrefix("one\n\ntwo", 0, 8, "- [ ] ").text).toBe("- [ ] one\n\n- [ ] two");
	});

	it("removes it when every line has it", () => {
		expect(toggleLinePrefix("- [ ] one\n- [ ] two", 0, 18, "- [ ] ").text).toBe("one\ntwo");
	});

	it("keeps list indentation", () => {
		expect(toggleLinePrefix("  item", 0, 6, "- [ ] ").text).toBe("  - [ ] item");
	});
});

describe("addLinePrefix", () => {
	it("turns a line into a task and leaves an existing task alone", () => {
		expect(addLinePrefix("buy milk", 0, 0, "- [ ] ").text).toBe("- [ ] buy milk");
		expect(addLinePrefix("- [ ] buy milk", 0, 0, "- [ ] ").text).toBe("- [ ] buy milk");
	});

	it("keeps indentation", () => {
		expect(addLinePrefix("  buy milk", 0, 0, "- [ ] ").text).toBe("  - [ ] buy milk");
	});
});

describe("insertBlock", () => {
	it("puts a table on its own lines and leaves a blank line before it", () => {
		const edit = insertBlock("text", 4, "| a |");
		expect(edit.text).toBe("text\n\n| a |\n");
		expect(edit.from).toBe(4 + 2 + 5);
	});

	it("does not double a blank line that is already there", () => {
		expect(insertBlock("text\n\n", 6, "| a |").text).toBe("text\n\n| a |\n");
	});

	it("honours an explicit caret inside the block", () => {
		const edit = insertBlock("", 0, "**bold**", 2);
		expect(edit.from).toBe(2);
	});
});

describe("tableMarkdown", () => {
	it("makes a header, a separator and the requested rows", () => {
		const lines = tableMarkdown(3, 2).split("\n");
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe("| Column 1 | Column 2 |");
		expect(lines[1]).toBe("| --- | --- |");
		expect(lines[2]?.split("|").length).toBe(4);
	});

	it("clamps silly sizes", () => {
		expect(tableMarkdown(0, 0).split("\n")).toHaveLength(3);
	});
});

describe("expandToLines", () => {
	it("covers whole lines around the selection", () => {
		const text = "one\ntwo\nthree";
		expect(expandToLines(text, 5, 6)).toEqual({ from: 4, to: 7 });
	});
});

describe("HTML formatting", () => {
	it("wraps a selection in a coloured span", () => {
		expect(applyColor("hello", 0, 5, "#C00000").text).toBe('<span style="color: #C00000">hello</span>');
	});

	it("replaces the colour instead of nesting spans", () => {
		const start = '<span style="color: #C00000">hello</span>';
		const at = start.indexOf("hello");
		const edit = applyColor(start, at, at + 5, "#0070C0");
		expect(edit.text).toBe('<span style="color: #0070C0">hello</span>');
	});

	it("removes the wrapper when the colour is null", () => {
		const start = '<span style="color: #C00000">hello</span>';
		const at = start.indexOf("hello");
		expect(applyColor(start, at, at + 5, null).text).toBe("hello");
	});

	it("removes colour from two adjacent spans without corrupting the boundary", () => {
		const text = '<span style="color: #C00000">a</span><span style="color: #0070C0">b</span>';
		expect(applyColor(text, 0, text.length, null).text).toBe("ab");
	});

	it("leaves a selection inside a tag attribute untouched", () => {
		const text = '<span style="color: red">hello</span>';
		const at = text.indexOf("red");
		expect(applyColor(text, at, at + 3, "#00B050").text).toBe(text);
		expect(clearHtml(text, at, at + 3).text).toBe(text);
	});

	it("wraps a highlight in a mark", () => {
		expect(applyHighlight("hi", 0, 2, "#FFF2A8").text).toBe('<mark style="background-color: #FFF2A8">hi</mark>');
	});

	it("strips inline HTML from the selection", () => {
		expect(clearHtml("<u>a</u> <sub>b</sub>", 0, 21).text).toBe("a b");
	});
});
