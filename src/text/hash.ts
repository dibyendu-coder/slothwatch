import crypto from "node:crypto";

/**
 * Computes deterministic SHA-256 hash of normalized text
 */
export function computeHash(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}
