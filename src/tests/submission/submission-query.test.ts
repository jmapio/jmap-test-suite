import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "7.3", category: "submission" }, [
  {
    id: "query-all",
    name: "EmailSubmission/query with no filter returns all submissions",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/query", {
        accountId: ctx.accountId,
        filter: {},
      });
      ctx.assertType(result.queryState, "string");
      ctx.assert(Array.isArray(result.ids), "ids must be array");
    },
  },
  {
    id: "query-filter-undo-status",
    name: "EmailSubmission/query filter by undoStatus",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/query", {
        accountId: ctx.accountId,
        filter: { undoStatus: "final" },
      });
      ctx.assert(Array.isArray(result.ids), "ids must be array");
    },
  },
  {
    id: "query-response-structure",
    name: "EmailSubmission/query response has required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/query", {
        accountId: ctx.accountId,
        filter: {},
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.queryState, "string");
      ctx.assertType(result.canCalculateChanges, "boolean");
      ctx.assertType(result.position, "number");
      ctx.assert(Array.isArray(result.ids), "ids must be array");
    },
  },
]);
