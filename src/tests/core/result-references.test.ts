import { defineTests } from "../../runner/test-registry.js";
import { JmapClient } from "../../client/jmap-client.js";
import type { Invocation } from "../../types/jmap-core.js";

defineTests({ rfc: "RFC8620", section: "3.7", category: "core" }, [
  {
    id: "result-ref-simple",
    name: "Simple result reference resolves correctly",
    fn: async (ctx) => {
      // Call Mailbox/get to get inbox, then use result ref to get the same mailbox
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Mailbox/get",
            { accountId: ctx.accountId, ids: null },
            "getMailboxes",
          ],
          [
            "Mailbox/get",
            {
              accountId: ctx.accountId,
              "#ids": {
                resultOf: "getMailboxes",
                name: "Mailbox/get",
                path: "/list/*/id",
              },
            },
            "getById",
          ],
        ]
      );

      ctx.assertLength(response.methodResponses, 2);
      const [name1] = response.methodResponses[0];
      const [name2, args2] = response.methodResponses[1];
      ctx.assertEqual(name1, "Mailbox/get");
      ctx.assertEqual(name2, "Mailbox/get");
      // Both should return the same mailboxes
      const list2 = (args2 as Record<string, unknown>).list as unknown[];
      ctx.assertGreaterThan(list2.length, 0, "Should have resolved mailbox ids");
    },
  },
  {
    id: "result-ref-chained",
    name: "Chained result references across multiple calls",
    fn: async (ctx) => {
      // Query emails, then get the results
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Email/query",
            {
              accountId: ctx.accountId,
              filter: { inMailbox: ctx.roleMailboxes["inbox"] },
              limit: 3,
            },
            "query",
          ],
          [
            "Email/get",
            {
              accountId: ctx.accountId,
              "#ids": {
                resultOf: "query",
                name: "Email/query",
                path: "/ids",
              },
              properties: ["id", "subject"],
            },
            "getEmails",
          ],
        ]
      );

      ctx.assertLength(response.methodResponses, 2);
      const [name1, args1] = response.methodResponses[0];
      const [name2, args2] = response.methodResponses[1];
      ctx.assertEqual(name1, "Email/query");
      ctx.assertEqual(name2, "Email/get");

      const queryIds = (args1 as Record<string, unknown>).ids as string[];
      const getList = (args2 as Record<string, unknown>).list as Array<{ id: string }>;
      ctx.assertEqual(getList.length, queryIds.length);
    },
  },
  {
    id: "result-ref-invalid-result-of",
    name: "Invalid resultOf returns invalidResultReference error",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Email/get",
            {
              accountId: ctx.accountId,
              "#ids": {
                resultOf: "nonexistent",
                name: "Email/query",
                path: "/ids",
              },
            },
            "c0",
          ],
        ]
      );

      const [name, args] = response.methodResponses[0];
      ctx.assertEqual(name, "error");
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "invalidResultReference"
      );
    },
  },
  {
    id: "result-ref-wrong-method-name",
    name: "Result reference with wrong method name returns error",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Email/query",
            {
              accountId: ctx.accountId,
              filter: { inMailbox: ctx.roleMailboxes["inbox"] },
              limit: 1,
            },
            "query",
          ],
          [
            "Email/get",
            {
              accountId: ctx.accountId,
              "#ids": {
                resultOf: "query",
                name: "Mailbox/get", // Wrong method name
                path: "/ids",
              },
            },
            "get",
          ],
        ]
      );

      // The second response should be an error
      const [name, args] = response.methodResponses[1];
      ctx.assertEqual(name, "error");
      ctx.assertEqual(
        (args as Record<string, unknown>).type,
        "invalidResultReference"
      );
    },
  },
  {
    id: "result-ref-path-single-value",
    name: "Result reference with path to single value",
    fn: async (ctx) => {
      // Get state from Mailbox/get, use it in Mailbox/changes
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Mailbox/get",
            { accountId: ctx.accountId, ids: [] },
            "getState",
          ],
          [
            "Mailbox/changes",
            {
              accountId: ctx.accountId,
              "#sinceState": {
                resultOf: "getState",
                name: "Mailbox/get",
                path: "/state",
              },
            },
            "changes",
          ],
        ]
      );

      ctx.assertLength(response.methodResponses, 2);
      const [name2, args2] = response.methodResponses[1];
      ctx.assertEqual(name2, "Mailbox/changes");
      // Should succeed since we used the current state
      const resp = args2 as Record<string, unknown>;
      ctx.assertTruthy(resp.oldState, "Should have oldState");
      ctx.assertTruthy(resp.newState, "Should have newState");
    },
  },
  {
    id: "result-ref-call-id-preserved",
    name: "Call IDs are preserved in responses for result references",
    fn: async (ctx) => {
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          ["Core/echo", { value: 1 }, "first"],
          ["Core/echo", { value: 2 }, "second"],
          ["Core/echo", { value: 3 }, "third"],
        ]
      );

      ctx.assertLength(response.methodResponses, 3);
      ctx.assertEqual(response.methodResponses[0][2], "first");
      ctx.assertEqual(response.methodResponses[1][2], "second");
      ctx.assertEqual(response.methodResponses[2][2], "third");
    },
  },
]);
