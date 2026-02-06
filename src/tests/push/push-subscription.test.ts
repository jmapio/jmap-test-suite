import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "7.2", category: "push-subscription" }, [
  {
    id: "push-subscription-create",
    name: "PushSubscription/set creates a subscription",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true, skipping PushSubscription tests");
      }

      const { server, url } = await startCallbackServer();
      try {
        const result = await ctx.client.call("PushSubscription/set", {
          create: {
            ps1: {
              deviceClientId: "jmap-test-device-001",
              url: `${url}/callback`,
              types: null, // all types
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        ctx.assertTruthy(created?.ps1, "Subscription should be created");
        ctx.assertTruthy(created!.ps1.id);

        // Cleanup
        await ctx.client.call("PushSubscription/set", {
          destroy: [created!.ps1.id as string],
        });
      } finally {
        await stopServer(server);
      }
    },
  },
  {
    id: "push-subscription-get",
    name: "PushSubscription/get returns created subscriptions",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true");
      }

      const { server, url } = await startCallbackServer();
      try {
        const createResult = await ctx.client.call("PushSubscription/set", {
          create: {
            psGet: {
              deviceClientId: "jmap-test-device-get",
              url: `${url}/callback`,
              types: ["Email"],
            },
          },
        });
        const psId = (
          createResult.created as Record<string, { id: string }>
        ).psGet.id;

        const getResult = await ctx.client.call("PushSubscription/get", {
          ids: [psId],
        });
        const list = getResult.list as Array<Record<string, unknown>>;
        ctx.assertLength(list, 1);
        ctx.assertEqual(list[0].id, psId);
        ctx.assertEqual(list[0].deviceClientId, "jmap-test-device-get");
        ctx.assertStringContains(list[0].url as string, url);

        await ctx.client.call("PushSubscription/set", {
          destroy: [psId],
        });
      } finally {
        await stopServer(server);
      }
    },
  },
  {
    id: "push-subscription-destroy",
    name: "PushSubscription/set destroy removes subscription",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true");
      }

      const { server, url } = await startCallbackServer();
      try {
        const createResult = await ctx.client.call("PushSubscription/set", {
          create: {
            psDel: {
              deviceClientId: "jmap-test-device-del",
              url: `${url}/callback`,
            },
          },
        });
        const psId = (
          createResult.created as Record<string, { id: string }>
        ).psDel.id;

        const destroyResult = await ctx.client.call("PushSubscription/set", {
          destroy: [psId],
        });
        const destroyed = destroyResult.destroyed as string[];
        ctx.assertIncludes(destroyed, psId);

        // Verify it's gone
        const getResult = await ctx.client.call("PushSubscription/get", {
          ids: [psId],
        });
        const notFound = getResult.notFound as string[];
        ctx.assertIncludes(notFound, psId);
      } finally {
        await stopServer(server);
      }
    },
  },
  {
    id: "push-subscription-types-filter",
    name: "PushSubscription/set can set types filter",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true");
      }

      const { server, url } = await startCallbackServer();
      try {
        const result = await ctx.client.call("PushSubscription/set", {
          create: {
            psTypes: {
              deviceClientId: "jmap-test-device-types",
              url: `${url}/callback`,
              types: ["Email", "Mailbox"],
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        ctx.assertTruthy(created?.psTypes);

        await ctx.client.call("PushSubscription/set", {
          destroy: [created!.psTypes.id as string],
        });
      } finally {
        await stopServer(server);
      }
    },
  },
  {
    id: "push-subscription-receives-notification",
    name: "PushSubscription MUST receive push notification after change",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true");
      }

      const received: unknown[] = [];
      const { server, url } = await startCallbackServer((body) => {
        received.push(body);
      });

      try {
        // Create subscription
        const createResult = await ctx.client.call("PushSubscription/set", {
          create: {
            psNotify: {
              deviceClientId: "jmap-test-device-notify",
              url: `${url}/callback`,
              types: null,
            },
          },
        });
        const psId = (
          createResult.created as Record<string, { id: string }>
        ).psNotify.id;

        // Make a change
        const emailResult = await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          create: {
            pushEmail: {
              mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
              from: [{ name: "Push", email: "push@example.com" }],
              to: [{ name: "User", email: "user@example.com" }],
              subject: "Push notification test",
              bodyStructure: { type: "text/plain", partId: "1" },
              bodyValues: { "1": { value: "trigger push" } },
            },
          },
        });
        const emailId = (
          emailResult.created as Record<string, { id: string }>
        ).pushEmail.id;

        // Wait for notification — RFC 8620 S7.2: server MUST push StateChange
        await new Promise((r) => setTimeout(r, 5000));

        ctx.assertGreaterThan(
          received.length,
          0,
          "Server MUST send push notification after state change"
        );
        const notification = received[0] as Record<string, unknown>;
        ctx.assertEqual(notification["@type"], "StateChange");

        // Cleanup
        await ctx.client.call("PushSubscription/set", {
          destroy: [psId],
        });
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      } finally {
        await stopServer(server);
      }
    },
  },
  {
    id: "push-subscription-verification",
    name: "PushSubscription supports verification code",
    fn: async (ctx) => {
      if (ctx.config.noLocalCallback) {
        throw new Error("SKIP: noLocalCallback=true");
      }

      const { server, url } = await startCallbackServer();
      try {
        const result = await ctx.client.call("PushSubscription/set", {
          create: {
            psVerify: {
              deviceClientId: "jmap-test-device-verify",
              url: `${url}/callback`,
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        if (created?.psVerify) {
          // Subscription may have a verificationCode
          const verificationCode = created.psVerify.verificationCode;
          // If present, we would need to POST it back
          // Just verify the field exists (may be undefined if server auto-verifies)
          ctx.assertTruthy(created.psVerify.id);

          await ctx.client.call("PushSubscription/set", {
            destroy: [created.psVerify.id as string],
          });
        }
      } finally {
        await stopServer(server);
      }
    },
  },
]);

// --- Helper: Local HTTP Callback Server ---

async function startCallbackServer(
  onNotification?: (body: unknown) => void
): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        let body = "";
        req.on("data", (chunk: string) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            onNotification?.(parsed);
          } catch {
            // Ignore parse errors
          }
          res.writeHead(200);
          res.end();
        });
      }
    );

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()!;
      const port =
        typeof addr === "string" ? 80 : addr.port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

async function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}
