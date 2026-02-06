import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "3.2", category: "thread" }, [
  {
    id: "changes-no-changes",
    name: "Thread/changes with current state returns empty",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Thread/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });
      ctx.assertEqual(result.oldState, state);
      ctx.assertLength(result.created as string[], 0);
      ctx.assertLength(result.updated as string[], 0);
      ctx.assertLength(result.destroyed as string[], 0);
    },
  },
  {
    id: "changes-after-new-email",
    name: "Thread/changes reflects new thread after email creation",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Create a new email (new thread)
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          threadTest: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "New thread for changes test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (
        createResult.created as Record<string, { id: string }>
      ).threadTest.id;

      try {
        const changes = await ctx.client.call("Thread/changes", {
          accountId: ctx.accountId,
          sinceState: oldState,
        });
        const created = changes.created as string[];
        ctx.assertGreaterThan(
          created.length,
          0,
          "Should have at least one new thread"
        );
      } finally {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
  {
    id: "changes-after-email-destroy",
    name: "Thread/changes reflects destroyed thread after last email removed",
    fn: async (ctx) => {
      // Create an email
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          destroyThread: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Thread to destroy",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (
        createResult.created as Record<string, { id: string }>
      ).destroyThread.id;

      // Get thread id
      const emailGet = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["threadId"],
      });
      const threadId = (emailGet.list as Array<{ threadId: string }>)[0]
        .threadId;

      // Get current thread state
      const threadGet = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const midState = threadGet.state as string;

      // Destroy the email
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });

      const changes = await ctx.client.call("Thread/changes", {
        accountId: ctx.accountId,
        sinceState: midState,
      });
      const destroyed = changes.destroyed as string[];
      ctx.assertIncludes(destroyed, threadId);
    },
  },
  {
    id: "changes-response-structure",
    name: "Thread/changes response has required properties",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Thread/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.oldState, "string");
      ctx.assertType(result.newState, "string");
      ctx.assertType(result.hasMoreChanges, "boolean");
      ctx.assert(Array.isArray(result.created), "created must be array");
      ctx.assert(Array.isArray(result.updated), "updated must be array");
      ctx.assert(Array.isArray(result.destroyed), "destroyed must be array");
    },
  },
]);
