export interface HttpExchange {
  request: { method: string; url: string; body?: unknown };
  response: { status: number; body?: unknown };
}

export interface TestResult {
  testId: string;
  name: string;
  rfc: string;
  section: string;
  required: boolean;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  error?: string;
  exchanges?: HttpExchange[];
}

export interface TestReport {
  server: string;
  serverInfo?: string;
  timestamp: string;
  durationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    requiredPassed: number;
    requiredFailed: number;
    recommendedPassed: number;
    recommendedFailed: number;
  };
  results: TestResult[];
}
