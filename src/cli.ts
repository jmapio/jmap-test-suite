#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { validateConfig } from "./types/config.js";
import { runTests } from "./runner/test-runner.js";
import { generateReport } from "./reporter/json-reporter.js";

// Import all test modules to trigger registration
import "./tests/core/session.test.js";
import "./tests/core/echo.test.js";
import "./tests/core/request-errors.test.js";
import "./tests/core/method-errors.test.js";
import "./tests/core/result-references.test.js";
import "./tests/binary/upload.test.js";
import "./tests/binary/download.test.js";
import "./tests/binary/blob-copy.test.js";
import "./tests/mailbox/mailbox-get.test.js";
import "./tests/mailbox/mailbox-changes.test.js";
import "./tests/mailbox/mailbox-query.test.js";
import "./tests/mailbox/mailbox-query-changes.test.js";
import "./tests/mailbox/mailbox-set.test.js";
import "./tests/thread/thread-get.test.js";
import "./tests/thread/thread-changes.test.js";
import "./tests/email/email-get.test.js";
import "./tests/email/email-get-headers.test.js";
import "./tests/email/email-get-body.test.js";
import "./tests/email/email-changes.test.js";
import "./tests/email/email-query-filters.test.js";
import "./tests/email/email-query-sort.test.js";
import "./tests/email/email-query-paging.test.js";
import "./tests/email/email-query-thread-collapse.test.js";
import "./tests/email/email-query-changes.test.js";
import "./tests/email/email-set-create.test.js";
import "./tests/email/email-set-update.test.js";
import "./tests/email/email-set-destroy.test.js";
import "./tests/email/email-copy.test.js";
import "./tests/email/email-import.test.js";
import "./tests/email/email-parse.test.js";
import "./tests/search-snippet/search-snippet-get.test.js";
import "./tests/identity/identity-get.test.js";
import "./tests/identity/identity-changes.test.js";
import "./tests/identity/identity-set.test.js";
import "./tests/submission/submission-get.test.js";
import "./tests/submission/submission-changes.test.js";
import "./tests/submission/submission-query.test.js";
import "./tests/submission/submission-set.test.js";
import "./tests/vacation/vacation-get.test.js";
import "./tests/vacation/vacation-set.test.js";
import "./tests/push/push-subscription.test.js";
import "./tests/push/event-source.test.js";

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: "string", short: "c" },
      force: { type: "boolean", short: "f", default: false },
      output: { type: "string", short: "o" },
      filter: { type: "string" },
      verbose: { type: "boolean", default: false },
      "fail-only": { type: "boolean", default: false },
    },
    strict: true,
  });

  if (!values.config) {
    process.stderr.write(
      "Usage: jmap-test -c <config.json> [-f] [-o output.json] [--filter pattern] [--verbose]\n\n" +
        "Options:\n" +
        "  -c, --config <path>   Path to configuration JSON file (required)\n" +
        "  -f, --force           Force-delete existing data if account not empty\n" +
        "  -o, --output <path>   Write JSON report to file (default: stdout)\n" +
        "  --filter <pattern>    Run only tests matching pattern (e.g., email/query*)\n" +
        "  --verbose             Print request/response details\n" +
        "  --fail-only           Only print failing tests\n"
    );
    process.exit(1);
  }

  const rawConfig = JSON.parse(readFileSync(values.config, "utf-8"));
  const config = validateConfig(rawConfig);

  if (values.verbose) {
    config.verbose = true;
  }

  const startTime = performance.now();

  const results = await runTests({
    config,
    force: values.force ?? false,
    filter: values.filter,
    verbose: config.verbose,
    failOnly: values["fail-only"] ?? false,
  });

  const report = generateReport(config.sessionUrl, results, startTime);
  const json = JSON.stringify(report, null, 2);

  if (values.output) {
    writeFileSync(values.output, json, "utf-8");
    process.stderr.write(`\nReport written to ${values.output}\n`);
  } else {
    process.stdout.write(json + "\n");
  }

  const exitCode = report.summary.requiredFailed > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(`\nFatal error: ${err.message}\n`);
  if (err.body) {
    process.stderr.write(`Response body: ${err.body}\n`);
  }
  if (err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(2);
});
