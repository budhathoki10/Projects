import { describe, expect, it } from "vitest";
import { cleanLinkLabel, labelFor, linkParts } from "@/lib/cv/links";

const labels = { "https://www.linkedin.com/in/asha/": "LinkedIn", "https://cert.example.com/a.jpg": "Certificate", "https://feedwatch.example.com/": "Live" };

describe("links keep the word they sat on in the original CV", () => {
  it("finds the recorded word for an address, however it is written", () => {
    expect(labelFor("https://www.linkedin.com/in/asha/", labels)).toBe("LinkedIn");
    expect(labelFor("feedwatch.example.com", labels)).toBe("Live");
    expect(labelFor("https://github.com/asha", labels)).toBeNull();
    expect(labelFor("https://github.com/asha")).toBeNull();
  });

  it("turns 'Certificate (https://…)' into a link on 'Certificate'", () => {
    expect(linkParts("Backend Developer – Herald College Certificate (https://cert.example.com/a.jpg)", labels)).toEqual([
      { text: "Backend Developer – Herald College " },
      { text: "Certificate", url: "https://cert.example.com/a.jpg" },
    ]);
  });

  it("shows a short address when no word was recorded, and leaves plain text alone", () => {
    expect(linkParts("Portfolio (https://www.asha.dev/work/)")).toEqual([{ text: "Portfolio " }, { text: "asha.dev/work", url: "https://www.asha.dev/work/" }]);
    expect(linkParts("Completed MERN stack training.")).toEqual([{ text: "Completed MERN stack training." }]);
  });

  it("keeps only short labels, never an address, email or sentence", () => {
    expect(cleanLinkLabel(" | GitHub ")).toBe("GitHub");
    expect(cleanLinkLabel("Live")).toBe("Live");
    expect(cleanLinkLabel("linkedin.com/in/asha")).toBeNull();
    expect(cleanLinkLabel("asha@example.com")).toBeNull();
    expect(cleanLinkLabel("Built and shipped three products on my own")).toBeNull();
  });
});
