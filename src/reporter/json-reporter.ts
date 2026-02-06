import type { TestResult, TestReport } from "../types/report.js";

export function generateReport(
  serverUrl: string,
  results: TestResult[],
  startTime: number,
  serverInfo?: string
): TestReport {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  const required = results.filter((r) => r.required);
  const recommended = results.filter((r) => !r.required);

  return {
    server: serverUrl,
    ...(serverInfo ? { serverInfo } : {}),
    timestamp: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startTime),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      requiredPassed: required.filter((r) => r.status === "pass").length,
      requiredFailed: required.filter((r) => r.status === "fail").length,
      recommendedPassed: recommended.filter((r) => r.status === "pass").length,
      recommendedFailed: recommended.filter((r) => r.status === "fail").length,
    },
    results,
  };
}
