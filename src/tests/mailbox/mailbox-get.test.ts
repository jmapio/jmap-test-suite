import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "2.1", category: "mailbox" }, [
  {
    id: "get-all",
    name: "Mailbox/get with ids=null returns all mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertGreaterThan(list.length, 0, "Must have at least one mailbox");
      ctx.client.updateState("Mailbox", result.state as string);
    },
  },
  {
    id: "get-by-ids",
    name: "Mailbox/get with specific ids returns requested mailboxes",
    fn: async (ctx) => {
      const inbox = ctx.roleMailboxes["inbox"];
      const folderA = ctx.mailboxIds["folderA"];
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [inbox, folderA],
      });
      const list = result.list as Array<{ id: string }>;
      ctx.assertLength(list, 2);
      const ids = list.map((m) => m.id);
      ctx.assertIncludes(ids, inbox);
      ctx.assertIncludes(ids, folderA);
    },
  },
  {
    id: "get-not-found",
    name: "Mailbox/get returns notFound for unknown ids",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: ["nonexistent-mailbox-xyz"],
      });
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-mailbox-xyz");
    },
  },
  {
    id: "get-properties-filter",
    name: "Mailbox/get with properties filter returns only requested properties",
    fn: async (ctx) => {
      const inbox = ctx.roleMailboxes["inbox"];
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [inbox],
        properties: ["id", "name", "role"],
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertLength(list, 1);
      const mb = list[0];
      ctx.assertTruthy(mb.id);
      ctx.assertTruthy(mb.name);
      // RFC 8620 S5.1: "only the properties listed in the array are returned"
      // The id is always returned (server-set), but other unrequested properties must be absent
      ctx.assertEqual(
        mb.totalEmails,
        undefined,
        "totalEmails must not be returned when not requested"
      );
      ctx.assertEqual(
        mb.unreadEmails,
        undefined,
        "unreadEmails must not be returned when not requested"
      );
      ctx.assertEqual(
        mb.sortOrder,
        undefined,
        "sortOrder must not be returned when not requested"
      );
    },
  },
  {
    id: "get-inbox-exists",
    name: "Inbox mailbox exists with role 'inbox'",
    fn: async (ctx) => {
      ctx.assertTruthy(ctx.roleMailboxes["inbox"], "Inbox must exist");
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [ctx.roleMailboxes["inbox"]],
      });
      const mb = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.role, "inbox");
    },
  },
  {
    id: "get-mailbox-properties",
    name: "Mailbox object has all required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [ctx.roleMailboxes["inbox"]],
      });
      const mb = (result.list as Array<Record<string, unknown>>)[0];

      ctx.assertType(mb.id, "string");
      ctx.assertType(mb.name, "string");
      // parentId can be null
      ctx.assert(
        mb.parentId === null || typeof mb.parentId === "string",
        "parentId must be null or string"
      );
      // role can be null or a role string
      ctx.assert(
        mb.role === null || typeof mb.role === "string",
        "role must be null or string"
      );
      ctx.assertType(mb.sortOrder, "number");
      ctx.assertType(mb.totalEmails, "number");
      ctx.assertType(mb.unreadEmails, "number");
      ctx.assertType(mb.totalThreads, "number");
      ctx.assertType(mb.unreadThreads, "number");
      ctx.assertType(mb.isSubscribed, "boolean");

      // myRights object
      const rights = mb.myRights as Record<string, boolean>;
      ctx.assertType(rights.mayReadItems, "boolean");
      ctx.assertType(rights.mayAddItems, "boolean");
      ctx.assertType(rights.mayRemoveItems, "boolean");
      ctx.assertType(rights.maySetSeen, "boolean");
      ctx.assertType(rights.maySetKeywords, "boolean");
      ctx.assertType(rights.mayCreateChild, "boolean");
      ctx.assertType(rights.mayRename, "boolean");
      ctx.assertType(rights.mayDelete, "boolean");
      ctx.assertType(rights.maySubmit, "boolean");
    },
  },
  {
    id: "get-parent-id-correct",
    name: "Child mailbox parentId references parent correctly",
    fn: async (ctx) => {
      const child1Id = ctx.mailboxIds["child1"];
      const folderAId = ctx.mailboxIds["folderA"];

      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [child1Id],
      });
      const mb = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.parentId, folderAId);
    },
  },
  {
    id: "get-total-emails-accurate",
    name: "Mailbox totalEmails reflects actual email count",
    fn: async (ctx) => {
      const inbox = ctx.roleMailboxes["inbox"];
      // Query emails in inbox
      const queryResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: inbox },
        calculateTotal: true,
      });
      const queryTotal = queryResult.total as number;

      // Get mailbox to check totalEmails
      const mbResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [inbox],
      });
      const mb = (mbResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.totalEmails, queryTotal);
    },
  },
  {
    id: "get-state-returned",
    name: "Mailbox/get returns state string",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      ctx.assertType(result.state, "string");
      ctx.assertTruthy((result.state as string).length > 0);
    },
  },
  {
    id: "get-account-id-returned",
    name: "Mailbox/get returns accountId in response",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      ctx.assertEqual(result.accountId, ctx.accountId);
    },
  },
]);
