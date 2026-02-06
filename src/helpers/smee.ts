/**
 * Smee.io webhook proxy helper.
 *
 * Creates a temporary smee.io channel, connects via SSE, and collects
 * POST bodies forwarded by the proxy. No external dependencies — uses
 * built-in fetch with streaming.
 */

export interface SmeeChannel {
  /** Public HTTPS URL that can receive POST requests */
  url: string;
  /** Wait for at least `count` events total (or timeout). Returns collected bodies. */
  waitForEvents(count: number, timeoutMs: number): Promise<unknown[]>;
  /** Wait for an event matching a predicate (or timeout). Returns the match or undefined. */
  waitFor(
    predicate: (event: unknown) => boolean,
    timeoutMs: number,
  ): Promise<unknown | undefined>;
  /** All events received so far */
  readonly events: unknown[];
  /** Clear accumulated events */
  clear(): void;
  /** Disconnect from the SSE stream */
  close(): void;
}

/**
 * Create a new smee.io channel and connect to its SSE stream.
 * Returns `undefined` if smee.io is unreachable.
 */
export async function createSmeeChannel(): Promise<SmeeChannel | undefined> {
  // Step 1: Create a new channel by following the redirect from /new
  let channelUrl: string;
  try {
    const res = await fetch("https://smee.io/new", { redirect: "manual" });
    const location = res.headers.get("location");
    if (!location) {
      // Fallback: some environments follow redirects; read from body
      if (res.ok) {
        channelUrl = res.url;
      } else {
        return undefined;
      }
    } else {
      channelUrl = location;
    }
  } catch {
    return undefined;
  }

  // Step 2: Connect to the SSE stream
  const controller = new AbortController();
  const events: unknown[] = [];
  let readyResolve: (() => void) | undefined;
  const readyPromise = new Promise<void>((r) => {
    readyResolve = r;
  });

  const streamPromise = (async () => {
    try {
      const res = await fetch(channelUrl, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let currentData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentData += (currentData ? "\n" : "") + line.slice(5).trim();
          } else if (line === "") {
            // End of event
            if (currentEvent === "ready") {
              readyResolve?.();
            } else if (currentData) {
              try {
                const parsed = JSON.parse(currentData);
                // smee wraps the original POST body in a "body" field
                events.push(parsed.body ?? parsed);
              } catch {
                // non-JSON event, skip
              }
            }
            currentEvent = "";
            currentData = "";
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        // Unexpected error, resolve ready to unblock waiters
        readyResolve?.();
      }
    }
  })();

  // Wait until the SSE stream is ready (or timeout after 5s)
  const readyTimeout = new Promise<void>((r) => setTimeout(r, 5000));
  await Promise.race([readyPromise, readyTimeout]);

  return {
    url: channelUrl,
    events,
    waitForEvents(count: number, timeoutMs: number): Promise<unknown[]> {
      return new Promise((resolve) => {
        if (events.length >= count) {
          resolve([...events]);
          return;
        }

        const deadline = setTimeout(() => {
          resolve([...events]);
        }, timeoutMs);

        // Poll every 200ms
        const interval = setInterval(() => {
          if (events.length >= count) {
            clearTimeout(deadline);
            clearInterval(interval);
            resolve([...events]);
          }
        }, 200);
      });
    },
    waitFor(
      predicate: (event: unknown) => boolean,
      timeoutMs: number,
    ): Promise<unknown | undefined> {
      return new Promise((resolve) => {
        const found = events.find(predicate);
        if (found) {
          resolve(found);
          return;
        }

        const deadline = setTimeout(() => {
          clearInterval(interval);
          resolve(events.find(predicate));
        }, timeoutMs);

        const interval = setInterval(() => {
          const match = events.find(predicate);
          if (match) {
            clearTimeout(deadline);
            clearInterval(interval);
            resolve(match);
          }
        }, 200);
      });
    },
    clear() {
      events.length = 0;
    },
    close() {
      controller.abort();
    },
  };
}
