import { defineTests } from "../../runner/test-registry.js";
import type { TestContext } from "../../runner/test-context.js";
import { createSmeeChannel } from "../../helpers/smee.js";

const needsSmee = (ctx: TestContext): true | string =>
  ctx.smeeChannel ? true : "smee.io unavailable";

defineTests({ rfc: "RFC8620", section: "7.2", category: "push-subscription" }, [
  {
    id: "push-subscription-reject-non-https",
    name: "PushSubscription/set MUST reject non-https URL",
    fn: async (ctx) => {
      const result = await ctx.client.call("PushSubscription/set", {
        create: {
          bad: {
            deviceClientId: "jmap-test-reject-http",
            url: "http://example.com/push",
          },
        },
      });
      const notCreated = result.notCreated as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notCreated?.bad,
        "Server MUST reject PushSubscription with non-https URL (RFC 8620 §7.2)"
      );
    },
  },
  {
    // Run notification test first: it needs a clean smee.io rate-limit
    // window, before CRUD tests trigger multiple PushVerification POSTs.
    id: "push-subscription-receives-notification",
    name: "PushSubscription MUST receive push notification after change",
    runIf: needsSmee,
    fn: async (ctx) => {
      // Use a dedicated smee channel to avoid interference from other tests.
      const smee = await createSmeeChannel();
      if (!smee) {
        throw new Error("Could not create dedicated smee channel");
      }

      try {
        // Create subscription pointing to the dedicated channel
        const createResult = await ctx.client.call("PushSubscription/set", {
          create: {
            psNotify: {
              deviceClientId: "jmap-test-device-notify",
              url: smee.url,
              types: null,
            },
          },
        });
        const psId = (
          createResult.created as Record<string, { id: string }>
        ).psNotify.id;

        // Server may send a PushVerification (RFC 8620 §7.2.2).
        // If so, complete verification before expecting StateChange.
        const isVerification = (e: unknown): boolean => {
          const obj = e as Record<string, unknown>;
          return (
            obj["@type"] === "PushVerification" &&
            obj.pushSubscriptionId === psId
          );
        };

        const verification = await smee.waitFor(isVerification, 5000);
        if (verification) {
          const code = (verification as Record<string, unknown>)
            .verificationCode as string;
          await ctx.client.call("PushSubscription/set", {
            update: {
              [psId]: { verificationCode: code },
            },
          });
        }

        // Make a change to trigger a push notification
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

        // Wait for StateChange — RFC 8620 §7.2: server MUST push StateChange
        const isStateChange = (e: unknown): boolean =>
          (e as Record<string, unknown>)["@type"] === "StateChange";

        const notification = await smee.waitFor(isStateChange, 10000);

        ctx.assertTruthy(
          notification,
          "Server MUST send push notification after state change"
        );
        ctx.assertEqual(
          (notification as Record<string, unknown>)["@type"],
          "StateChange"
        );

        // Cleanup
        await ctx.client.call("PushSubscription/set", {
          destroy: [psId],
        });
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      } finally {
        smee.close();
      }
    },
  },
  {
    id: "push-subscription-create",
    name: "PushSubscription/set creates a subscription",
    runIf: needsSmee,
    fn: async (ctx) => {
      const result = await ctx.client.call("PushSubscription/set", {
        create: {
          ps1: {
            deviceClientId: "jmap-test-device-001",
            url: ctx.smeeChannel!.url,
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
    },
  },
  {
    id: "push-subscription-get",
    name: "PushSubscription/get returns created subscriptions",
    runIf: needsSmee,
    fn: async (ctx) => {
      const result = await ctx.client.call("PushSubscription/set", {
        create: {
          psGet: {
            deviceClientId: "jmap-test-device-get",
            url: ctx.smeeChannel!.url,
            types: ["Email"],
          },
        },
      });
      const psId = (
        result.created as Record<string, { id: string }>
      ).psGet.id;

      const getResult = await ctx.client.call("PushSubscription/get", {
        ids: [psId],
      });
      const list = getResult.list as Array<Record<string, unknown>>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, psId);
      ctx.assertEqual(list[0].deviceClientId, "jmap-test-device-get");
      if (typeof list[0].url === "string") {
        ctx.assertStringContains(list[0].url, ctx.smeeChannel!.url);
      }

      await ctx.client.call("PushSubscription/set", {
        destroy: [psId],
      });
    },
  },
  {
    id: "push-subscription-destroy",
    name: "PushSubscription/set destroy removes subscription",
    runIf: needsSmee,
    fn: async (ctx) => {
      const createResult = await ctx.client.call("PushSubscription/set", {
        create: {
          psDel: {
            deviceClientId: "jmap-test-device-del",
            url: ctx.smeeChannel!.url,
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
    },
  },
  {
    id: "push-subscription-types-filter",
    name: "PushSubscription/set can set types filter",
    runIf: needsSmee,
    fn: async (ctx) => {
      const result = await ctx.client.call("PushSubscription/set", {
        create: {
          psTypes: {
            deviceClientId: "jmap-test-device-types",
            url: ctx.smeeChannel!.url,
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
    },
  },
  {
    id: "push-subscription-verification",
    name: "PushSubscription supports verification code",
    runIf: needsSmee,
    fn: async (ctx) => {
      const result = await ctx.client.call("PushSubscription/set", {
        create: {
          psVerify: {
            deviceClientId: "jmap-test-device-verify",
            url: ctx.smeeChannel!.url,
          },
        },
      });
      const created = result.created as Record<
        string,
        Record<string, unknown>
      > | null;
      if (created?.psVerify) {
        ctx.assertTruthy(created.psVerify.id);

        await ctx.client.call("PushSubscription/set", {
          destroy: [created.psVerify.id as string],
        });
      }
    },
  },
]);
