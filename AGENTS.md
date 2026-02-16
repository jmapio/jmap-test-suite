# AGENTS.md — jmap-test

## Project overview

JMAP conformance test suite for RFC 8620 (JMAP Core) and RFC 8621 (JMAP Mail). Written in TypeScript, runs on Node.js 22+ or bun. No external test framework — uses a custom lightweight test registry and runner.

## Build and run

Using bun:

```bash
bun run ./src/cli.ts

# Typical usage
bun run ./src/cli.ts -c config-stalwart.json -f
bun run ./src/cli.ts -c config-stalwart.json -f --filter 'email/query*'
bun run ./src/cli.ts -c config-stalwart.json -f --filter 'copy,blob' --fail-only
```

**CLI flags**: `-c <config>` (required), `-f` (force-clean), `-o <path>` (JSON output file), `--filter <pattern>` (glob or substring, comma-separated), `--verbose`, `--fail-only`.

**Exit codes**: 0 = all required tests pass, 1 = required failures, 2 = fatal error.

## Directory structure

```
src/
├── cli.ts                    # Entry point, arg parsing
├── client/                   # JMAP HTTP client, session parsing, transport
├── runner/
│   ├── test-runner.ts        # Orchestration: connect → clean → seed → run → teardown → report
│   ├── test-registry.ts      # Test registration, glob filtering
│   └── test-context.ts       # Shared context object with assertion helpers
├── helpers/
│   └── smee.ts               # smee.io webhook proxy for push tests
├── setup/
│   ├── clean-account.ts      # Wipe account before run
│   ├── seed-data.ts          # Create test mailboxes, emails, blobs
│   └── teardown.ts           # Remove seeded data after run
├── reporter/
│   ├── console-reporter.ts   # Colored terminal output (PASS/FAIL/WARN/SKIP)
│   └── json-reporter.ts      # Structured JSON report
├── types/
│   ├── config.ts             # Config schema and runtime validation
│   ├── jmap-core.ts          # RFC 8620 type definitions
│   ├── jmap-mail.ts          # RFC 8621 type definitions
│   └── report.ts             # TestResult, TestReport interfaces
└── tests/                    # ~300 tests across 42 files in 10 categories
    ├── core/                 # Session, echo, request errors, method errors, result references
    ├── binary/               # Upload, download, blob copy
    ├── email/                # Get, changes, query (filters/sort/paging), set, copy, import, parse
    ├── mailbox/              # Get, changes, query, queryChanges, set
    ├── thread/               # Get, changes
    ├── identity/             # Get, changes, set
    ├── submission/           # EmailSubmission set (send, envelope, onSuccess)
    ├── vacation/             # VacationResponse get/set
    ├── push/                 # PushSubscription CRUD, EventSource
    └── search-snippet/       # SearchSnippet get
```

## How tests work

### Defining tests

Every test file uses `defineTests()`:

```typescript
defineTests({ rfc: "RFC8621", section: "4.4", category: "email" }, [
  {
    id: "query-filter-from",               // becomes testId "email/query-filter-from"
    name: "Email/query filter from matches sender",
    required: true,                         // default; false = recommended (SHOULD) behavior
    runIf: (ctx) => ...,                    // optional: return true to run, or string reason to skip
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", { ... });
      ctx.assertEqual(result.ids.length, 1);
    },
  },
]);
```

**Test ID format**: `{category}/{id}` — e.g., `email/query-filter-from`. The `--filter` flag matches against this.

### Required vs recommended

- `required: true` (default) — RFC MUST behavior. Failures are FAIL (red) and affect exit code.
- `required: false` — RFC SHOULD behavior. Failures are WARN (yellow) and don't affect exit code.

### Skip conditions

Tests use `runIf` to declare preconditions. Return `true` to run, or a string skip reason:

```typescript
runIf: (ctx) =>
  !ctx.config.users.secondary ? "No secondary user configured"
  : ctx.identityIds.length === 0 ? "No identities available"
  : true,
```

Common skip conditions:
- No secondary user → submission tests skip
- smee.io unreachable → push callback tests skip
- No cross-account access → Email/copy, Blob/copy tests skip

### Test context (ctx)

The `TestContext` provides:
- `client` / `secondaryClient` — JMAP clients for primary/secondary users
- `accountId` / `crossAccountId` — account IDs
- `roleMailboxes` — `{ inbox: "id", drafts: "id", sent: "id", ... }`
- `mailboxIds` — `{ folderA: "id", folderB: "id", child1: "id", child2: "id" }`
- `emailIds` — seeded email IDs keyed by name (e.g., `"plain-simple"`, `"thread-reply-2"`)
- `blobIds` — uploaded blob IDs
- `identityIds`, `identityEmail`, `secondaryEmail`
- `smeeChannel` — smee.io webhook for push tests
- 20+ assertion helpers: `assertEqual`, `assertTruthy`, `assertIncludes`, `assertGreaterThan`, etc.

### Test lifecycle

1. **Connect** — Fetch JMAP session, discover accounts and capabilities
2. **Clean** — Remove existing test data (requires `-f` flag if account not empty)
3. **Seed** — Create 4 mailboxes, ~22 emails, 2 blobs, discover identities
4. **Run** — Execute tests sequentially, record pass/fail/skip with timing
5. **Teardown** — Destroy all seeded data
6. **Report** — Output JSON report (stdout or file) and console summary

## Configuration

Config files live in the project root (e.g., `config-stalwart.json`, `config-fastmail.json`):

```json
{
  "sessionUrl": "https://server/.well-known/jmap",
  "users": {
    "primary": { "username": "user1", "password": "pass" },
    "secondary": { "username": "user2", "password": "pass" }
  },
  "authMethod": "basic",
  "timeout": 30000,
  "serverInfo": "Stalwart v0.11"
}
```

`users.secondary` is optional — enables EmailSubmission tests (sending email between accounts).

## Key conventions

- Test names for MUST behavior say "MUST" in the name. SHOULD tests say "SHOULD".
- Same-account `/copy` is invalid per spec — cross-account tests use `ctx.crossAccountId`.
- Tests clean up after themselves (destroy created objects in `finally` blocks).
- No `filter: null` in Email/query calls — omit the property instead (some servers reject null).
- HTTP status code assertions use range checks (`>= 400 && < 500`), not specific codes.
- The `JmapMethodError` class wraps JMAP method-level errors thrown by `client.call()`.

## Reference documents

- `rfc8620.txt` and `rfc8621.txt` - RFC text for JMAP Core and JMAP Mail.
- `rfc-assumptions.md` — Comprehensive list of RFC interpretation decisions and open questions
- `failure-analysis.md` — Categorized analysis of test failures against Stalwart
