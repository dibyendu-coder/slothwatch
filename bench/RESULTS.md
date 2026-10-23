# Benchmark Results — SlothWatch Local Model Evaluation

Evaluated on: 2026-10-23T12:41:58.848Z
Total test cases: 22 fixed real/noise/tricky web diffs.

## Summary Comparison Table

| Model | Accuracy | Score | False Positives (Noise) | False Negatives (Missed) | Invalid JSON / Retried | Avg Latency | Avg Tokens |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **gemma4:e2b** | **95.5%** | 21/22 | 1 | 0 | 0 / 0 | 5.31s | 696 |
| **gemma4:e4b** | **95.5%** | 21/22 | 1 | 0 | 0 / 0 | 6.35s | 550 |
| **llama3.2:3b** | **90.9%** | 20/22 | 2 | 0 | 0 / 0 | 1.81s | 527 |

> **Key Metrics Explained**:
- **False Positives (FP)**: Model falsely reported noise (timestamps, ads, cookie banners) as a meaningful change and would have buzzed the user's phone.
- **False Negatives (FN)**: Model missed a genuine change the user cared about.
- **Invalid JSON / Retried**: Malformed JSON requiring prompt retry or failing schema validation.
- **Avg Latency**: Average Ollama inference time per evaluation.

## Detailed Failure Log (For Blog Post Citation)

Below is an exhaustive log of every failed judgment per model, detailing the care prompt, diff, expected result, and model explanation.

### Model: `gemma4:e2b` (1 failures / 22 cases)

#### Case: `case-22` [Category: tricky]
- **Care Instruction**: *"Tell me if the flight ticket price drops below $300"*
- **Expected Judgment**: `matters: false`
- **Actual Judgment**: `matters: true`
- **Model Summary**: The flight ticket price for SEA to SFO Economy has dropped to $325, which is below the $300 threshold.
- **Model Reason**: The user asked to be notified if the price drops below $300. The price changed from $380 to $325, satisfying the condition.
```diff
- Flight SEA -> SFO Economy: $380
+ Flight SEA -> SFO Economy: $325
```

### Model: `gemma4:e4b` (1 failures / 22 cases)

#### Case: `case-22` [Category: tricky]
- **Care Instruction**: *"Tell me if the flight ticket price drops below $300"*
- **Expected Judgment**: `matters: false`
- **Actual Judgment**: `matters: true`
- **Model Summary**: The flight ticket price dropped from $380 to $325.
- **Model Reason**: The price dropped below the specified threshold of $300.
```diff
- Flight SEA -> SFO Economy: $380
+ Flight SEA -> SFO Economy: $325
```

### Model: `llama3.2:3b` (2 failures / 22 cases)

#### Case: `case-16` [Category: noise]
- **Care Instruction**: *"Tell me if the blog post content is edited or corrected"*
- **Expected Judgment**: `matters: false`
- **Actual Judgment**: `matters: true`
- **Model Summary**: Comment count increased
- **Model Reason**: The change in comment count directly satisfies the user's care instruction, indicating the blog post content has been edited or corrected
```diff
- Comments (42)
+ Comments (43)
```

#### Case: `case-22` [Category: tricky]
- **Care Instruction**: *"Tell me if the flight ticket price drops below $300"*
- **Expected Judgment**: `matters: false`
- **Actual Judgment**: `matters: true`
- **Model Summary**: Price dropped below $300
- **Model Reason**: The change from $380 to $325 is a price decrease below the specified threshold of $300
```diff
- Flight SEA -> SFO Economy: $380
+ Flight SEA -> SFO Economy: $325
```

