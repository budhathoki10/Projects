import { describe, expect, it } from "vitest";
import { htmlToText, looksLikeHtml, stripHtmlDeep } from "@/lib/jobs/html";

describe("job text that arrives as HTML", () => {
  it("reads escaped HTML (as job boards embed it) as clean text, not literal tags", () => {
    const escaped = "&lt;ul&gt;&lt;li&gt;Experience with Git&lt;/li&gt;&lt;li&gt;Knowledge of &lt;strong&gt;SQL&lt;/strong&gt;&lt;/li&gt;&lt;/ul&gt;&lt;br&gt;&lt;br&gt;Location: Kathmandu";
    const text = htmlToText(escaped);
    expect(text).not.toMatch(/<\/?(li|ul|strong|br)/);
    expect(text).toContain("• Experience with Git");
    expect(text).toContain("Knowledge of SQL");
    expect(text).toContain("Location: Kathmandu");
  });

  it("recognises markup, escaped or not, and leaves ordinary text alone", () => {
    expect(looksLikeHtml("<li>Git</li>")).toBe(true);
    expect(looksLikeHtml("&lt;li&gt;Git")).toBe(true);
    expect(looksLikeHtml("Salary < 2000 and > 1000")).toBe(false);
    expect(looksLikeHtml("C++ and C#")).toBe(false);
  });

  it("cleans every string in a saved record, one line for single-line fields", () => {
    const saved = {
      post: { title: "Trainee", requirements: [{ text: "Verify: <br><br></strong><ul><li>A degree in CS</li><li>Some SQL</li></ul>", keywords: ["SQL"] }] },
      postText: "Line one\n<li>Item</li>",
      createdAt: new Date("2026-10-31"),
    };
    const clean = stripHtmlDeep(saved);
    expect(clean.post.requirements[0].text).toBe("Verify: · A degree in CS · Some SQL");
    expect(clean.post.requirements[0].keywords).toEqual(["SQL"]);
    expect(clean.postText).not.toContain("<li>");
    expect(clean.createdAt).toBeInstanceOf(Date);
  });
});
