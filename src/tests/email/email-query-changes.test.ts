import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.5", category: "email" }, [
  {
    id: "query-changes-no-changes",
    name: "Email/queryChanges with current state returns empty changes",
    fn: async (ctx) => {
      const query = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const queryState = query.queryState as string;

      const result = await ctx.client.call("Email/queryChanges", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
        sinceQueryState: queryState,
      });

      ctx.assertEqual(result.oldQueryState, queryState);
      ctx.assertLength(result.removed as string[], 0);
      ctx.assertLength(
        result.added as Array<{ id: string; index: number }>,
        0
      );
    },
  },
  {
    id: "query-changes-after-add",
    name: "Email/queryChanges reflects newly added email",
    fn: async (ctx) => {
      const query = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const oldQueryState = query.queryState as string;

      // Create a new email in inbox
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          qcEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "QC Test", email: "qc@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "QueryChanges test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "test" } },
          },
        },
      });
      const newId = (createResult.created as Record<string, { id: string }>)
        .qcEmail.id;

      try {
        const changes = await ctx.client.call("Email/queryChanges", {
          accountId: ctx.accountId,
          filter: { inMailbox: ctx.roleMailboxes["inbox"] },
          sort: [{ property: "receivedAt", isAscending: false }],
          sinceQueryState: oldQueryState,
        });
        const added = changes.added as Array<{ id: string; index: number }>;
        const addedIds = added.map((a) => a.id);
        ctx.assertIncludes(addedIds, newId);
      } finally {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [newId],
        });
      }
    },
  },
  {
    id: "query-changes-after-remove",
    name: "Email/queryChanges reflects removed email",
    fn: async (ctx) => {
      // Create an email first
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          rmEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "RM Test", email: "rm@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Will be removed",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "test" } },
          },
        },
      });
      const rmId = (createResult.created as Record<string, { id: string }>)
        .rmEmail.id;

      // Get query state after creation
      const query = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const oldQueryState = query.queryState as string;

      // Destroy it
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [rmId],
      });

      const changes = await ctx.client.call("Email/queryChanges", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
        sinceQueryState: oldQueryState,
      });
      const removed = changes.removed as string[];
      ctx.assertIncludes(removed, rmId);
    },
  },
  {
    id: "query-changes-response-structure",
    name: "Email/queryChanges response has required properties",
    fn: async (ctx) => {
      const query = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {},
      });
      const queryState = query.queryState as string;

      const result = await ctx.client.call("Email/queryChanges", {
        accountId: ctx.accountId,
        filter: {},
        sinceQueryState: queryState,
      });

      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.oldQueryState, "string");
      ctx.assertType(result.newQueryState, "string");
      ctx.assert(Array.isArray(result.removed), "removed must be array");
      ctx.assert(Array.isArray(result.added), "added must be array");
    },
  },
]);
