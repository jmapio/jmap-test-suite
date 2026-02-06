import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "7.2", category: "submission" }, [
  {
    id: "changes-no-changes",
    name: "EmailSubmission/changes with current state returns empty",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("EmailSubmission/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("EmailSubmission/changes", {
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
    id: "changes-response-structure",
    name: "EmailSubmission/changes response has required properties",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("EmailSubmission/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("EmailSubmission/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.oldState, "string");
      ctx.assertType(result.newState, "string");
      ctx.assertType(result.hasMoreChanges, "boolean");
    },
  },
]);
