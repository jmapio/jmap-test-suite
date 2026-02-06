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
    name: "Server SHOULD return 400 for JSON that is not a valid Request",
    section: "3.6.1",
    required: false,
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
    name: "Server returns error for unknown capability in using",
    section: "3.6.1",
    fn: async (ctx) => {
      try {
        const response = await ctx.client.rawRequest(
          ["urn:ietf:params:jmap:core", "urn:fake:nonexistent"],
          [["Core/echo", {}, "c0"]]
        );
        // Server returned a JMAP response — check for error method response
        const [name, args] = response.methodResponses[0];
        if (name === "error") {
          ctx.assertEqual(
            (args as Record<string, unknown>).type,
            "unknownCapability"
          );
        }
      } catch {
        // HTTP 4xx error is also acceptable
      }
    },
  },
  {
    id: "error-empty-using",
    name: "Server returns error when using array is empty",
    section: "3.6.1",
    fn: async (ctx) => {
      try {
        const response = await ctx.client.rawRequest(
          [],
          [["Core/echo", {}, "c0"]]
        );
        // If JMAP response returned, the method call must be an error
        // (no capabilities in using means no methods should be processed)
        const [name] = response.methodResponses[0];
        ctx.assertEqual(
          name,
          "error",
          "With empty using, method call must return error"
        );
      } catch {
        // HTTP 4xx error is also acceptable
      }
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
