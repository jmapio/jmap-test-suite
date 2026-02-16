import { defineTests } from "../../runner/test-registry.js";
import { hasCapability } from "../../client/session.js";
import type { TestContext } from "../../runner/test-context.js";

const needsSubmission = (ctx: TestContext): true | string =>
  hasCapability(ctx.session, "urn:ietf:params:jmap:submission") ? true : "Server does not support submission capability";

defineTests({ rfc: "RFC8621", section: "6.1", category: "identity" }, [
  {
    id: "get-all-identities",
    name: "Identity/get with ids=null returns all identities",
    runIf: needsSubmission,
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertGreaterThan(
        list.length,
        0,
        "Must have at least one identity"
      );
      ctx.client.updateState("Identity", result.state as string);
    },
  },
  {
    id: "get-identity-properties",
    name: "Identity object has required properties",
    runIf: needsSubmission,
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const identity = (result.list as Array<Record<string, unknown>>)[0];

      ctx.assertType(identity.id, "string");
      ctx.assertType(identity.name, "string");
      ctx.assertType(identity.email, "string");
      ctx.assertType(identity.textSignature, "string");
      ctx.assertType(identity.htmlSignature, "string");
      ctx.assertType(identity.mayDelete, "boolean");
      // replyTo and bcc are optional, can be null
      ctx.assert(
        identity.replyTo === null || Array.isArray(identity.replyTo),
        "replyTo must be null or array"
      );
      ctx.assert(
        identity.bcc === null || Array.isArray(identity.bcc),
        "bcc must be null or array"
      );
    },
  },
  {
    id: "get-identity-by-id",
    name: "Identity/get returns specific identity by id",
    runIf: (ctx) => ctx.identityIds.length === 0 ? "No identities available" : true,
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [ctx.identityIds[0]],
      });
      const list = result.list as Array<{ id: string }>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, ctx.identityIds[0]);
    },
  },
  {
    id: "get-identity-not-found",
    name: "Identity/get returns notFound for unknown id",
    runIf: needsSubmission,
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: ["nonexistent-identity-xyz"],
      });
      ctx.assert(
        Array.isArray(result.notFound),
        "Identity/get notFound MUST be a String[] (RFC 8620 §5.1), got " + JSON.stringify(result.notFound)
      );
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-identity-xyz");
    },
  },
  {
    id: "get-identity-email-matches",
    name: "Identity email address is valid",
    runIf: (ctx) => ctx.identityIds.length === 0 ? "No identities available" : true,
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [ctx.identityIds[0]],
      });
      const identity = (result.list as Array<Record<string, unknown>>)[0];
      const email = identity.email as string;
      ctx.assertStringContains(email, "@");
    },
  },
]);
