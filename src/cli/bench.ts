import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { judgeDiff } from "../judge/judge.js";
import { loadConfig } from "../config.js";

export interface TestCase {
  id: string;
  category: "real_change" | "noise" | "tricky";
  care: string;
  diff: string;
  expected: boolean;
  note: string;
}

export interface ModelFailure {
  caseId: string;
  category: string;
  care: string;
  diff: string;
  expected: boolean;
  actual: boolean;
  summary: string;
  reason: string;
  rawError?: string;
}

export interface ModelBenchResult {
  model: string;
  total: number;
  correct: number;
  accuracy: number;
  falsePositives: number; // expected false, got true
  falseNegatives: number; // expected true, got false
  invalidJsonCount: number;
  retriedCount: number;
  totalMs: number;
  avgMs: number;
  promptTokens: number;
  completionTokens: number;
  avgTokens: number;
  failures: ModelFailure[];
}

export interface BenchOptions {
  models?: string;
  cases?: string;
}

export async function handleBench(options: BenchOptions): Promise<void> {
  const config = loadConfig();
  const casesPath = options.cases
    ? path.resolve(process.cwd(), options.cases)
    : path.resolve(process.cwd(), "bench", "cases.json");

  if (!fs.existsSync(casesPath)) {
    console.error(pc.red(`Error: Test cases file not found at: ${casesPath}`));
    process.exitCode = 1;
    return;
  }

  const rawCases = fs.readFileSync(casesPath, "utf-8");
  let testCases: TestCase[];
  try {
    testCases = JSON.parse(rawCases) as TestCase[];
  } catch (err) {
    console.error(pc.red(`Error: Failed to parse JSON test cases: ${(err as Error).message}`));
    process.exitCode = 1;
    return;
  }

  const modelTags = (options.models || "gemma4:e2b,gemma4:e4b,llama3.2:3b")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  console.log(pc.bold("\n🦥 SlothWatch Local Model Benchmark\n"));
  console.log(`  Test cases:  ${pc.cyan(testCases.length)} cases loaded from ${casesPath}`);
  console.log(`  Models:      ${pc.cyan(modelTags.join(", "))}`);
  console.log(`  Ollama Host: ${pc.cyan(config.OLLAMA_HOST)}\n`);

  const results: ModelBenchResult[] = [];

  for (const modelTag of modelTags) {
    console.log(pc.bold(`\n── Running benchmark for model: ${pc.magenta(modelTag)} ──`));
    const modelResult = await runModelBenchmark(modelTag, testCases, config.OLLAMA_HOST);
    results.push(modelResult);
  }

  // Print console summary table
  printConsoleSummary(results);

  // Write RESULTS.md
  writeResultsMarkdown(results, testCases.length);
}

async function runModelBenchmark(
  model: string,
  testCases: TestCase[],
  host: string
): Promise<ModelBenchResult> {
  let correct = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let invalidJsonCount = 0;
  let retriedCount = 0;
  let totalMs = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const failures: ModelFailure[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    process.stdout.write(
      `  [${i + 1}/${testCases.length}] ${tc.id.padEnd(8)} (${tc.category.padEnd(11)})... `
    );

    const res = await judgeDiff(tc.care, tc.diff, {
      model,
      host,
      timeoutMs: 120000,
    });

    totalMs += res.modelMs;
    promptTokens += res.promptTokens;
    completionTokens += res.completionTokens;

    if (res.retried) {
      retriedCount++;
    }

    if (!res.success || !res.judgment) {
      invalidJsonCount++;
      failures.push({
        caseId: tc.id,
        category: tc.category,
        care: tc.care,
        diff: tc.diff,
        expected: tc.expected,
        actual: false,
        summary: "N/A (Failed Schema/Execution)",
        reason: res.error || "Unknown error",
        rawError: res.error,
      });
      console.log(pc.red(`✗ ERROR (${(res.modelMs / 1000).toFixed(1)}s)`));
      continue;
    }

    const actual = res.judgment.matters;
    const isCorrect = actual === tc.expected;

    if (isCorrect) {
      correct++;
      console.log(
        pc.green(`✓ PASS`) +
          ` (${(res.modelMs / 1000).toFixed(1)}s, ${res.promptTokens + res.completionTokens} tok)`
      );
    } else {
      if (!tc.expected && actual) {
        falsePositives++;
        console.log(
          pc.yellow(`✗ FALSE POSITIVE (noise pushed)`) +
            ` (${(res.modelMs / 1000).toFixed(1)}s)`
        );
      } else {
        falseNegatives++;
        console.log(
          pc.red(`✗ FALSE NEGATIVE (missed change)`) +
            ` (${(res.modelMs / 1000).toFixed(1)}s)`
        );
      }

      failures.push({
        caseId: tc.id,
        category: tc.category,
        care: tc.care,
        diff: tc.diff,
        expected: tc.expected,
        actual,
        summary: res.judgment.summary,
        reason: res.judgment.reason,
      });
    }
  }

  const accuracy = Number(((correct / testCases.length) * 100).toFixed(1));
  const avgMs = Math.round(totalMs / testCases.length);
  const avgTokens = Math.round((promptTokens + completionTokens) / testCases.length);

  return {
    model,
    total: testCases.length,
    correct,
    accuracy,
    falsePositives,
    falseNegatives,
    invalidJsonCount,
    retriedCount,
    totalMs,
    avgMs,
    promptTokens,
    completionTokens,
    avgTokens,
    failures,
  };
}

