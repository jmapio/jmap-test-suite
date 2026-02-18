import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "2.4", category: "mailbox" }, [
  {
    id: "query-changes-no-changes",
    name: "Mailbox/queryChanges with current state returns empty changes",
    fn: async (ctx) => {
      const queryResult = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
      });
      const queryState = queryResult.queryState as string;

      const result = await ctx.client.call("Mailbox/queryChanges", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
        sinceQueryState: queryState,
      });

      ctx.assertEqual(result.oldQueryState, queryState);
      const removed = result.removed as string[];
      const added = result.added as Array<{ id: string; index: number }>;
      ctx.assertLength(removed, 0);
      ctx.assertLength(added, 0);
    },
  },
  {
    id: "query-changes-after-create",
    name: "Mailbox/queryChanges reflects new mailbox creation",
    fn: async (ctx) => {
      const queryResult = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
      });
      const oldQueryState = queryResult.queryState as string;

      // Create a mailbox
      const setResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          qcTest: { name: "QC Test Mailbox", parentId: null },
        },
      });
      const newId = (setResult.created as Record<string, { id: string }>).qcTest.id;

      try {
        const changes = await ctx.client.call("Mailbox/queryChanges", {
          accountId: ctx.accountId,
          filter: {},
          sort: [{ property: "name", isAscending: true }],
          sinceQueryState: oldQueryState,
        });

        const added = changes.added as Array<{ id: string; index: number }>;
        const addedIds = added.map((a) => a.id);
        ctx.assertIncludes(addedIds, newId);
      } finally {
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          destroy: [newId],
        });
      }
    },
  },
  {
    id: "query-changes-response-structure",
    name: "Mailbox/queryChanges response has required properties",
    fn: async (ctx) => {
      const queryResult = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
      });
      const queryState = queryResult.queryState as string;

      const result = await ctx.client.call("Mailbox/queryChanges", {
        accountId: ctx.accountId,
        filter: {},
        sinceQueryState: queryState,
      });

      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.oldQueryState, "string");
      ctx.assertType(result.newQueryState, "string");
      ctx.assert(Array.isArray(result.removed), "removed must be array");
      ctx.assert(Array.isArray(result.added), "added must be array");
    },
  },
]);
