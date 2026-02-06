import { defineTests } from "../../runner/test-registry.js";
import { hasCapability } from "../../client/session.js";

defineTests({ rfc: "RFC8621", section: "6.2", category: "identity" }, [
  {
    id: "changes-no-changes",
    name: "Identity/changes with current state returns empty",
    fn: async (ctx) => {
      if (!hasCapability(ctx.session, "urn:ietf:params:jmap:submission")) {
        throw new Error("SKIP: Server does not support submission capability");
      }
      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Identity/changes", {
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
    id: "changes-after-update",
    name: "Identity/changes reflects updated identity",
    fn: async (ctx) => {
      if (ctx.identityIds.length === 0) {
        throw new Error("SKIP: No identities available");
      }
      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Update the identity name
      const identityId = ctx.identityIds[0];
      const identityGet = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const oldName = (
        identityGet.list as Array<{ name: string }>
      )[0].name;

      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { name: "Updated Name For Test" },
        },
      });

      try {
        const changes = await ctx.client.call("Identity/changes", {
          accountId: ctx.accountId,
          sinceState: oldState,
        });
        const updated = changes.updated as string[];
        ctx.assertIncludes(updated, identityId);
      } finally {
        // Restore name
        await ctx.client.call("Identity/set", {
          accountId: ctx.accountId,
          update: {
            [identityId]: { name: oldName },
          },
        });
      }
    },
  },
  {
    id: "changes-response-structure",
    name: "Identity/changes response has required properties",
    fn: async (ctx) => {
      if (!hasCapability(ctx.session, "urn:ietf:params:jmap:submission")) {
        throw new Error("SKIP: Server does not support submission capability");
      }
      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Identity/changes", {
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
