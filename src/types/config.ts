export interface UserConfig {
  username: string;
  password: string;
}

export interface Config {
  sessionUrl: string;
  users: {
    primary: UserConfig;
    secondary?: UserConfig;
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

  if (typeof obj.users !== "object" || obj.users === null) {
    throw new Error("Config requires 'users' object");
  }

  const users = obj.users as Record<string, unknown>;

  if (typeof users.primary !== "object" || users.primary === null) {
    throw new Error("Config requires 'users.primary' object");
  }

  const primary = users.primary as Record<string, unknown>;
  if (typeof primary.username !== "string" || typeof primary.password !== "string") {
    throw new Error("Config 'users.primary' requires 'username' and 'password' strings");
  }

  let secondary: UserConfig | undefined;
  if (users.secondary != null) {
    const sec = users.secondary as Record<string, unknown>;
    if (typeof sec.username !== "string" || typeof sec.password !== "string") {
      throw new Error("Config 'users.secondary' requires 'username' and 'password' strings");
    }
    secondary = { username: sec.username, password: sec.password };
  }

  return {
    sessionUrl: obj.sessionUrl,
    users: {
      primary: { username: primary.username, password: primary.password },
      secondary,
    },
    authMethod: (obj.authMethod as "basic" | "bearer") || "basic",
    timeout: typeof obj.timeout === "number" ? obj.timeout : 30000,
    noLocalCallback: obj.noLocalCallback === true,
    verbose: obj.verbose === true,
  };
}
