import type {
  Invocation,
  JmapRequest,
  JmapResponse,
  Session,
  UploadResponse,
  ResultReference,
  Id,
} from "../types/jmap-core.js";
import type { HttpExchange } from "../types/report.js";
import { TransportError, type Transport } from "./transport.js";
import { fetchSession, getMailAccountId } from "./session.js";

export class JmapClient {
  public session!: Session;
  public accountId!: string;
  private transport: Transport;
  private sessionUrl: string;
  private exchanges: HttpExchange[] = [];

  /** Last known state per type name (e.g., "Mailbox", "Email") */
  public states: Record<string, string> = {};

  constructor(transport: Transport, sessionUrl: string) {
    this.transport = transport;
    this.sessionUrl = sessionUrl;
  }

  drainExchanges(): HttpExchange[] {
    const drained = this.exchanges;
    this.exchanges = [];
    return drained;
  }

  async initialize(): Promise<void> {
    this.session = await fetchSession(this.transport, this.sessionUrl);
    this.accountId = getMailAccountId(this.session);
  }

  async refreshSession(): Promise<void> {
    this.session = await fetchSession(this.transport, this.sessionUrl);
  }

  /**
   * Make a JMAP API request with one or more method calls.
   */
  async request(
    using: string[],
    methodCalls: Invocation[],
    createdIds?: Record<Id, Id>
  ): Promise<JmapResponse> {
    const request: JmapRequest = {
      using,
      methodCalls,
    };
    if (createdIds) {
      request.createdIds = createdIds;
    }

    const url = this.session.apiUrl;
    try {
      const response = await this.transport.fetchJson<JmapResponse>(url, {
        method: "POST",
        body: JSON.stringify(request),
      });
      this.exchanges.push({
        request: { method: "POST", url, body: request },
        response: { status: 200, body: response },
      });
      return response;
    } catch (err) {
      if (err instanceof TransportError) {
        let respBody: unknown = err.body;
        try { respBody = JSON.parse(err.body); } catch {}
        this.exchanges.push({
          request: { method: "POST", url, body: request },
          response: { status: err.status, body: respBody },
        });
      }
      throw err;
    }
  }

  /**
   * Convenience: make a single method call and return its response args.
   */
  async call(
    methodName: string,
    args: Record<string, unknown>,
    callId: string = "c0"
  ): Promise<Record<string, unknown>> {
    const response = await this.request(
      this.defaultUsing(),
      [[methodName, args, callId]]
    );

    const [name, responseArgs] = response.methodResponses[0];

    if (name === "error") {
      const err = responseArgs as Record<string, unknown>;
      throw new JmapMethodError(
        err.type as string,
        err.description as string | undefined
      );
    }

    return responseArgs as Record<string, unknown>;
  }

  /**
   * Make a raw JMAP API request and return the full response
   * (including error responses without throwing).
   */
  async rawRequest(
    using: string[],
    methodCalls: Invocation[],
    createdIds?: Record<Id, Id>
  ): Promise<JmapResponse> {
    return this.request(using, methodCalls, createdIds);
  }

  /**
   * Make a raw HTTP POST to apiUrl with arbitrary body.
   * Returns the raw response for testing error handling.
   */
  async rawPost(
    body: string,
    contentType: string = "application/json"
  ): Promise<{ status: number; headers: Headers; body: ArrayBuffer }> {
    const url = this.session.apiUrl;
    const result = await this.transport.fetchRaw(url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    let respBody: unknown;
    try {
      respBody = JSON.parse(new TextDecoder().decode(result.body));
    } catch {
      respBody = `<binary ${result.body.byteLength} bytes>`;
    }
    this.exchanges.push({
      request: { method: "POST", url, body },
      response: { status: result.status, body: respBody },
    });
    return result;
  }

  /**
   * Upload binary data and return the upload response.
   */
  async upload(
    data: Uint8Array | Buffer,
    contentType: string = "application/octet-stream",
    accountId?: string
  ): Promise<UploadResponse> {
    const acctId = accountId ?? this.accountId;
    const url = this.session.uploadUrl.replace("{accountId}", acctId);

    const response = await this.transport.upload(url, data, contentType);

    if (!response.ok) {
      const text = await response.text();
      this.exchanges.push({
        request: { method: "POST", url, body: `<upload ${data.byteLength} bytes ${contentType}>` },
        response: { status: response.status, body: text },
      });
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as UploadResponse;
    this.exchanges.push({
      request: { method: "POST", url, body: `<upload ${data.byteLength} bytes ${contentType}>` },
      response: { status: response.status, body: result },
    });
    return result;
  }

  /**
   * Download a blob by its ID.
   */
  async download(
    blobId: string,
    type: string = "application/octet-stream",
    name: string = "download",
    accountId?: string
  ): Promise<{ status: number; headers: Headers; body: ArrayBuffer }> {
    const acctId = accountId ?? this.accountId;
    const url = this.session.downloadUrl
      .replace("{accountId}", acctId)
      .replace("{blobId}", blobId)
      .replace("{type}", encodeURIComponent(type))
      .replace("{name}", encodeURIComponent(name));

    const result = await this.transport.fetchRaw(url, { method: "GET" });
    this.exchanges.push({
      request: { method: "GET", url },
      response: { status: result.status, body: `<binary ${result.body.byteLength} bytes>` },
    });
    return result;
  }

  /**
   * Store the state for a type from a /get or /set response.
   */
  updateState(typeName: string, state: string): void {
    this.states[typeName] = state;
  }

  /**
   * Get the last known state for a type.
   */
  getState(typeName: string): string | undefined {
    return this.states[typeName];
  }

  /**
   * Default `using` array for mail operations.
   */
  defaultUsing(): string[] {
    const using = [
      "urn:ietf:params:jmap:core",
      "urn:ietf:params:jmap:mail",
    ];
    if (this.session.capabilities["urn:ietf:params:jmap:submission"]) {
      using.push("urn:ietf:params:jmap:submission");
    }
    if (this.session.capabilities["urn:ietf:params:jmap:vacationresponse"]) {
      using.push("urn:ietf:params:jmap:vacationresponse");
    }
    return using;
  }

  /**
   * Build a ResultReference for use in method call arguments.
   */
  static ref(resultOf: string, name: string, path: string): ResultReference {
    return { resultOf, name, path };
  }

  /**
   * Get the transport's auth header (useful for EventSource).
   */
  getAuthHeader(): string {
    return this.transport.getAuthHeader();
  }
}

export class JmapMethodError extends Error {
  constructor(
    public readonly type: string,
    public readonly description?: string
  ) {
    super(`JMAP method error: ${type}${description ? ` - ${description}` : ""}`);
    this.name = "JmapMethodError";
  }
}
