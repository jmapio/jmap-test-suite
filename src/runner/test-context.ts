import type { JmapClient } from "../client/jmap-client.js";
import type { Session, Id } from "../types/jmap-core.js";
import type { Config } from "../types/config.js";
import type { HttpExchange } from "../types/report.js";

export class TestContext {
  public client: JmapClient;
  public session: Session;
  public accountId: string;
  public config: Config;

  /** IDs of mailboxes created during setup, keyed by test name */
  public mailboxIds: Record<string, Id> = {};

  /** IDs of emails created during setup, keyed by test name */
  public emailIds: Record<string, Id> = {};

  /** Blob IDs uploaded during setup */
  public blobIds: Record<string, Id> = {};

  /** Identity IDs discovered/created */
  public identityIds: Id[] = [];

  /** Email address of the primary identity (from Identity/get) */
  public identityEmail: string = "";

  /** Email address of the secondary identity (from Identity/get on secondary) */
  public secondaryEmail: string = "";

  /** Server-provided role mailbox IDs */
  public roleMailboxes: Record<string, Id> = {};

  /** A second mail-capable account accessible by the primary user (for cross-account tests) */
  public crossAccountId?: string;

  /** Second client for secondary account (if configured) */
  public secondaryClient?: JmapClient;

  constructor(client: JmapClient, config: Config) {
    this.client = client;
    this.session = client.session;
    this.accountId = client.accountId;
    this.config = config;
  }

  drainExchanges(): HttpExchange[] {
    const exchanges = this.client.drainExchanges();
    if (this.secondaryClient) {
      exchanges.push(...this.secondaryClient.drainExchanges());
    }
    return exchanges;
  }

  // --- Assertion Helpers ---

  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new AssertionError(message);
    }
  }

  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message ??
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
    }
  }

  assertNotEqual<T>(actual: T, notExpected: T, message?: string): void {
    if (actual === notExpected) {
      throw new AssertionError(
        message ?? `Expected value to differ from ${JSON.stringify(notExpected)}`
      );
    }
  }

  assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
    if (!deepEqual(actual, expected)) {
      throw new AssertionError(
        message ??
          `Deep equality failed.\nExpected: ${JSON.stringify(expected, null, 2)}\nActual:   ${JSON.stringify(actual, null, 2)}`
      );
    }
  }

  assertTruthy(value: unknown, message?: string): void {
    if (!value) {
      throw new AssertionError(
        message ?? `Expected truthy value, got ${JSON.stringify(value)}`
      );
    }
  }

  assertFalsy(value: unknown, message?: string): void {
    if (value) {
      throw new AssertionError(
        message ?? `Expected falsy value, got ${JSON.stringify(value)}`
      );
    }
  }

  assertIncludes<T>(arr: T[], item: T, message?: string): void {
    if (!arr.includes(item)) {
      throw new AssertionError(
        message ??
          `Expected array to include ${JSON.stringify(item)}, got ${JSON.stringify(arr)}`
      );
    }
  }

  assertNotIncludes<T>(arr: T[], item: T, message?: string): void {
    if (arr.includes(item)) {
      throw new AssertionError(
        message ??
          `Expected array to NOT include ${JSON.stringify(item)}`
      );
    }
  }

  assertHasProperty(obj: Record<string, unknown>, key: string, message?: string): void {
    if (!(key in obj)) {
      throw new AssertionError(
        message ?? `Expected object to have property '${key}'`
      );
    }
  }

  assertType(value: unknown, expectedType: string, message?: string): void {
    if (typeof value !== expectedType) {
      throw new AssertionError(
        message ??
          `Expected type '${expectedType}', got '${typeof value}'`
      );
    }
  }

  assertGreaterThan(actual: number, min: number, message?: string): void {
    if (actual <= min) {
      throw new AssertionError(
        message ?? `Expected ${actual} > ${min}`
      );
    }
  }

  assertGreaterOrEqual(actual: number, min: number, message?: string): void {
    if (actual < min) {
      throw new AssertionError(
        message ?? `Expected ${actual} >= ${min}`
      );
    }
  }

  assertLessThan(actual: number, max: number, message?: string): void {
    if (actual >= max) {
      throw new AssertionError(
        message ?? `Expected ${actual} < ${max}`
      );
    }
  }

  assertLength(arr: unknown[], expected: number, message?: string): void {
    if (arr.length !== expected) {
      throw new AssertionError(
        message ?? `Expected array length ${expected}, got ${arr.length}`
      );
    }
  }

  assertStringContains(str: string, substring: string, message?: string): void {
    if (!str.includes(substring)) {
      throw new AssertionError(
        message ??
          `Expected string to contain '${substring}', got '${str.slice(0, 200)}'`
      );
    }
  }

  assertMatches(str: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(str)) {
      throw new AssertionError(
        message ??
          `Expected string to match ${pattern}, got '${str.slice(0, 200)}'`
      );
    }
  }

  assertIdValid(id: string, message?: string): void {
    // JMAP IDs: 1-255 chars, [A-Za-z0-9_-]
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(id)) {
      throw new AssertionError(
        message ?? `Invalid JMAP Id format: '${id}'`
      );
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object")
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bArr = b as unknown[];
    if (a.length !== bArr.length) return false;
    return a.every((v, i) => deepEqual(v, bArr[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => k in bObj && deepEqual(aObj[k], bObj[k]));
}

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}
