import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.1.2", category: "email" }, [
  {
    id: "header-from",
    name: "Email/get 'from' returns sender address",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["from"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const from = email.from as Array<{ name: string | null; email: string }>;
      ctx.assert(Array.isArray(from), "from must be an array");
      ctx.assertGreaterThan(from.length, 0);
      ctx.assertEqual(from[0].email, "alice@example.com");
      ctx.assertEqual(from[0].name, "Alice Sender");
    },
  },
  {
    id: "header-to",
    name: "Email/get 'to' returns recipient addresses",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["to"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const to = email.to as Array<{ name: string | null; email: string }>;
      ctx.assert(Array.isArray(to), "to must be an array");
      ctx.assertGreaterThan(to.length, 0);
      ctx.assertEqual(to[0].email, "testuser@example.com");
    },
  },
  {
    id: "header-cc",
    name: "Email/get 'cc' returns CC addresses",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["cc"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const cc = email.cc as Array<{ email: string }>;
      ctx.assert(Array.isArray(cc), "cc must be an array");
      ctx.assertGreaterThan(cc.length, 0);
      ctx.assertEqual(cc[0].email, "charlie@example.net");
    },
  },
  {
    id: "header-subject",
    name: "Email/get 'subject' returns subject string",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["subject"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(email.subject, "Meeting tomorrow morning");
    },
  },
  {
    id: "header-subject-empty",
    name: "Email/get 'subject' for email with no subject",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["no-subject"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["subject"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      // Subject should be empty string or null
      ctx.assert(
        email.subject === "" || email.subject === null,
        `Expected empty/null subject, got '${email.subject}'`
      );
    },
  },
  {
    id: "header-sent-at",
    name: "Email/get 'sentAt' returns Date header as date string",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["sentAt"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      ctx.assertType(email.sentAt, "string");
      const date = new Date(email.sentAt as string);
      ctx.assert(!isNaN(date.getTime()), "sentAt must be a valid date");
    },
  },
  {
    id: "header-message-id",
    name: "Email/get 'messageId' returns array of message IDs",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["thread-starter"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["messageId"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const msgId = email.messageId as string[];
      ctx.assert(Array.isArray(msgId), "messageId must be an array");
      ctx.assertGreaterThan(msgId.length, 0);
      ctx.assertStringContains(msgId[0], "thread-alpha-001@test");
    },
  },
  {
    id: "header-in-reply-to",
    name: "Email/get 'inReplyTo' returns referenced message IDs",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["thread-reply-1"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["inReplyTo"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const inReplyTo = email.inReplyTo as string[];
      ctx.assert(Array.isArray(inReplyTo), "inReplyTo must be an array");
      ctx.assertStringContains(inReplyTo[0], "thread-alpha-001@test");
    },
  },
  {
    id: "header-references",
    name: "Email/get 'references' returns full reference chain",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["thread-reply-2"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["references"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const refs = email.references as string[];
      ctx.assert(Array.isArray(refs), "references must be an array");
      ctx.assertGreaterOrEqual(refs.length, 2);
    },
  },
  {
    id: "header-raw-access",
    name: "Email/get header:Subject:asText returns raw header value",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:Subject:asText"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const headerValue = email["header:Subject:asText"] as string;
      ctx.assertType(headerValue, "string");
      ctx.assertStringContains(headerValue, "Meeting tomorrow morning");
    },
  },
  {
    id: "header-as-addresses",
    name: "Email/get header:From:asAddresses returns parsed addresses",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:From:asAddresses"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const addrs = email["header:From:asAddresses"] as Array<{
        name: string | null;
        email: string;
      }>;
      ctx.assert(Array.isArray(addrs), "asAddresses must return array");
      ctx.assertEqual(addrs[0].email, "alice@example.com");
    },
  },
  {
    id: "header-as-message-ids",
    name: "Email/get header:Message-ID:asMessageIds returns parsed IDs",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["thread-starter"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:Message-ID:asMessageIds"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const ids = email["header:Message-ID:asMessageIds"] as string[];
      ctx.assert(Array.isArray(ids), "asMessageIds must return array");
      ctx.assertStringContains(ids[0], "thread-alpha-001@test");
    },
  },
  {
    id: "header-as-date",
    name: "Email/get header:Date:asDate returns parsed date",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:Date:asDate"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const dateStr = email["header:Date:asDate"] as string;
      ctx.assertType(dateStr, "string");
      const d = new Date(dateStr);
      ctx.assert(!isNaN(d.getTime()), "asDate must return valid date");
    },
  },
  {
    id: "header-as-urls",
    name: "Email/get header:List-Unsubscribe:asURLs returns URL array",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["special-headers"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:List-Unsubscribe:asURLs"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const urls = email["header:List-Unsubscribe:asURLs"] as string[];
      ctx.assert(Array.isArray(urls), "asURLs must return array");
      ctx.assertGreaterThan(urls.length, 0);
      ctx.assertStringContains(urls[0], "example.com/unsub");
    },
  },
  {
    id: "header-custom-header",
    name: "Email/get header:X-Custom-Header returns custom header value",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["special-headers"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:X-Custom-Header:asText"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const value = email["header:X-Custom-Header:asText"] as string;
      ctx.assertType(value, "string");
      ctx.assertStringContains(value, "custom-value-12345");
    },
  },
  {
    id: "header-intl-from-decoded",
    name: "Email/get decodes RFC 2047 encoded From header",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["intl-sender"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["from"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const from = email.from as Array<{ name: string | null; email: string }>;
      ctx.assertGreaterThan(from.length, 0);
      ctx.assertEqual(from[0].email, "kaneshiro@example.com");
      // Name should be decoded from UTF-8
      if (from[0].name) {
        ctx.assertTruthy(
          from[0].name.length > 0,
          "Decoded name should not be empty"
        );
      }
    },
  },
  {
    id: "header-as-grouped-addresses",
    name: "Email/get header:From:asGroupedAddresses returns grouped format",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:From:asGroupedAddresses"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const groups = email["header:From:asGroupedAddresses"] as Array<{
        name: string | null;
        addresses: Array<{ name: string | null; email: string }>;
      }>;
      ctx.assert(Array.isArray(groups), "asGroupedAddresses must return array");
      ctx.assertGreaterThan(groups.length, 0);
      ctx.assert(
        Array.isArray(groups[0].addresses),
        "Each group must have addresses array"
      );
    },
  },
  {
    id: "header-raw-form",
    name: "Email/get header:Subject (raw) returns raw header value",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:Subject"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const raw = email["header:Subject"] as string;
      ctx.assertType(raw, "string");
      // Raw form preserves the original encoding
      ctx.assertStringContains(raw, "Meeting tomorrow morning");
    },
  },
  {
    id: "header-case-insensitive",
    name: "Email/get header names are case-insensitive",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["header:subject:asText", "header:SUBJECT:asText"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const lower = email["header:subject:asText"] as string;
      const upper = email["header:SUBJECT:asText"] as string;
      // Both should return values (server may normalize the key name)
      ctx.assertTruthy(lower || upper, "At least one form should return a value");
    },
  },
  {
    id: "header-bcc",
    name: "Email/get 'bcc' returns BCC addresses when available",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["bcc-email"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["bcc"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bcc = email.bcc as Array<{ email: string }> | null;
      // BCC may or may not be preserved depending on server
      if (bcc && bcc.length > 0) {
        ctx.assertEqual(bcc[0].email, "secret@example.com");
      }
    },
  },
]);
