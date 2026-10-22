export interface NormalizeOptions {
  stripTimestamps?: boolean;
}

/**
 * Normalizes page text:
 * - Unifies CRLF to LF
 * - Trims and collapses multiple spaces and tabs
 * - Removes blank lines
 * - Optionally strips volatile timestamps and dates
 */
export function normalizeText(rawText: string, options: NormalizeOptions = {}): string {
  if (!rawText) return "";

  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (options.stripTimestamps) {
    // Strip ISO 8601 timestamps e.g. 2026-10-22T13:45:00.000Z
    text = text.replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gi, "");
    // Strip standard 12/24hr time stamps like 12:45:10 PM or 13:45
    text = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g, "");
    // Strip common date patterns e.g. 10/22/2026
    text = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "");
  }

  // Collapse spaces and strip empty lines
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
