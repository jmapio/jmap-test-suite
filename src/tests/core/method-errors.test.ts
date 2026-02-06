import { defineTests } from "../../runner/test-registry.js";
import { JmapMethodError } from "../../client/jmap-client.js";

defineTests({ rfc: "RFC8620", section: "3.6.2", category: "core" }, [
  {
    id: "error-unknown-method",
    name: "Server returns unknownMethod for nonexistent method",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ["urn:ietf:params:jmap:core"],
        [["Fake/nonexistent", {}, "c0"]]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error");
      ctx.assertEqual((args as Record<string, unknown>).type, "unknownMethod");
    },
  },
  {
    id: "error-invalid-arguments-missing-account",
    name: "Server returns invalidArguments for missing accountId on Mailbox/get",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [["Mailbox/get", {}, "c0"]]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error", `Expected "error", got "${name}"`);
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "invalidArguments",
        "Missing accountId must return invalidArguments"
      );
    },
  },
  {
    id: "error-account-not-found",
    name: "Server returns accountNotFound for fake account ID",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [["Mailbox/get", { accountId: "nonexistent-account-id-xyz" }, "c0"]]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error");
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "accountNotFound"
      );
    },
  },
  {
    id: "error-invalid-arguments-bad-type",
    name: "Server returns invalidArguments for wrong argument types",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Mailbox/get",
            { accountId: ctx.accountId, ids: "not-an-array" },
            "c0",
          ],
        ]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error");
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "invalidArguments"
      );
    },
  },
  {
    id: "error-method-level-has-type",
    name: "Method-level errors include 'type' property",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ["urn:ietf:params:jmap:core"],
        [["Fake/method", {}, "c0"]]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error");
      ctx.assertHasProperty(args as Record<string, unknown>, "type");
    },
  },
  {
    id: "error-state-mismatch",
    name: "Server MUST return stateMismatch for incorrect ifInState",
    fn: async (ctx) => {
      try {
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          ifInState: "invalid-state-that-does-not-exist",
          update: {},
        });
        ctx.assert(false, "Server must reject request with stateMismatch error when ifInState does not match");
      } catch (err) {
        if (err instanceof JmapMethodError) {
          ctx.assertEqual(err.type, "stateMismatch");
        }
      }
    },
  },
  {
    id: "error-multiple-method-responses",
    name: "Server returns one response per method call, in order",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          ["Mailbox/get", { accountId: ctx.accountId, ids: [] }, "call1"],
          ["Core/echo", { test: true }, "call2"],
          ["Fake/nonexistent", {}, "call3"],
        ]
      );
      ctx.assertLength(response.methodResponses, 3);
      ctx.assertEqual(response.methodResponses[0][2], "call1");
      ctx.assertEqual(response.methodResponses[1][2], "call2");
      ctx.assertEqual(response.methodResponses[2][2], "call3");
      // Third should be an error
      ctx.assertEqual(response.methodResponses[2][0], "error");
    },
  },
  {
    id: "error-response-has-session-state",
    name: "API response includes sessionState property",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ["urn:ietf:params:jmap:core"],
        [["Core/echo", {}, "c0"]]
      );
      ctx.assertTruthy(
        response.sessionState,
        "Response must include sessionState"
      );
      ctx.assertType(response.sessionState, "string");
    },
  },
]);
