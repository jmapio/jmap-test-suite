import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "2.2", category: "mailbox" }, [
  {
    id: "changes-no-changes",
    name: "Mailbox/changes with current state returns empty arrays",
    fn: async (ctx) => {
      // Get current state
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Mailbox/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });

      ctx.assertEqual(result.oldState, state);
      ctx.assertTruthy(result.newState);
      const created = result.created as string[];
      const updated = result.updated as string[];
      const destroyed = result.destroyed as string[];
      ctx.assertLength(created, 0);
      ctx.assertLength(updated, 0);
      ctx.assertLength(destroyed, 0);
      ctx.assertEqual(result.hasMoreChanges, false);
    },
  },
  {
    id: "changes-after-create",
    name: "Mailbox/changes reflects newly created mailbox",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Create a temp mailbox
      const setResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          tempMb: { name: "Temp Changes Test", parentId: null },
        },
      });
      const created = setResult.created as Record<string, { id: string }>;
      const tempId = created.tempMb.id;

      try {
        const changes = await ctx.client.call("Mailbox/changes", {
          accountId: ctx.accountId,
          sinceState: oldState,
        });
        const createdIds = changes.created as string[];
        ctx.assertIncludes(createdIds, tempId);
      } finally {
        // Cleanup
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          destroy: [tempId],
        });
      }
    },
  },
  {
    id: "changes-after-rename",
    name: "Mailbox/changes reflects renamed mailbox as updated",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Create, then rename
      const setResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          renameMb: { name: "Before Rename", parentId: null },
        },
      });
      const mbId = (setResult.created as Record<string, { id: string }>).renameMb.id;
      const midState = setResult.newState as string;

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        update: {
          [mbId]: { name: "After Rename" },
        },
      });

      try {
        const changes = await ctx.client.call("Mailbox/changes", {
          accountId: ctx.accountId,
          sinceState: midState,
        });
        const updated = changes.updated as string[];
        ctx.assertIncludes(updated, mbId);
      } finally {
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          destroy: [mbId],
        });
      }
    },
  },
  {
    id: "changes-has-more-changes",
    name: "Mailbox/changes hasMoreChanges is boolean",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Mailbox/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });
      ctx.assertType(result.hasMoreChanges, "boolean");
    },
  },
  {
    id: "changes-response-structure",
    name: "Mailbox/changes response has all required properties",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Mailbox/changes", {
        accountId: ctx.accountId,
        sinceState: state,
      });

      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.oldState, "string");
      ctx.assertType(result.newState, "string");
      ctx.assertType(result.hasMoreChanges, "boolean");
      ctx.assert(Array.isArray(result.created), "created must be array");
      ctx.assert(Array.isArray(result.updated), "updated must be array");
      ctx.assert(Array.isArray(result.destroyed), "destroyed must be array");
    },
  },
]);
