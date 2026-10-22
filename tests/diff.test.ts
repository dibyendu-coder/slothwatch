import { describe, expect, it } from "vitest";
import { buildCompactDiff } from "../src/judge/diff.js";

describe("buildCompactDiff", () => {
  it("returns empty diff when texts are identical", () => {
    const text = "Line 1\nLine 2\nLine 3";
    const res = buildCompactDiff(text, text);
    expect(res.hasChanges).toBe(false);
    expect(res.diffText).toBe("");
  });

  it("extracts added and removed lines accurately", () => {
    const oldText = "Deadline: Nov 1\nStatus: Pending\nVenue: Hall A";
    const newText = "Deadline: Nov 5\nStatus: Pending\nVenue: Hall B";

    const res = buildCompactDiff(oldText, newText);
    expect(res.hasChanges).toBe(true);
    expect(res.diffText).toContain("- Deadline: Nov 1");
    expect(res.diffText).toContain("+ Deadline: Nov 5");
    expect(res.diffText).toContain("- Venue: Hall A");
    expect(res.diffText).toContain("+ Venue: Hall B");
    expect(res.diffText).not.toContain("Status: Pending"); // Unchanged line omitted to conserve tokens
    expect(res.addedLinesCount).toBe(2);
    expect(res.removedLinesCount).toBe(2);
  });

  it("safely truncates long diffs when limits are exceeded", () => {
    const oldText = "Original\n";
    const newLines = Array.from({ length: 150 }, (_, i) => `Added line ${i + 1}`).join("\n");

    const res = buildCompactDiff(oldText, newLines, { maxLines: 10 });
    expect(res.truncated).toBe(true);
    expect(res.diffText).toContain("[... diff truncated due to size limits ...]");
  });
});
