import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.4.3", category: "email" }, [
  {
    id: "collapse-threads-basic",
    name: "Email/query collapseThreads=true returns one per thread",
    fn: async (ctx) => {
      // Without collapse
      const expandedResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          // Just fetch our thread
          subject: 'Project Alpha Discussion'
        },
        sort: [{ property: "receivedAt", isAscending: false }],
        collapseThreads: false,
        calculateTotal: true,
      });
      const expandedTotal = expandedResult.total as number;

      // With collapse
      const collapsedResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          subject: 'Project Alpha Discussion'
        },
        sort: [{ property: "receivedAt", isAscending: false }],
        collapseThreads: true,
        calculateTotal: true,
      });
      const collapsedTotal = collapsedResult.total as number;

      // There's a thread of 3 emails that should have been collapsed.
      // See thread-starter in seed-data.ts.
      // Collapsed should have fewer results (our thread has 3 emails)
      ctx.assertLessThan(
        collapsedTotal,
        expandedTotal,
        "Collapsed total should be less than expanded"
      );
    },
  },
  {
    id: "collapse-threads-one-per-thread",
    name: "Email/query collapseThreads returns exactly one email per thread",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "receivedAt", isAscending: false }],
        collapseThreads: true,
      });
      const ids = result.ids as string[];

      // Get threadIds for all returned emails
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids,
        properties: ["threadId"],
      });
      const list = getResult.list as Array<{ id: string; threadId: string }>;
      const threadIds = list.map((e) => e.threadId);
      const uniqueThreadIds = new Set(threadIds);
      ctx.assertEqual(
        threadIds.length,
        uniqueThreadIds.size,
        "Each thread should appear only once"
      );
    },
  },
  {
    id: "collapse-threads-with-filter",
    name: "Email/query collapseThreads interacts correctly with filter",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
        collapseThreads: true,
      });
      const ids = result.ids as string[];

      // The thread (starter in folderA, replies in inbox) should appear
      // but only one email from the thread
      const threadEmailIds = [
        ctx.emailIds["thread-reply-1"],
        ctx.emailIds["thread-reply-2"],
      ];
      const matchingThread = ids.filter((id) => threadEmailIds.includes(id));
      ctx.assert(
        matchingThread.length <= 1,
        "At most one email from the thread should appear"
      );
    },
  },
  {
    id: "collapse-threads-sort-determines-representative",
    name: "Email/query collapseThreads uses sort to pick thread representative",
    fn: async (ctx) => {
      // Sort by receivedAt desc - should pick the newest email from each thread
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "receivedAt", isAscending: false }],
        collapseThreads: true,
      });
      const ids = result.ids as string[];

      // thread-reply-2 is the newest in the thread, should be the representative
      if (ids.includes(ctx.emailIds["thread-reply-2"])) {
        ctx.assertNotIncludes(ids, ctx.emailIds["thread-reply-1"]);
        ctx.assertNotIncludes(ids, ctx.emailIds["thread-starter"]);
      }
    },
  },
  {
    id: "collapse-threads-calculate-total",
    name: "Email/query collapseThreads total counts unique threads",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {},
        collapseThreads: true,
        calculateTotal: true,
      });
      const total = result.total as number;
      const ids = result.ids as string[];
      ctx.assertEqual(total, ids.length);
    },
  },
]);
