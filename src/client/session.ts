import type { Session } from "../types/jmap-core.js";
import type { Transport } from "./transport.js";

export async function fetchSession(
  transport: Transport,
  sessionUrl: string
): Promise<Session> {
  const session = await transport.fetchJson<Session>(sessionUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  validateSession(session);
  return session;
}

function validateSession(session: Session): void {
  const required: (keyof Session)[] = [
    "capabilities",
    "accounts",
    "primaryAccounts",
    "username",
    "apiUrl",
    "downloadUrl",
    "uploadUrl",
    "eventSourceUrl",
    "state",
  ];

  for (const key of required) {
    if (session[key] == null) {
      throw new Error(`Session resource missing required property: ${key}`);
    }
  }

  if (typeof session.capabilities !== "object") {
    throw new Error("Session 'capabilities' must be an object");
  }

  if (typeof session.accounts !== "object") {
    throw new Error("Session 'accounts' must be an object");
  }

  if (typeof session.primaryAccounts !== "object") {
    throw new Error("Session 'primaryAccounts' must be an object");
  }

  if (!session.capabilities["urn:ietf:params:jmap:core"]) {
    throw new Error("Session must advertise urn:ietf:params:jmap:core capability");
  }
}

export function getMailAccountId(session: Session): string {
  const accountId =
    session.primaryAccounts["urn:ietf:params:jmap:mail"];

  if (!accountId) {
    throw new Error(
      "No primary account for urn:ietf:params:jmap:mail capability"
    );
  }

  const account = session.accounts[accountId];
  if (!account) {
    throw new Error(
      `Primary mail account ${accountId} not found in session accounts`
    );
  }

  return accountId;
}

export function hasCapability(session: Session, capability: string): boolean {
  return capability in session.capabilities;
}

export function getAccountCapabilities(
  session: Session,
  accountId: string
): Record<string, unknown> {
  const account = session.accounts[accountId];
  if (!account) {
    throw new Error(`Account ${accountId} not found in session`);
  }
  return account.accountCapabilities;
}
