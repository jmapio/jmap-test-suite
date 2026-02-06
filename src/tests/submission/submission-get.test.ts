import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "7.1", category: "submission" }, [
  {
    id: "get-empty",
    name: "EmailSubmission/get with ids=null returns submissions",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.state, "string");
      ctx.assert(Array.isArray(result.list), "list must be array");
      ctx.client.updateState("EmailSubmission", result.state as string);
    },
  },
  {
    id: "get-not-found",
    name: "EmailSubmission/get returns notFound for unknown id",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/get", {
        accountId: ctx.accountId,
        ids: ["nonexistent-submission-xyz"],
      });
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-submission-xyz");
    },
  },
  {
    id: "get-response-structure",
    name: "EmailSubmission/get response has required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("EmailSubmission/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.state, "string");
      ctx.assert(Array.isArray(result.list), "list must be array");
      ctx.assert(
        Array.isArray(result.notFound),
        "notFound must be array"
      );
    },
  },
]);
