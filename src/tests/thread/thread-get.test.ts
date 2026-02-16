import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "3.1", category: "thread" }, [
  {
    id: "get-thread-by-id",
    name: "Thread/get returns thread with emailIds",
    fn: async (ctx) => {
      // Get the threadId from a known threaded email
      const emailId = ctx.emailIds["thread-starter"];
      const emailResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["threadId"],
      });
      const threadId = (emailResult.list as Array<{ threadId: string }>)[0]
        .threadId;

      const result = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [threadId],
      });
      const list = result.list as Array<{
        id: string;
        emailIds: string[];
      }>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, threadId);
      ctx.assert(Array.isArray(list[0].emailIds), "emailIds must be array");
      ctx.assertGreaterOrEqual(
        list[0].emailIds.length,
        3,
        "Thread should have at least 3 emails"
      );
      ctx.client.updateState("Thread", result.state as string);
    },
  },
  {
    id: "get-thread-email-ids-order",
    name: "Thread/get emailIds are ordered by receivedAt",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["thread-starter"];
      const emailResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["threadId"],
      });
      const threadId = (emailResult.list as Array<{ threadId: string }>)[0]
        .threadId;

      const threadResult = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [threadId],
      });
      const thread = (
        threadResult.list as Array<{ emailIds: string[] }>
      )[0];

      // Fetch receivedAt for all emails in the thread
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: thread.emailIds,
        properties: ["receivedAt"],
      });
      const list = getResult.list as Array<{
        id: string;
        receivedAt: string;
      }>;
      const idToDate = new Map(
        list.map((e) => [e.id, new Date(e.receivedAt).getTime()])
      );

      // Verify order
      for (let i = 1; i < thread.emailIds.length; i++) {
        const prev = idToDate.get(thread.emailIds[i - 1]);
        const curr = idToDate.get(thread.emailIds[i]);
        if (prev !== undefined && curr !== undefined) {
          ctx.assert(
            prev <= curr,
            "emailIds should be ordered by receivedAt"
          );
        }
      }
    },
  },
  {
    id: "get-thread-not-found",
    name: "Thread/get returns notFound for unknown thread id",
    fn: async (ctx) => {
      const result = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: ["nonexistent-thread-xyz"],
      });
      ctx.assert(
        Array.isArray(result.notFound),
        "Thread/get notFound MUST be a String[] (RFC 8620 §5.1), got " + JSON.stringify(result.notFound)
      );
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-thread-xyz");
    },
  },
  {
    id: "get-single-email-thread",
    name: "Thread/get for single-email thread has one emailId",
    fn: async (ctx) => {
      // plain-simple should be its own thread
      const emailId = ctx.emailIds["plain-simple"];
      const emailResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["threadId"],
      });
      const threadId = (emailResult.list as Array<{ threadId: string }>)[0]
        .threadId;

      const result = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [threadId],
      });
      const thread = (
        result.list as Array<{ id: string; emailIds: string[] }>
      )[0];
      ctx.assertLength(thread.emailIds, 1);
      ctx.assertEqual(thread.emailIds[0], emailId);
    },
  },
  {
    id: "get-thread-response-structure",
    name: "Thread/get response has required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Thread/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.state, "string");
      ctx.assert(Array.isArray(result.list), "list must be array");
      ctx.assert(Array.isArray(result.notFound), "notFound must be array");
    },
  },
]);
