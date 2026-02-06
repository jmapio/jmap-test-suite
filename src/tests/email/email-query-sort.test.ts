import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.4.2", category: "email" }, [
  {
    id: "sort-received-at-desc",
    name: "Email/query sort by receivedAt descending (newest first)",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 1);

      // Verify order by fetching receivedAt
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: ids.slice(0, 5),
        properties: ["receivedAt"],
      });
      const list = getResult.list as Array<{ id: string; receivedAt: string }>;
      const idToDate = new Map(list.map((e) => [e.id, new Date(e.receivedAt).getTime()]));
      for (let i = 1; i < Math.min(ids.length, 5); i++) {
        const prev = idToDate.get(ids[i - 1]);
        const curr = idToDate.get(ids[i]);
        if (prev !== undefined && curr !== undefined) {
          ctx.assertGreaterOrEqual(prev, curr, "receivedAt should be descending");
        }
      }
    },
  },
  {
    id: "sort-received-at-asc",
    name: "Email/query sort by receivedAt ascending (oldest first)",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "receivedAt", isAscending: true }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 1);

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids,
        properties: ["receivedAt"],
      });
      const list = getResult.list as Array<{ id: string; receivedAt: string }>;
      const idToDate = new Map(list.map((e) => [e.id, new Date(e.receivedAt).getTime()]));
      for (let i = 1; i < ids.length; i++) {
        const prev = idToDate.get(ids[i - 1]);
        const curr = idToDate.get(ids[i]);
        if (prev !== undefined && curr !== undefined) {
          ctx.assert(prev <= curr, "receivedAt should be ascending");
        }
      }
    },
  },
  {
    id: "sort-size",
    name: "Email/query sort by size",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "size", isAscending: true }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 1);

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids,
        properties: ["size"],
      });
      const list = getResult.list as Array<{ id: string; size: number }>;
      const idToSize = new Map(list.map((e) => [e.id, e.size]));
      for (let i = 1; i < ids.length; i++) {
        const prev = idToSize.get(ids[i - 1])!;
        const curr = idToSize.get(ids[i])!;
        ctx.assert(prev <= curr, `Expected size ${prev} <= ${curr}`);
      }
    },
  },
  {
    id: "sort-from",
    name: "Email/query sort by from",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "from", isAscending: true }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 1);
    },
  },
  {
    id: "sort-to",
    name: "Email/query sort by to",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "to", isAscending: true }],
        limit: 10,
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
    },
  },
  {
    id: "sort-subject",
    name: "Email/query sort by subject",
    required: false,
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "subject", isAscending: true }],
      });
      const ids = result.ids as string[];

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids,
        properties: ["subject"],
      });
      const list = getResult.list as Array<{ id: string; subject: string }>;
      const idToSubject = new Map(list.map((e) => [e.id, e.subject]));

      for (let i = 1; i < ids.length; i++) {
        const prev = idToSubject.get(ids[i - 1])!;
        const curr = idToSubject.get(ids[i])!;
        ctx.assert(
          prev.localeCompare(curr) <= 0,
          `Expected '${prev}' <= '${curr}' in subject sort`
        );
      }
    },
  },
  {
    id: "sort-sent-at",
    name: "Email/query sort by sentAt",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "sentAt", isAscending: true }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 1);

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids,
        properties: ["sentAt"],
      });
      const list = getResult.list as Array<{ id: string; sentAt: string }>;
      const idToDate = new Map(list.map((e) => [e.id, new Date(e.sentAt).getTime()]));
      for (let i = 1; i < ids.length; i++) {
        const prev = idToDate.get(ids[i - 1]);
        const curr = idToDate.get(ids[i]);
        if (prev !== undefined && curr !== undefined) {
          ctx.assert(prev <= curr, "sentAt should be ascending");
        }
      }
    },
  },
  {
    id: "sort-has-keyword",
    name: "Email/query sort by hasKeyword",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["folderB"] },
        sort: [{ property: "hasKeyword", keyword: "$flagged", isAscending: false }],
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
      // sort-test-2 has $flagged, should come first when descending
    },
  },
  {
    id: "sort-multi-property",
    name: "Email/query sort by multiple properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [
          { property: "receivedAt", isAscending: false },
          { property: "subject", isAscending: true },
        ],
        limit: 10,
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
    },
  },
  {
    id: "sort-default-no-sort",
    name: "Email/query with no sort returns results in server-determined order",
    fn: async (ctx) => {
      // RFC 8621 Section 4.4.2: "If omitted, the Comparators are
      // implementation-dependent." We just verify the query succeeds and
      // returns results without an explicit sort.
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0, "Should return emails with no sort");
    },
  },
]);
