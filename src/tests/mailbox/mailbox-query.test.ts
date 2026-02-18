import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "2.3", category: "mailbox" }, [
  {
    id: "query-all",
    name: "Mailbox/query with no filter returns all mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        calculateTotal: true,
      });
      const ids = result.ids as string[];
      const total = result.total as number;
      ctx.assertGreaterThan(ids.length, 0);
      ctx.assertEqual(ids.length, total);
    },
  },
  {
    id: "query-filter-by-parent-id-null",
    name: "Mailbox/query filter by parentId=null returns top-level mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { parentId: null },
      });
      const ids = result.ids as string[];
      // Should include inbox, folderA, folderB but not child1, child2
      ctx.assertIncludes(ids, ctx.roleMailboxes["inbox"]);
      ctx.assertIncludes(ids, ctx.mailboxIds["folderA"]);
      ctx.assertIncludes(ids, ctx.mailboxIds["folderB"]);
      ctx.assertNotIncludes(ids, ctx.mailboxIds["child1"]);
      ctx.assertNotIncludes(ids, ctx.mailboxIds["child2"]);
    },
  },
  {
    id: "query-filter-by-parent-id",
    name: "Mailbox/query filter by parentId returns children",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { parentId: ctx.mailboxIds["folderA"] },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.mailboxIds["child1"]);
      ctx.assertIncludes(ids, ctx.mailboxIds["child2"]);
      ctx.assertLength(ids, 2);
    },
  },
  {
    id: "query-filter-by-name",
    name: "Mailbox/query filter by name matches",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { name: "Test Folder A" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.mailboxIds["folderA"]);
    },
  },
  {
    id: "query-filter-by-role",
    name: "Mailbox/query filter by role returns correct mailbox",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { role: "inbox" },
      });
      const ids = result.ids as string[];
      ctx.assertLength(ids, 1);
      ctx.assertEqual(ids[0], ctx.roleMailboxes["inbox"]);
    },
  },
  {
    id: "query-filter-has-any-role",
    name: "Mailbox/query filter hasAnyRole=true returns only role mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { hasAnyRole: true },
      });
      const ids = result.ids as string[];
      // All returned mailboxes should have a role
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: ids,
        properties: ["id", "role"],
      });
      const list = getResult.list as Array<{ id: string; role: string | null }>;
      for (const mb of list) {
        ctx.assertTruthy(mb.role, `Mailbox ${mb.id} should have a role`);
      }
    },
  },
  {
    id: "query-filter-has-any-role-false",
    name: "Mailbox/query filter hasAnyRole=false returns non-role mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: { hasAnyRole: false },
      });
      const ids = result.ids as string[];
      // Our custom mailboxes should be in here
      ctx.assertIncludes(ids, ctx.mailboxIds["folderA"]);
      ctx.assertIncludes(ids, ctx.mailboxIds["folderB"]);
    },
  },
  {
    id: "query-sort-by-name",
    name: "Mailbox/query sorted by name returns alphabetical order",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
      });
      const ids = result.ids as string[];
      // Verify names are in ascending order
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: ids,
        properties: ["id", "name"],
      });
      const list = getResult.list as Array<{ id: string; name: string }>;
      // Build a map id->name
      const nameMap = new Map(list.map((m) => [m.id, m.name]));
      for (let i = 1; i < ids.length; i++) {
        const prev = nameMap.get(ids[i - 1])!;
        const curr = nameMap.get(ids[i])!;
        ctx.assert(
          prev.localeCompare(curr) <= 0,
          `Expected '${prev}' <= '${curr}' in sort order`
        );
      }
    },
  },
  {
    id: "query-sort-by-sort-order",
    name: "Mailbox/query sorted by sortOrder",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "sortOrder", isAscending: true }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
    },
  },
  {
    id: "query-response-structure",
    name: "Mailbox/query response has required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
      });
      ctx.assertType(result.accountId, "string");
      ctx.assertType(result.queryState, "string");
      ctx.assertType(result.canCalculateChanges, "boolean");
      ctx.assertType(result.position, "number");
      ctx.assert(Array.isArray(result.ids), "ids must be array");
    },
  },
  {
    id: "query-limit",
    name: "Mailbox/query with limit returns at most limit results",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        limit: 2,
        calculateTotal: true,
      });
      const ids = result.ids as string[];
      ctx.assert(ids.length <= 2, `Expected at most 2 results, got ${ids.length}`);
    },
  },
  {
    id: "query-position",
    name: "Mailbox/query with position skips results",
    fn: async (ctx) => {
      // Get all first
      const allResult = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
      });
      const allIds = allResult.ids as string[];

      if (allIds.length < 2) return; // Need at least 2

      // Now query with position=1
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: {},
        sort: [{ property: "name", isAscending: true }],
        position: 1,
      });
      const ids = result.ids as string[];
      ctx.assertEqual(ids[0], allIds[1]);
      ctx.assertEqual(result.position, 1);
    },
  },
  {
    id: "query-filter-null-accepted",
    name: "Mailbox/query accepts filter: null",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/query", {
        accountId: ctx.accountId,
        filter: null,
      });
      ctx.assert(Array.isArray(result.ids), "ids must be array");
      const ids = result.ids as string[];
      ctx.assert(ids.length > 0, "Null filter should return mailboxes");
    },
  },
]);
