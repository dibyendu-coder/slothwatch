import { describe, expect, it } from "vitest";
import { normalizeText } from "../src/text/normalize.js";

describe("normalizeText", () => {
  it("trims and collapses whitespace and blank lines", () => {
    const raw = "  Hello   world! \n\n\n  This is   a    test.  \r\n\r\nDone.  ";
    const normalized = normalizeText(raw);
    expect(normalized).toBe("Hello world!\nThis is a test.\nDone.");
  });

  it("handles empty or whitespace-only strings", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText("    \n\t   ")).toBe("");
  });

  it("optionally strips volatile timestamps and dates", () => {
    const withTimestamp = "Status: Open\nUpdated at 2026-10-22T13:45:00.000Z by bot\nValue: $42.00";
    const stripped = normalizeText(withTimestamp, { stripTimestamps: true });
    expect(stripped).toContain("Status: Open");
    expect(stripped).toContain("Value: $42.00");
    expect(stripped).not.toContain("2026-10-22");
  });
});
