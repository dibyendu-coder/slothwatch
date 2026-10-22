export interface DiffOptions {
  maxLines?: number;
  maxChars?: number;
}

export interface DiffResult {
  diffText: string;
  hasChanges: boolean;
  truncated: boolean;
  addedLinesCount: number;
  removedLinesCount: number;
}

/**
 * Builds a compact line-based diff between old and new text.
 * Only includes added (+) and removed (-) lines to conserve tokens for small LLMs.
 * Caps the output size safely to avoid exceeding local model context limits.
 */
export function buildCompactDiff(
  oldText: string,
  newText: string,
  options: DiffOptions = {}
): DiffResult {
  const maxLines = options.maxLines ?? 80;
  const maxChars = options.maxChars ?? 3500;

  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];

  if (oldText === newText) {
    return {
      diffText: "",
      hasChanges: false,
      truncated: false,
      addedLinesCount: 0,
      removedLinesCount: 0,
    };
  }

  // Fast LCS-based / simple diff for lines
  const diffLines: string[] = [];
  let added = 0;
  let removed = 0;

  // Track simple line differences
  // Find removed lines that are not in new lines, and added lines not in old lines
  // Preserving relative order where possible
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of oldLines) {
    if (!newSet.has(line)) {
      diffLines.push(`- ${line}`);
      removed++;
    }
  }

  for (const line of newLines) {
    if (!oldSet.has(line)) {
      diffLines.push(`+ ${line}`);
      added++;
    }
  }

  let truncated = false;
  let selectedLines = diffLines;

  if (selectedLines.length > maxLines) {
    selectedLines = selectedLines.slice(0, maxLines);
    truncated = true;
  }

  let textResult = selectedLines.join("\n");
  if (textResult.length > maxChars) {
    textResult = textResult.slice(0, maxChars);
    truncated = true;
  }

  if (truncated) {
    textResult += "\n[... diff truncated due to size limits ...]";
  }

  return {
    diffText: textResult,
    hasChanges: added > 0 || removed > 0,
    truncated,
    addedLinesCount: added,
    removedLinesCount: removed,
  };
}
