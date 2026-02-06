import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.1", category: "email" }, [
  {
    id: "get-by-id",
    name: "Email/get returns email by id",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, emailId);
      ctx.client.updateState("Email", result.state as string);
    },
  },
  {
    id: "get-metadata-properties",
    name: "Email/get returns all metadata properties",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: [
          "id", "blobId", "threadId", "mailboxIds", "keywords",
          "size", "receivedAt", "hasAttachment", "preview",
        ],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];

      ctx.assertType(email.id, "string");
      ctx.assertType(email.blobId, "string");
      ctx.assertType(email.threadId, "string");
      ctx.assertType(email.mailboxIds, "object");
      ctx.assertType(email.keywords, "object");
      ctx.assertType(email.size, "number");
      ctx.assertGreaterThan(email.size as number, 0);
      ctx.assertType(email.receivedAt, "string");
      ctx.assertType(email.hasAttachment, "boolean");
      ctx.assertType(email.preview, "string");
    },
  },
  {
    id: "get-mailbox-ids",
    name: "Email/get mailboxIds reflects correct mailbox membership",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["multi-mailbox"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["mailboxIds"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const mailboxIds = email.mailboxIds as Record<string, boolean>;

      ctx.assertEqual(mailboxIds[ctx.roleMailboxes["inbox"]], true);
      ctx.assertEqual(mailboxIds[ctx.mailboxIds["folderA"]], true);
    },
  },
  {
    id: "get-keywords",
    name: "Email/get keywords reflect set keywords",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["custom-keywords"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["keywords"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const keywords = email.keywords as Record<string, boolean>;

      ctx.assertEqual(keywords.$seen, true);
      ctx.assertEqual(keywords.$forwarded, true);
      ctx.assertEqual(keywords.custom_label, true);
    },
  },
  {
    id: "get-has-attachment-true",
    name: "Email/get hasAttachment is true for email with attachment",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["hasAttachment"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(email.hasAttachment, true);
    },
  },
  {
    id: "get-has-attachment-false",
    name: "Email/get hasAttachment is false for plain email",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["hasAttachment"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(email.hasAttachment, false);
    },
  },
  {
    id: "get-thread-id-consistent",
    name: "Email/get threadId is consistent for threaded emails",
    fn: async (ctx) => {
      const ids = [
        ctx.emailIds["thread-starter"],
        ctx.emailIds["thread-reply-1"],
        ctx.emailIds["thread-reply-2"],
      ];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: ids,
        properties: ["threadId"],
      });
      const list = result.list as Array<{ threadId: string }>;
      ctx.assertLength(list, 3);
      // All three should share the same threadId
      ctx.assertEqual(list[0].threadId, list[1].threadId);
      ctx.assertEqual(list[1].threadId, list[2].threadId);
    },
  },
  {
    id: "get-not-found",
    name: "Email/get returns notFound for unknown ids",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: ["nonexistent-email-xyz"],
      });
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-email-xyz");
    },
  },
  {
    id: "get-properties-filter",
    name: "Email/get properties filter limits returned properties",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["id", "subject"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertTruthy(email.id);
      ctx.assertTruthy(email.subject !== undefined);
    },
  },
  {
    id: "get-preview-is-text",
    name: "Email/get preview is plain text summary",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["preview"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const preview = email.preview as string;
      ctx.assertType(preview, "string");
      ctx.assertGreaterThan(preview.length, 0);
      // Preview should not contain HTML tags
      ctx.assert(!preview.includes("<html>"), "Preview should be plain text");
    },
  },
  {
    id: "get-received-at-is-utc-date",
    name: "Email/get receivedAt is a valid UTC date string",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["receivedAt"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const received = email.receivedAt as string;
      // Should be parseable as a date
      const date = new Date(received);
      ctx.assert(!isNaN(date.getTime()), "receivedAt must be a valid date");
    },
  },
  {
    id: "get-multiple-emails",
    name: "Email/get with multiple ids returns all",
    fn: async (ctx) => {
      const ids = [
        ctx.emailIds["plain-simple"],
        ctx.emailIds["html-attachment"],
        ctx.emailIds["thread-starter"],
      ];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: ids,
        properties: ["id"],
      });
      const list = result.list as Array<{ id: string }>;
      ctx.assertLength(list, 3);
    },
  },
  {
    id: "get-state-returned",
    name: "Email/get returns state string",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      ctx.assertType(result.state, "string");
    },
  },
]);
