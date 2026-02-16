import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.6", category: "email" }, [
  {
    id: "set-destroy-single",
    name: "Email/set destroy single email",
    fn: async (ctx) => {
      // Create a temp email to destroy
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          destroyMe: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Destroy me",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createResult.created as Record<string, { id: string }>)
        .destroyMe.id;

      const destroyResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });
      ctx.assert(
        Array.isArray(destroyResult.destroyed),
        "Email/set destroyed must be an array when emails were destroyed, got " + JSON.stringify(destroyResult.destroyed)
      );
      const destroyed = destroyResult.destroyed as string[];
      ctx.assertIncludes(destroyed, emailId);

      // Verify it's gone
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
      });
      ctx.assert(
        Array.isArray(getResult.notFound),
        "Email/get notFound MUST be a String[] (RFC 8620 §5.1), got " + JSON.stringify(getResult.notFound)
      );
      const notFound = getResult.notFound as string[];
      ctx.assertIncludes(notFound, emailId);
    },
  },
  {
    id: "set-destroy-multiple",
    name: "Email/set destroy multiple emails at once",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          d1: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Destroy batch 1",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
          d2: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Destroy batch 2",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const created = createResult.created as Record<string, { id: string }>;
      const ids = [created.d1.id, created.d2.id];

      const destroyResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: ids,
      });
      ctx.assert(
        Array.isArray(destroyResult.destroyed),
        "Email/set destroyed must be an array when emails were destroyed, got " + JSON.stringify(destroyResult.destroyed)
      );
      const destroyed = destroyResult.destroyed as string[];
      ctx.assertLength(destroyed, 2);
    },
  },
  {
    id: "set-destroy-not-found",
    name: "Email/set destroy returns notDestroyed for unknown id",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: ["nonexistent-email-xyz"],
      });
      const notDestroyed = result.notDestroyed as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notDestroyed,
        "Email/set notDestroyed must not be null when destroying a nonexistent id"
      );
      ctx.assertTruthy(
        notDestroyed!["nonexistent-email-xyz"],
        "Expected notDestroyed to contain error for 'nonexistent-email-xyz'"
      );
      ctx.assertEqual(notDestroyed!["nonexistent-email-xyz"].type, "notFound");
    },
  },
  {
    id: "set-destroy-removes-from-all-mailboxes",
    name: "Email/set destroy removes email from all mailboxes",
    fn: async (ctx) => {
      // Create in multiple mailboxes
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          multiMb: {
            mailboxIds: {
              [ctx.roleMailboxes["inbox"]]: true,
              [ctx.mailboxIds["folderA"]]: true,
            },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Multi-mailbox destroy",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createResult.created as Record<string, { id: string }>)
        .multiMb.id;

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });

      // Verify it's not in any mailbox
      const q1 = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
      });
      ctx.assertNotIncludes(q1.ids as string[], emailId);

      const q2 = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderA"] },
      });
      ctx.assertNotIncludes(q2.ids as string[], emailId);
    },
  },
]);
