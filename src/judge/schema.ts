import { z } from "zod";

/**
 * Strict Zod schema for local model judgment
 * Output contract:
 * {
 *   matters: boolean,
 *   summary: string (max 2 short lines),
 *   reason: string
 * }
 */
export const JudgmentSchema = z.object({
  matters: z.boolean(),
  summary: z.string().transform((val) => {
    // Ensure summary does not exceed 2 lines
    const lines = val.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(0, 2).join("\n").trim();
  }),
  reason: z.string(),
});

export type Judgment = z.infer<typeof JudgmentSchema>;
