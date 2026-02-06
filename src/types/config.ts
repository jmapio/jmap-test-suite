export interface AccountConfig {
  username: string;
  password: string;
}

export interface Config {
  sessionUrl: string;
  accounts: {
    primary: AccountConfig;
    secondary?: AccountConfig;
  };
  authMethod: "basic" | "bearer";
  timeout: number;
  noLocalCallback: boolean;
  verbose: boolean;
}

export function validateConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.sessionUrl !== "string" || !obj.sessionUrl) {
    throw new Error("Config requires 'sessionUrl' string");
  }

  if (typeof obj.accounts !== "object" || obj.accounts === null) {
    throw new Error("Config requires 'accounts' object");
  }

  const accounts = obj.accounts as Record<string, unknown>;

  if (typeof accounts.primary !== "object" || accounts.primary === null) {
    throw new Error("Config requires 'accounts.primary' object");
  }

  const primary = accounts.primary as Record<string, unknown>;
  if (typeof primary.username !== "string" || typeof primary.password !== "string") {
    throw new Error("Config 'accounts.primary' requires 'username' and 'password' strings");
  }

  let secondary: AccountConfig | undefined;
  if (accounts.secondary != null) {
    const sec = accounts.secondary as Record<string, unknown>;
    if (typeof sec.username !== "string" || typeof sec.password !== "string") {
      throw new Error("Config 'accounts.secondary' requires 'username' and 'password' strings");
    }
    secondary = { username: sec.username, password: sec.password };
  }

  return {
    sessionUrl: obj.sessionUrl,
    accounts: {
      primary: { username: primary.username, password: primary.password },
      secondary,
    },
    authMethod: (obj.authMethod as "basic" | "bearer") || "basic",
    timeout: typeof obj.timeout === "number" ? obj.timeout : 30000,
    noLocalCallback: obj.noLocalCallback === true,
    verbose: obj.verbose === true,
  };
}
