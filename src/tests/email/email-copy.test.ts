import { defineTests } from "../../runner/test-registry.js";
import { JmapMethodError } from "../../client/jmap-client.js";

defineTests({ rfc: "RFC8621", section: "4.7", category: "email" }, [
  {
    id: "copy-same-account-error",
    name: "Email/copy rejects same-account copy",
    fn: async (ctx) => {
      try {
        await ctx.client.call("Email/copy", {
          fromAccountId: ctx.accountId,
          accountId: ctx.accountId,
          create: {
            x: {
              id: "placeholder",
              mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            },
          },
        });
        ctx.assert(
          false,
          "Server must reject Email/copy when fromAccountId equals accountId"
        );
      } catch (err) {
        if (err instanceof JmapMethodError) {
          ctx.assertTruthy(
            err.type,
            "Error response must include a type"
          );
        }
      }
    },
  },
  {
    id: "copy-cross-account",
    name: "Email/copy copies email to another account",
    fn: async (ctx) => {
      if (!ctx.secondaryClient) {
        throw new Error("SKIP: No secondary account configured");
      }

      const secondaryAccountId = ctx.secondaryClient.accountId;

      // Create a source email in the primary account
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          src: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Cross-account copy source",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body to copy" } },
          },
        },
      });
      const srcId = (createResult.created as Record<string, { id: string }>)
        .src.id;

      // Get the inbox in the secondary account
      const mbResult = await ctx.secondaryClient.call("Mailbox/get", {
        accountId: secondaryAccountId,
        ids: null,
      });
      const secMailboxes = mbResult.list as Array<{
        id: string;
        role: string | null;
      }>;
      const secInbox = secMailboxes.find((m) => m.role === "inbox");
      ctx.assertTruthy(secInbox, "Secondary account must have an inbox");

      try {
        // Copy from primary to secondary using the primary client
        const copyResult = await ctx.client.call("Email/copy", {
          fromAccountId: ctx.accountId,
          accountId: secondaryAccountId,
          create: {
            copied: {
              id: srcId,
              mailboxIds: { [secInbox!.id]: true },
              keywords: { $seen: true },
            },
          },
        });
        const created = copyResult.created as Record<
          string,
          { id: string }
        > | null;
        ctx.assertTruthy(created?.copied, "copied email must be in created map");
        ctx.assertTruthy(created!.copied.id, "copied email must have an id");

        // Cleanup copy in secondary account
        await ctx.secondaryClient.call("Email/set", {
          accountId: secondaryAccountId,
          destroy: [created!.copied.id],
        });
      } finally {
        // Cleanup source in primary account
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [srcId],
        });
      }
    },
  },
  {
    id: "copy-not-found",
    name: "Email/copy returns notCreated for invalid source id",
    fn: async (ctx) => {
      if (!ctx.secondaryClient) {
        throw new Error("SKIP: No secondary account configured");
      }

      const secondaryAccountId = ctx.secondaryClient.accountId;

      // Get the inbox in the secondary account
      const mbResult = await ctx.secondaryClient.call("Mailbox/get", {
        accountId: secondaryAccountId,
        ids: null,
      });
      const secMailboxes = mbResult.list as Array<{
        id: string;
        role: string | null;
      }>;
      const secInbox = secMailboxes.find((m) => m.role === "inbox");
      ctx.assertTruthy(secInbox, "Secondary account must have an inbox");

      const result = await ctx.client.call("Email/copy", {
        fromAccountId: ctx.accountId,
        accountId: secondaryAccountId,
        create: {
          bad: {
            id: "nonexistent-email-xyz",
            mailboxIds: { [secInbox!.id]: true },
          },
        },
      });
      const notCreated = result.notCreated as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(notCreated?.bad, "notCreated must contain the bad entry");
    },
  },
]);
