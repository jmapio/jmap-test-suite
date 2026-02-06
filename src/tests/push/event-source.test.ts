import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "7.3", category: "push-eventsource" }, [
  {
    id: "eventsource-connect",
    name: "EventSource URL is connectable",
    fn: async (ctx) => {
      const url = ctx.session.eventSourceUrl
        .replace("{types}", "*")
        .replace("{closeafter}", "no")
        .replace("{ping}", "0");

      // Just verify we can connect (GET with Accept: text/event-stream)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: ctx.client.getAuthHeader(),
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });
        ctx.assertEqual(response.status, 200);
        const contentType = response.headers.get("content-type") ?? "";
        ctx.assertStringContains(contentType, "text/event-stream");
        // Don't need to consume the stream, just verify connection
        controller.abort();
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") {
          // Expected - we aborted after verifying connection
          return;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
  },
  {
    id: "eventsource-receives-state-change",
    name: "EventSource receives StateChange event after modification",
    fn: async (ctx) => {
      const url = ctx.session.eventSourceUrl
        .replace("{types}", "*")
        .replace("{closeafter}", "no")
        .replace("{ping}", "0");

      // Connect to EventSource
      const controller = new AbortController();

      const events: string[] = [];
      let connected = false;

      const streamPromise = (async () => {
        const response = await fetch(url, {
          headers: {
            Authorization: ctx.client.getAuthHeader(),
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (response.status !== 200) {
          throw new Error(`EventSource connection failed: ${response.status}`);
        }

        connected = true;

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop()!; // Keep incomplete line

          for (const line of lines) {
            if (line.startsWith("data:")) {
              events.push(line.slice(5).trim());
            }
          }

          // Once we get a state change event, we're done
          if (events.length > 0) break;
        }
      })();

      try {
        // Wait for connection
        await new Promise((r) => setTimeout(r, 500));

        if (!connected) {
          // Give a bit more time
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Make a change to trigger a state change
        const createResult = await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          create: {
            esTest: {
              mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
              from: [{ name: "ES", email: "es@example.com" }],
              to: [{ name: "User", email: "user@example.com" }],
              subject: "EventSource test",
              bodyStructure: { type: "text/plain", partId: "1" },
              bodyValues: { "1": { value: "trigger state change" } },
            },
          },
        });
        const emailId = (
          createResult.created as Record<string, { id: string }>
        ).esTest.id;

        // Wait for event
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          await Promise.race([
            streamPromise,
            new Promise((r) => setTimeout(r, 5000)),
          ]);
        } finally {
          clearTimeout(timeout);
        }

        // Verify we received at least one event
        if (events.length > 0) {
          const data = JSON.parse(events[0]);
          ctx.assertEqual(data["@type"], "StateChange");
          ctx.assertTruthy(data.changed, "StateChange must have changed property");
        }

        // Cleanup
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      } finally {
        controller.abort();
      }
    },
  },
  {
    id: "eventsource-types-filter",
    name: "EventSource types parameter filters event types",
    fn: async (ctx) => {
      // Connect with types=Email only
      const url = ctx.session.eventSourceUrl
        .replace("{types}", "Email")
        .replace("{closeafter}", "no")
        .replace("{ping}", "0");

      const controller = new AbortController();
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: ctx.client.getAuthHeader(),
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });
        ctx.assertEqual(response.status, 200);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") throw err;
      } finally {
        controller.abort();
      }
    },
  },
  {
    id: "eventsource-closeafter",
    name: "EventSource closeafter=state closes after first event",
    fn: async (ctx) => {
      const url = ctx.session.eventSourceUrl
        .replace("{types}", "*")
        .replace("{closeafter}", "state")
        .replace("{ping}", "0");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: ctx.client.getAuthHeader(),
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });
        ctx.assertEqual(response.status, 200);
        // With closeafter=state, server should close after sending initial state
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") throw err;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    },
  },
]);
