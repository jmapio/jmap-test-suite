# JMAP Conformance Tests

This repo contains a set of tests for the JMAP core & email specs.

[Server conformance report is here](https://seph.au/jmap-report.html)

These tests currently cover [RFC 8620](https://datatracker.ietf.org/doc/html/rfc8620) (JMAP core) and [RFC 8621](https://datatracker.ietf.org/doc/html/rfc8621) (JMAP Mail). Other JMAP protocols (contacts & calendars) may be supported in the future.

The tests run via speaking JMAP to a live server, using a test account with an empty inbox.


## Quick start

```bash
npm install
npm run build
node dist/cli.js -c config.json
```

## Configuration

Copy `config.example.json` and fill in your server details:

```json
{
  "sessionUrl": "https://jmap.example.com/.well-known/jmap",
  "serverInfo": "Example Server v1.0",
  "users": {
    "primary": {
      "username": "testuser@example.com",
      "password": "secret"
    },
    "secondary": {
      "username": "testuser2@example.com",
      "password": "secret2"
    }
  },
  "authMethod": "basic",
  "timeout": 30000,
  "verbose": false
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `sessionUrl` | yes | JMAP session resource URL |
| `serverInfo` | no | Free-text server description (e.g. `"Stalwart v1.0.0"`), copied into reports |
| `users.primary` | yes | Credentials for the main test account |
| `users.secondary` | no | Second user for EmailSubmission tests (sending email to a real recipient) |
| `authMethod` | no | `"basic"` (default) or `"bearer"` |
| `timeout` | no | Request timeout in ms (default: 30000) |
| `verbose` | no | Log HTTP request/response bodies |

## CLI options

```
jmap-test -c <config> [options]
```

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Path to config JSON (required) |
| `-f, --force` | Force-clean the account if it already has data |
| `-o, --output <path>` | Write JSON report to a file (default: stdout) |
| `--filter <pattern>` | Run only tests matching a glob (e.g. `email/query*`, `core/*`) |
| `--verbose` | Include HTTP request/response details in output |
| `--fail-only` | Only print failing tests to the console |

Exit codes: `0` all required tests pass, `1` some required tests fail, `2` fatal error.

## What it tests

~300 tests across 10 categories:

| Category | RFC | What's covered |
|----------|-----|----------------|
| core | 8620 | Session, echo, request-level errors, method-level errors, result references |
| binary | 8620 | Upload, download, Blob/copy |
| push | 8620 | PushSubscription create/get/destroy, push notifications, event source |
| email | 8621 | Email/get (metadata, headers, body structure), /changes, /query (filters, sort, paging, thread collapse), /set, /copy, /import, /parse |
| mailbox | 8621 | Mailbox/get, /changes, /query, /queryChanges, /set |
| thread | 8621 | Thread/get, /changes |
| identity | 8621 | Identity/get, /changes, /set |
| submission | 8621 | EmailSubmission/set (create, envelope, onSuccessUpdateEmail, properties) |
| vacation | 8621 | VacationResponse/get, /set |
| search-snippet | 8621 | SearchSnippet/get |

Tests are marked **required** or **recommended**. The summary distinguishes between these so you can see which failures are spec violations vs. nice-to-haves.

### Skipped tests

Tests skip automatically when preconditions aren't met:

- No `users.secondary` configured — EmailSubmission tests skip
- [smee.io](https://smee.io) unreachable — PushSubscription callback tests skip
- Server missing `urn:ietf:params:jmap:vacationresponse` — VacationResponse tests skip
- Server missing `urn:ietf:params:jmap:submission` — Identity tests skip
- Primary user has only one mail account — cross-account (Email/copy, Blob/copy) tests skip

## Test lifecycle

1. **Connect** — fetch the JMAP session resource, discover accounts and capabilities
2. **Clean** — remove any existing test data from the account (use `-f` to force)
3. **Seed** — create mailboxes, emails, blobs, and discover identities for use by tests
4. **Run** — execute tests sequentially, recording pass/fail/skip and HTTP exchanges
5. **Teardown** — remove seeded test data

## JSON report

Output (to stdout or `-o file`) is a JSON document:

```json
{
  "server": "https://jmap.example.com/.well-known/jmap",
  "timestamp": "2026-02-06T12:00:00.000Z",
  "durationMs": 45000,
  "summary": {
    "total": 305,
    "passed": 280,
    "failed": 10,
    "skipped": 15,
    "requiredPassed": 250,
    "requiredFailed": 5,
    "recommendedPassed": 30,
    "recommendedFailed": 5
  },
  "results": [
    {
      "testId": "email/get-by-id",
      "name": "Email/get returns email by id",
      "rfc": "RFC8621",
      "section": "4.1",
      "required": true,
      "status": "pass",
      "durationMs": 120
    }
  ]
}
```

With `--verbose`, each result also includes an `exchanges` array with the raw HTTP request/response pairs.

## HTML report

Generate a visual HTML report from one or more JSON reports:

```bash
npx tsx tools/generate-report.ts stalwart-report.json fastmail-report.json
```

Produces an interactive HTML page with side-by-side comparison, filtering, search, and expandable HTTP exchange details.

## Running against Stalwart

[Stalwart](https://stalw.art) is an open-source mail server with JMAP support. Here's how to set up a local instance for testing.

### 1. Install and configure Stalwart

Download Stalwart and create a minimal config file (`stalwart.toml`). Only the HTTP listener is needed — SMTP, IMAP, etc. can be left commented out:

```toml
[server.listener.http]
protocol = "http"
bind = "[::]:8080"

[storage]
data = "rocksdb"
fts = "rocksdb"
blob = "rocksdb"
lookup = "rocksdb"
directory = "internal"

[store.rocksdb]
type = "rocksdb"
path = "./data"
compression = "lz4"

[directory.internal]
type = "internal"
store = "rocksdb"

[tracer.log]
type = "log"
level = "info"
path = "./logs"
prefix = "stalwart.log"
rotate = "daily"
ansi = false
enable = true

[authentication.fallback-admin]
user = "admin"
secret = "your-admin-password"
```

Start the server:

```bash
stalwart-mail --config stalwart.toml
```

### 2. Create test users

Use the Stalwart admin API to create two test accounts:

```bash
# Create primary test user
curl -u admin:your-admin-password \
  http://localhost:8080/api/account \
  -H 'Content-Type: application/json' \
  -d '{"type":"individual","name":"user1","secrets":["password"],"emails":["user1@localhost"]}'

# Create secondary test user (for EmailSubmission tests)
curl -u admin:your-admin-password \
  http://localhost:8080/api/account \
  -H 'Content-Type: application/json' \
  -d '{"type":"individual","name":"user2","secrets":["password"],"emails":["user2@localhost"]}'
```

### 3. Run the tests

Use (or adapt) the included `config-stalwart.json`:

```json
{
  "sessionUrl": "http://localhost:8080/.well-known/jmap",
  "users": {
    "primary": { "username": "user1", "password": "password" },
    "secondary": { "username": "user2", "password": "password" }
  },
  "authMethod": "basic",
  "timeout": 30000,
  "verbose": false
}
```

```bash
node dist/cli.js -c config-stalwart.json -f
```

## Project structure

```
src/
├── cli.ts                   # Entry point, arg parsing
├── client/                  # JMAP HTTP client
│   ├── jmap-client.ts       # Session management, method calls, upload/download
│   ├── session.ts           # Session resource parsing
│   └── transport.ts         # HTTP transport, auth
├── runner/                  # Test framework
│   ├── test-runner.ts       # Orchestration: connect, clean, seed, run, teardown
│   ├── test-registry.ts     # Test registration, filtering, glob matching
│   └── test-context.ts      # Test context: assertions, shared state
├── helpers/
│   └── smee.ts              # Smee.io webhook proxy for push subscription tests
├── setup/                   # Fixtures
│   ├── clean-account.ts     # Wipe account before run
│   ├── seed-data.ts         # Create test mailboxes, emails, blobs
│   └── teardown.ts          # Cleanup after run
├── reporter/
│   ├── console-reporter.ts  # Colored terminal output
│   └── json-reporter.ts     # Structured JSON report
├── types/
│   ├── config.ts            # Config schema and validation
│   ├── jmap-core.ts         # RFC 8620 types
│   ├── jmap-mail.ts         # RFC 8621 types
│   └── report.ts            # Test result types
└── tests/                   # One directory per category
    ├── core/
    ├── binary/
    ├── email/
    ├── mailbox/
    ├── thread/
    ├── identity/
    ├── submission/
    ├── vacation/
    ├── push/
    └── search-snippet/
```

## Authorship

This project was largely written (vibe coded) by Claude Code.
