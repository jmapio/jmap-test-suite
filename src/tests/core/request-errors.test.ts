import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "3.6.1", category: "core" }, [
  {
    id: "error-not-json",
    name: "Server returns error for non-JSON body",
    section: "3.6.1",
    fn: async (ctx) => {
      const resp = await ctx.client.rawPost("this is not json");
      ctx.assert(
        resp.status >= 400 && resp.status < 500,
        `Expected 4xx client error, got ${resp.status}`
      );
    },
  },
  {
    id: "error-not-request",
    name: "Server MUST return 400 for JSON that is not a valid Request",
    section: "3.6.1",
    fn: async (ctx) => {
      const resp = await ctx.client.rawPost(JSON.stringify({ foo: "bar" }));
      ctx.assert(
        resp.status >= 400 && resp.status < 500,
        `Expected 4xx client error, got ${resp.status}`
      );
    },
  },
  {
    id: "error-unknown-capability",
    name: "Server MUST return HTTP-level error for unknown capability in using",
    section: "3.6.1",
    fn: async (ctx) => {
      const resp = await ctx.client.rawPost(
        JSON.stringify({
          using: ["urn:ietf:params:jmap:core", "urn:fake:nonexistent"],
          methodCalls: [["Core/echo", {}, "c0"]],
        })
      );
      ctx.assert(
        resp.status >= 400 && resp.status < 500,
        `Expected HTTP 4xx error for unknown capability, got ${resp.status}`
      );
    },
  },
  {
    id: "error-empty-using",
    name: "Server processes request with empty using but rejects each method with unknownMethod",
    section: "3.6.1",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        [],
        [["Core/echo", {}, "c0"]]
      );
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(
        name,
        "error",
        "With empty using, method call must return error"
      );
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "unknownMethod",
        "Error type must be unknownMethod when no capabilities in using"
      );
    },
  },
  {
    id: "error-wrong-content-type",
    name: "Server returns error for wrong Content-Type",
    section: "3.6.1",
    fn: async (ctx) => {
      const resp = await ctx.client.rawPost(
        JSON.stringify({
          using: ["urn:ietf:params:jmap:core"],
          methodCalls: [["Core/echo", {}, "c0"]],
        }),
        "text/plain"
      );
      ctx.assert(
        resp.status >= 400 && resp.status < 500,
        `Expected 4xx client error for wrong content type, got ${resp.status}`
      );
    },
  },
  {
    id: "error-method-calls-not-array",
    name: "Server returns error when methodCalls is not an array",
    section: "3.6.1",
    fn: async (ctx) => {
      const resp = await ctx.client.rawPost(
        JSON.stringify({
          using: ["urn:ietf:params:jmap:core"],
          methodCalls: "not-an-array",
        })
      );
      ctx.assert(
        resp.status >= 400 && resp.status < 500,
        `Expected 4xx client error, got ${resp.status}`
      );
    },
  },
]);
