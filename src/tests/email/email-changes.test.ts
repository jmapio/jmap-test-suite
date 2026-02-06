import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.3", category: "email" }, [
  {
    id: "changes-no-changes",
    name: "Email/changes with current state returns empty arrays",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Email/changes", {
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
    id: "changes-after-keyword-change",
    name: "Email/changes reflects keyword update",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Toggle a keyword on a test email
      const emailId = ctx.emailIds["plain-simple"];
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$flagged": true },
        },
      });

      const changes = await ctx.client.call("Email/changes", {
        accountId: ctx.accountId,
        sinceState: oldState,
      });
      const updated = changes.updated as string[];
      ctx.assertIncludes(updated, emailId);

      // Revert the change
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$flagged": null },
        },
      });
    },
  },
  {
    id: "changes-response-structure",
    name: "Email/changes response has required properties",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const result = await ctx.client.call("Email/changes", {
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
  {
    id: "changes-after-create-and-destroy",
    name: "Email/changes tracks creation and destruction",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const oldState = getResult.state as string;

      // Create a temporary email
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          tempEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Changes test email",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "test body" } },
          },
        },
      });
      const created = createResult.created as Record<string, { id: string }>;
      const tempId = created.tempEmail.id;
      const midState = createResult.newState as string;

      // Check changes from old state
      const changes1 = await ctx.client.call("Email/changes", {
        accountId: ctx.accountId,
        sinceState: oldState,
      });
      ctx.assertIncludes(changes1.created as string[], tempId);

      // Now destroy it
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [tempId],
      });

      // Check changes from mid state
      const changes2 = await ctx.client.call("Email/changes", {
        accountId: ctx.accountId,
        sinceState: midState,
      });
      ctx.assertIncludes(changes2.destroyed as string[], tempId);
    },
  },
]);
