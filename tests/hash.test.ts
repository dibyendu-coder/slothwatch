import { describe, expect, it } from "vitest";
import { computeHash } from "../src/text/hash.js";
import { normalizeText } from "../src/text/normalize.js";

describe("computeHash", () => {
  it("produces identical SHA-256 for identical text", () => {
    const text1 = "Application deadline: Nov 1st";
    const text2 = "Application deadline: Nov 1st";
    expect(computeHash(text1)).toBe(computeHash(text2));
  });

  it("produces different hashes for different text", () => {
    const text1 = "Application deadline: Nov 1st";
    const text2 = "Application deadline: Nov 2nd";
    expect(computeHash(text1)).not.toBe(computeHash(text2));
  });

  it("combines with normalizeText to be invariant to trivial spacing differences", () => {
    const raw1 = "  Winner:   Alice \n\n Announced ";
    const raw2 = "Winner: Alice\r\nAnnounced\n";
    expect(computeHash(normalizeText(raw1))).toBe(computeHash(normalizeText(raw2)));
  });
});
