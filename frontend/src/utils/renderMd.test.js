import { describe, it, expect } from "vitest";
import { renderMd } from "./renderMd";

describe("renderMd", () => {
  it("returns empty string for null", () => {
    expect(renderMd(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(renderMd("")).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(renderMd(undefined)).toBe("");
  });

  it("renders headings", () => {
    const result = renderMd("# Hello");
    expect(result).toContain("font-weight:700");
    expect(result).toContain("Hello");
    // The "# " markdown prefix should be stripped from the visible text
    expect(result).not.toContain("# Hello");
  });

  it("renders h2 headings", () => {
    const result = renderMd("## Subtitle");
    expect(result).toContain("font-weight:700");
    expect(result).toContain("Subtitle");
  });

  it("renders bullet lists with dash", () => {
    const result = renderMd("- Item 1\n- Item 2");
    expect(result).toContain("<ul");
    expect(result).toContain("<li");
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
  });

  it("renders bullet lists with asterisk", () => {
    const result = renderMd("* Item A");
    expect(result).toContain("<ul");
    expect(result).toContain("<li");
    expect(result).toContain("Item A");
  });

  it("renders code blocks", () => {
    const result = renderMd("```\nconst x = 1;\n```");
    expect(result).toContain('<pre class="md-code">');
    expect(result).toContain("const x = 1;");
  });

  it("renders bold text", () => {
    const result = renderMd("This is **bold** text");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("renders inline code", () => {
    const result = renderMd("Use `console.log` here");
    expect(result).toContain('<code class="md-ic">console.log</code>');
  });

  it("renders plain paragraphs", () => {
    const result = renderMd("Hello world");
    expect(result).toContain("<p");
    expect(result).toContain("Hello world");
  });

  it("renders empty lines as br", () => {
    const result = renderMd("Line 1\n\nLine 2");
    expect(result).toContain("<br/>");
  });

  it("closes open list before heading", () => {
    const result = renderMd("- item\n# Heading");
    expect(result).toContain("</ul>");
    expect(result).toContain("Heading");
  });

  it("closes open list at end", () => {
    const result = renderMd("- item 1\n- item 2");
    expect(result).toContain("</ul>");
  });

  it("handles mixed content", () => {
    const md = "# Title\n\nSome text\n\n- bullet\n\n```\ncode\n```";
    const result = renderMd(md);
    expect(result).toContain("Title");
    expect(result).toContain("Some text");
    expect(result).toContain("<li");
    expect(result).toContain('<pre class="md-code">');
  });
});
