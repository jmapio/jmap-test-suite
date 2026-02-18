import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.4.1", category: "email" }, [
  {
    id: "filter-in-mailbox",
    name: "Email/query filter inMailbox returns emails in that mailbox",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.roleMailboxes["inbox"] },
        calculateTotal: true,
      });
      const ids = result.ids as string[];
      ctx.assertGreaterThan(ids.length, 0);
      // plain-simple should be in inbox
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
      // very-old should NOT be in inbox (it's in folderA)
      ctx.assertNotIncludes(ids, ctx.emailIds["very-old"]);
    },
  },
  {
    id: "filter-in-mailbox-other-than",
    name: "Email/query filter inMailboxOtherThan excludes specified mailboxes",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailboxOtherThan: [ctx.roleMailboxes["inbox"]] },
      });
      const ids = result.ids as string[];
      // Emails only in inbox should not appear
      // very-old is only in folderA, should appear
      ctx.assertIncludes(ids, ctx.emailIds["very-old"]);
    },
  },
  {
    id: "filter-before",
    name: "Email/query filter before returns emails before date",
    fn: async (ctx) => {
      const fiveDaysAgo = new Date(
        Date.now() - 5 * 86400000
      ).toISOString();
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { before: fiveDaysAgo },
      });
      const ids = result.ids as string[];
      // very-old (T-30d) should match
      ctx.assertIncludes(ids, ctx.emailIds["very-old"]);
      // custom-keywords (T-1d) should NOT match
      ctx.assertNotIncludes(ids, ctx.emailIds["custom-keywords"]);
    },
  },
  {
    id: "filter-after",
    name: "Email/query filter after returns emails after date",
    fn: async (ctx) => {
      const fiveDaysAgo = new Date(
        Date.now() - 5 * 86400000
      ).toISOString();
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { after: fiveDaysAgo },
      });
      const ids = result.ids as string[];
      // custom-keywords (T-1d) should match
      ctx.assertIncludes(ids, ctx.emailIds["custom-keywords"]);
      // very-old (T-30d) should NOT match
      ctx.assertNotIncludes(ids, ctx.emailIds["very-old"]);
    },
  },
  {
    id: "filter-min-size",
    name: "Email/query filter minSize returns emails at least that size",
    fn: async (ctx) => {
      // large-email should be > 10000 bytes
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { minSize: 10000 },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["large-email"]);
      // plain-simple should be small, should not appear
      ctx.assertNotIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-max-size",
    name: "Email/query filter maxSize returns emails at most that size",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { maxSize: 1000 },
      });
      const ids = result.ids as string[];
      // large-email should NOT appear
      ctx.assertNotIncludes(ids, ctx.emailIds["large-email"]);
    },
  },
  {
    id: "filter-has-keyword",
    name: "Email/query filter hasKeyword returns emails with that keyword",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { hasKeyword: "$flagged" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]);
      // plain-simple has $seen but not $flagged
      ctx.assertNotIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-not-keyword",
    name: "Email/query filter notKeyword excludes emails with keyword",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { notKeyword: "$seen" },
      });
      const ids = result.ids as string[];
      // thread-reply-1 has no $seen keyword
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-1"]);
      // plain-simple has $seen, should be excluded
      ctx.assertNotIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-has-attachment-true",
    name: "Email/query filter hasAttachment=true returns emails with attachments",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { hasAttachment: true },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]);
    },
  },
  {
    id: "filter-has-attachment-false",
    name: "Email/query filter hasAttachment=false returns emails without attachments",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { hasAttachment: false },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
      ctx.assertNotIncludes(ids, ctx.emailIds["html-attachment"]);
    },
  },
  {
    id: "filter-text-search-headers",
    name: "Email/query filter text MUST search from/to/cc/bcc/subject",
    fn: async (ctx) => {
      // "Project Alpha" appears in the subject of thread-reply-2
      // RFC 8621 S4.4.1: server MUST look up text in from, to, cc, bcc, subject
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { text: "Project Alpha" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-2"]);
    },
  },
  {
    id: "filter-text-search-body",
    name: "Email/query filter text SHOULD search body content",
    required: false,
    fn: async (ctx) => {
      // "xylophone" only appears in the body of thread-reply-2
      // RFC 8621 S4.4.1: server SHOULD look inside plain and HTML body parts
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { text: "xylophone" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-2"]);
    },
  },
  {
    id: "filter-from",
    name: "Email/query filter from matches sender",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { from: "alice@example.com" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-1"]);
    },
  },
  {
    id: "filter-to",
    name: "Email/query filter to matches recipient",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { to: "alice@example.com" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["thread-starter"]);
    },
  },
  {
    id: "filter-cc",
    name: "Email/query filter cc matches CC recipient",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { cc: "charlie@example.net" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]);
    },
  },
  {
    id: "filter-subject",
    name: "Email/query filter subject matches subject text",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { subject: "Financial Report" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]);
    },
  },
  {
    id: "filter-body",
    name: "Email/query filter body matches body text",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { body: "conference room" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-header-name-only",
    name: "Email/query filter header [name] checks header existence",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { header: ["X-Custom-Header"] },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["special-headers"]);
      ctx.assertNotIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-header-name-value",
    name: "Email/query filter header [name, value] checks header value",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { header: ["X-Custom-Header", "custom-value-12345"] },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["special-headers"]);
    },
  },
  {
    id: "filter-some-in-thread-have-keyword",
    name: "Email/query filter someInThreadHaveKeyword matches",
    fn: async (ctx) => {
      // thread-reply-2 has $answered; thread includes thread-starter and thread-reply-1
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { someInThreadHaveKeyword: "$answered" },
      });
      const ids = result.ids as string[];
      // All emails in that thread should be returned
      ctx.assertIncludes(ids, ctx.emailIds["thread-starter"]);
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-1"]);
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-2"]);
    },
  },
  {
    id: "filter-none-in-thread-have-keyword",
    name: "Email/query filter noneInThreadHaveKeyword excludes threads with keyword",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { noneInThreadHaveKeyword: "$answered" },
      });
      const ids = result.ids as string[];
      // Thread with thread-reply-2 ($answered) should be excluded
      ctx.assertNotIncludes(ids, ctx.emailIds["thread-starter"]);
      ctx.assertNotIncludes(ids, ctx.emailIds["thread-reply-1"]);
      ctx.assertNotIncludes(ids, ctx.emailIds["thread-reply-2"]);
      // plain-simple (different thread, no $answered) should be included
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-operator-and",
    name: "Email/query FilterOperator AND combines conditions",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          operator: "AND",
          conditions: [
            { hasKeyword: "$seen" },
            { inMailbox: ctx.roleMailboxes["inbox"] },
          ],
        },
      });
      const ids = result.ids as string[];
      // plain-simple is in inbox with $seen
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
      // thread-reply-1 is in inbox but no $seen
      ctx.assertNotIncludes(ids, ctx.emailIds["thread-reply-1"]);
    },
  },
  {
    id: "filter-operator-or",
    name: "Email/query FilterOperator OR combines conditions",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          operator: "OR",
          conditions: [
            { hasKeyword: "$flagged" },
            { hasKeyword: "$answered" },
          ],
        },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]); // $flagged
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-2"]); // $answered
    },
  },
  {
    id: "filter-operator-not",
    name: "Email/query FilterOperator NOT negates condition",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          operator: "NOT",
          conditions: [{ hasKeyword: "$seen" }],
        },
      });
      const ids = result.ids as string[];
      // thread-reply-1 has no $seen
      ctx.assertIncludes(ids, ctx.emailIds["thread-reply-1"]);
      // plain-simple has $seen, should be excluded
      ctx.assertNotIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
  {
    id: "filter-nested-operators",
    name: "Email/query nested FilterOperators work correctly",
    fn: async (ctx) => {
      // (inMailbox=inbox AND hasKeyword=$seen) OR hasKeyword=$flagged
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          operator: "OR",
          conditions: [
            {
              operator: "AND",
              conditions: [
                { inMailbox: ctx.roleMailboxes["inbox"] },
                { hasKeyword: "$seen" },
              ],
            },
            { hasKeyword: "$flagged" },
          ],
        },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]); // inbox + $seen
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]); // $flagged
    },
  },
  {
    id: "filter-empty-matches-all",
    name: "Email/query with null filter returns all emails",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {},
        calculateTotal: true,
      });
      const total = result.total as number;
      ctx.assertGreaterOrEqual(
        total,
        Object.keys(ctx.emailIds).length,
        "Null filter should return all emails"
      );
    },
  },
  {
    id: "filter-multiple-conditions-on-one-filter",
    name: "Email/query with multiple conditions on single FilterCondition",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          inMailbox: ctx.roleMailboxes["inbox"],
          hasKeyword: "$flagged",
        },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["html-attachment"]);
    },
  },
  {
    id: "filter-custom-keyword",
    name: "Email/query filter hasKeyword with custom keyword",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { hasKeyword: "custom_label" },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["custom-keywords"]);
      ctx.assertLength(ids, 1);
    },
  },
  {
    id: "filter-in-child-mailbox",
    name: "Email/query filter inMailbox with child mailbox",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { inMailbox: ctx.mailboxIds["child1"] },
      });
      const ids = result.ids as string[];
      ctx.assertIncludes(ids, ctx.emailIds["child-mailbox-email"]);
    },
  },
  {
    id: "filter-before-and-after",
    name: "Email/query filter with both before and after (date range)",
    fn: async (ctx) => {
      const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: {
          after: eightDaysAgo,
          before: twoDaysAgo,
        },
      });
      const ids = result.ids as string[];
      // very-old (T-30d) should be excluded (before range)
      ctx.assertNotIncludes(ids, ctx.emailIds["very-old"]);
      // custom-keywords (T-1d) should be excluded (after range)
      ctx.assertNotIncludes(ids, ctx.emailIds["custom-keywords"]);
    },
  },
  {
    id: "filter-from-display-name",
    name: "Email/query filter from matches display name",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { from: "Alice Sender" },
      });
      const ids = result.ids as string[];
      // Should match emails from Alice
      ctx.assertIncludes(ids, ctx.emailIds["plain-simple"]);
    },
  },
]);
