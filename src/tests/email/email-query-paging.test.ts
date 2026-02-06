import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.4", category: "email" }, [
  {
    id: "paging-position-zero",
    name: "Email/query position=0 starts from beginning",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        position: 0,
        limit: 5,
        calculateTotal: true,
      });
      ctx.assertEqual(result.position, 0);
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
      ctx.assert(ids.length <= 5, "Should respect limit");
    },
  },
  {
    id: "paging-positive-position",
    name: "Email/query with positive position skips results",
    fn: async (ctx) => {
      const all = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const allIds = all.ids as string[];

      if (allIds.length < 3) return;

      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        position: 2,
        limit: 3,
      });
      const ids = result.ids as string[];
      ctx.assertEqual(result.position, 2);
      ctx.assertEqual(ids[0], allIds[2]);
    },
  },
  {
    id: "paging-negative-position",
    name: "Email/query with negative position counts from end",
    fn: async (ctx) => {
      const all = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        calculateTotal: true,
      });
      const allIds = all.ids as string[];
      const total = all.total as number;

      if (total < 3) return;

      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        position: -3,
        calculateTotal: true,
      });
      const ids = result.ids as string[];
      // Should start from 3rd-to-last
      ctx.assertEqual(ids[0], allIds[total - 3]);
    },
  },
  {
    id: "paging-limit",
    name: "Email/query limit restricts result count",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        limit: 3,
        calculateTotal: true,
      });
      const ids = result.ids as string[];
      const total = result.total as number;
      ctx.assert(ids.length <= 3, `Expected at most 3, got ${ids.length}`);
      if (total > 3) {
        ctx.assertEqual(ids.length, 3);
      }
    },
  },
  {
    id: "paging-anchor",
    name: "Email/query anchor returns results starting from anchored email",
    fn: async (ctx) => {
      const all = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const allIds = all.ids as string[];

      if (allIds.length < 3) return;

      const anchorId = allIds[2]; // Use 3rd email as anchor
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        anchor: anchorId,
        limit: 3,
      });
      const ids = result.ids as string[];
      ctx.assertEqual(ids[0], anchorId);
      ctx.assertEqual(result.position, 2);
    },
  },
  {
    id: "paging-anchor-offset",
    name: "Email/query anchor with anchorOffset shifts start",
    fn: async (ctx) => {
      const all = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
      });
      const allIds = all.ids as string[];

      if (allIds.length < 5) return;

      const anchorId = allIds[3]; // 4th email
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        sort: [{ property: "receivedAt", isAscending: false }],
        anchor: anchorId,
        anchorOffset: -1, // Start one before the anchor
        limit: 3,
      });
      const ids = result.ids as string[];
      ctx.assertEqual(ids[0], allIds[2]); // Should start at 3rd (one before 4th)
    },
  },
  {
    id: "paging-calculate-total",
    name: "Email/query calculateTotal returns total count",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        limit: 1,
        calculateTotal: true,
      });
      const total = result.total as number;
      ctx.assertType(total, "number");
      ctx.assertGreaterOrEqual(
        total,
        Object.keys(ctx.emailIds).length
      );
    },
  },
  {
    id: "paging-anchor-not-found",
    name: "Email/query MUST return anchorNotFound for invalid anchor",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Email/query",
            {
              accountId: ctx.accountId,
              anchor: "nonexistent-email-xyz",
            },
            "c0",
          ],
        ]
      );
      // RFC 8620 S5.5: "If an anchor argument was given and the anchor Id was
      // not found in the results of the query, the server MUST return an
      // anchorNotFound error."
      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error", "Server MUST return error for invalid anchor");
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "anchorNotFound"
      );
    },
  },
  {
    id: "paging-position-beyond-total",
    name: "Email/query with position >= total returns empty",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        position: 99999,
      });
      const ids = result.ids as string[];
      ctx.assertLength(ids, 0);
    },
  },
  {
    id: "paging-response-position",
    name: "Email/query response position reflects actual start position",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: null,
        position: 0,
        limit: 3,
      });
      ctx.assertEqual(result.position, 0);
    },
  },
]);
