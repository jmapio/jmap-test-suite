import type { AccountConfig } from "../types/config.js";

export interface TransportOptions {
  authMethod: "basic" | "bearer";
  account: AccountConfig;
  timeout: number;
  verbose: boolean;
}

export class Transport {
  private authHeader: string;
  private timeout: number;
  private verbose: boolean;

  constructor(options: TransportOptions) {
    this.timeout = options.timeout;
    this.verbose = options.verbose;

    if (options.authMethod === "basic") {
      const encoded = Buffer.from(
        `${options.account.username}:${options.account.password}`
      ).toString("base64");
      this.authHeader = `Basic ${encoded}`;
    } else {
      this.authHeader = `Bearer ${options.account.password}`;
    }
  }

  async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      ...(options?.headers as Record<string, string>),
    };

    if (!headers["Content-Type"] && options?.method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    if (this.verbose) {
      process.stderr.write(`→ ${options?.method ?? "GET"} ${url}\n`);
      if (options?.body && typeof options.body === "string") {
        process.stderr.write(`  Body: ${options.body.slice(0, 500)}\n`);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (this.verbose) {
      process.stderr.write(`← ${response.status} ${response.statusText}\n`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new TransportError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        text
      );
    }

    const json = await response.json() as T;

    if (this.verbose) {
      process.stderr.write(`  Response: ${JSON.stringify(json).slice(0, 500)}\n`);
    }

    return json;
  }

  async fetchRaw(
    url: string,
    options?: RequestInit
  ): Promise<{ status: number; headers: Headers; body: ArrayBuffer }> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      ...(options?.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    return {
      status: response.status,
      headers: response.headers,
      body: await response.arrayBuffer(),
    };
  }

  async upload(
    url: string,
    data: Uint8Array | Buffer,
    contentType: string
  ): Promise<Response> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": contentType,
      },
      body: data,
      signal: AbortSignal.timeout(this.timeout),
    });

    return response;
  }

  getAuthHeader(): string {
    return this.authHeader;
  }
}

export class TransportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "TransportError";
  }
}
