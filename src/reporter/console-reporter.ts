import type { TestResult } from "../types/report.js";

const isTTY = process.stderr.isTTY;

const colors = {
  green: isTTY ? "\x1b[32m" : "",
  red: isTTY ? "\x1b[31m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  dim: isTTY ? "\x1b[2m" : "",
  reset: isTTY ? "\x1b[0m" : "",
  bold: isTTY ? "\x1b[1m" : "",
};

export function printProgress(
  current: number,
  total: number,
  result: TestResult,
  failOnly?: boolean
): void {
  if (failOnly && result.status !== "fail") return;

  const pad = String(total).length;
  const num = String(current).padStart(pad);

  let statusStr: string;
  switch (result.status) {
    case "pass":
      statusStr = `${colors.green}PASS${colors.reset}`;
      break;
    case "fail":
      if (result.required) {
        statusStr = `${colors.red}FAIL${colors.reset}`;
      } else {
        statusStr = `${colors.yellow}WARN${colors.reset}`;
      }
      break;
    case "skip":
      statusStr = `${colors.yellow}SKIP${colors.reset}`;
      break;
  }

  const duration = `${colors.dim}(${result.durationMs}ms)${colors.reset}`;
  process.stderr.write(`  [${num}/${total}] ${statusStr}  ${result.testId} ${duration}\n`);

  if (result.status === "fail" && result.error) {
    const color = result.required ? colors.red : colors.yellow;
    process.stderr.write(`           ${color}${result.error}${colors.reset}\n`);
  }
}

export function printSummaryLine(results: TestResult[]): void {
  const required = results.filter((r) => r.required);
  const recommended = results.filter((r) => !r.required);

  const reqPassed = required.filter((r) => r.status === "pass").length;
  const reqFailed = required.filter((r) => r.status === "fail").length;
  const reqSkipped = required.filter((r) => r.status === "skip").length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  process.stderr.write("\n");
  process.stderr.write(
    `${colors.bold}Required: ` +
      `${colors.green}${reqPassed} passed${colors.reset}${colors.bold}, ` +
      `${colors.red}${reqFailed} failed${colors.reset}${colors.bold}, ` +
      `${colors.yellow}${reqSkipped} skipped${colors.reset}${colors.bold} ` +
      `(${required.length} total, ${(totalDuration / 1000).toFixed(1)}s)${colors.reset}\n`
  );

  if (recommended.length > 0) {
    const recPassed = recommended.filter((r) => r.status === "pass").length;
    const recFailed = recommended.filter((r) => r.status === "fail").length;
    process.stderr.write(
      `${colors.bold}Recommended: ` +
        `${colors.green}${recPassed} passed${colors.reset}${colors.bold}, ` +
        `${colors.yellow}${recFailed} failed${colors.reset}${colors.bold} ` +
        `(${recommended.length} total)${colors.reset}\n`
    );
  }
}