function printConsoleSummary(results: ModelBenchResult[]): void {
  console.log(pc.bold("\n" + "═".repeat(88)));
  console.log(pc.bold("📊 BENCHMARK COMPARISON SUMMARY"));
  console.log("═".repeat(88));

  const headers = [
    "Model".padEnd(16),
    "Accuracy".padEnd(10),
    "Score".padEnd(8),
    "FP (Noise)".padEnd(12),
    "FN (Missed)".padEnd(12),
    "Invalid/Retry".padEnd(14),
    "Avg Time".padEnd(10),
    "Avg Tok",
  ];
  console.log(pc.bold(headers.join(" | ")));
  console.log("─".repeat(88));

  for (const r of results) {
    const accStr = `${r.accuracy}%`.padEnd(10);
    const scoreStr = `${r.correct}/${r.total}`.padEnd(8);
    const fpStr = `${r.falsePositives}`.padEnd(12);
    const fnStr = `${r.falseNegatives}`.padEnd(12);
    const invStr = `${r.invalidJsonCount}/${r.retriedCount}`.padEnd(14);
    const timeStr = `${(r.avgMs / 1000).toFixed(2)}s`.padEnd(10);
    const tokStr = `${r.avgTokens}`;

    const color = r.accuracy >= 85 ? pc.green : r.accuracy >= 70 ? pc.yellow : pc.red;
    console.log(
      color(
        [
          r.model.padEnd(16),
          accStr,
          scoreStr,
          fpStr,
          fnStr,
          invStr,
          timeStr,
          tokStr,
        ].join(" | ")
      )
    );
  }
  console.log("═".repeat(88) + "\n");
}

function writeResultsMarkdown(results: ModelBenchResult[], totalCases: number): void {
  const resultsDir = path.resolve(process.cwd(), "bench");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsPath = path.join(resultsDir, "RESULTS.md");
  const dateStr = new Date().toISOString();

  let md = `# Benchmark Results — SlothWatch Local Model Evaluation\n\n`;
  md += `Evaluated on: ${dateStr}\n`;
  md += `Total test cases: ${totalCases} fixed real/noise/tricky web diffs.\n\n`;

  md += `## Summary Comparison Table\n\n`;
  md += `| Model | Accuracy | Score | False Positives (Noise) | False Negatives (Missed) | Invalid JSON / Retried | Avg Latency | Avg Tokens |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    md += `| **${r.model}** | **${r.accuracy}%** | ${r.correct}/${r.total} | ${r.falsePositives} | ${r.falseNegatives} | ${r.invalidJsonCount} / ${r.retriedCount} | ${(r.avgMs / 1000).toFixed(2)}s | ${r.avgTokens} |\n`;
  }

  md += `\n> **Key Metrics Explained**:\n`;
  md += `- **False Positives (FP)**: Model falsely reported noise (timestamps, ads, cookie banners) as a meaningful change and would have buzzed the user's phone.\n`;
  md += `- **False Negatives (FN)**: Model missed a genuine change the user cared about.\n`;
  md += `- **Invalid JSON / Retried**: Malformed JSON requiring prompt retry or failing schema validation.\n`;
  md += `- **Avg Latency**: Average Ollama inference time per evaluation.\n\n`;

  md += `## Detailed Failure Log (For Blog Post Citation)\n\n`;
  md += `Below is an exhaustive log of every failed judgment per model, detailing the care prompt, diff, expected result, and model explanation.\n\n`;

  for (const r of results) {
    md += `### Model: \`${r.model}\` (${r.failures.length} failures / ${r.total} cases)\n\n`;
    if (r.failures.length === 0) {
      md += `*Perfect run! Zero failures recorded across all test cases.*\n\n`;
      continue;
    }

    for (const f of r.failures) {
      md += `#### Case: \`${f.caseId}\` [Category: ${f.category}]\n`;
      md += `- **Care Instruction**: *"${f.care}"*\n`;
      md += `- **Expected Judgment**: \`matters: ${f.expected}\`\n`;
      md += `- **Actual Judgment**: \`matters: ${f.actual}\`\n`;
      md += `- **Model Summary**: ${f.summary}\n`;
      md += `- **Model Reason**: ${f.reason}\n`;
      if (f.rawError) {
        md += `- **Error**: \`${f.rawError}\`\n`;
      }
      md += `\`\`\`diff\n${f.diff}\n\`\`\`\n\n`;
    }
  }

  fs.writeFileSync(resultsPath, md, "utf-8");
  console.log(pc.green(`✓ Benchmark report written to ${resultsPath}\n`));
}
