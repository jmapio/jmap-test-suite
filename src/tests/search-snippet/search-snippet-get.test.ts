import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "5", category: "search-snippet" }, [
  {
    id: "snippet-body-match",
    name: "SearchSnippet/get returns snippet for body text match",
    fn: async (ctx) => {
      // First query for the text
      const queryResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { text: "xylophone" },
      });
      const emailIds = queryResult.ids as string[];
      ctx.assertGreaterThan(emailIds.length, 0);

      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds,
        filter: { text: "xylophone" },
      });
      const list = result.list as Array<{
        emailId: string;
        subject: string | null;
        preview: string | null;
      }>;
      ctx.assertGreaterThan(list.length, 0);

      const snippet = list.find(
        (s) => s.emailId === ctx.emailIds["thread-reply-2"]
      );
      ctx.assertTruthy(snippet, "Should have snippet for matching email");
      // Preview should contain the search term, possibly with <mark> tags
      if (snippet!.preview) {
        ctx.assertTruthy(
          snippet!.preview.toLowerCase().includes("xylophone") ||
            snippet!.preview.includes("<mark>"),
          "Preview should highlight the match"
        );
      }
    },
  },
  {
    id: "snippet-subject-match",
    name: "SearchSnippet/get returns snippet for subject match",
    fn: async (ctx) => {
      const queryResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { text: "Financial Report" },
      });
      const emailIds = queryResult.ids as string[];

      if (emailIds.length === 0) return;

      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds,
        filter: { text: "Financial Report" },
      });
      const list = result.list as Array<{
        emailId: string;
        subject: string | null;
        preview: string | null;
      }>;

      const snippet = list.find(
        (s) => s.emailId === ctx.emailIds["html-attachment"]
      );
      if (snippet?.subject) {
        ctx.assertTruthy(
          snippet.subject.includes("Financial") ||
            snippet.subject.includes("<mark>"),
          "Subject snippet should highlight match"
        );
      }
    },
  },
  {
    id: "snippet-null-when-no-match",
    name: "SearchSnippet/get returns null fields when no text match in snippet",
    fn: async (ctx) => {
      // Get snippet for an email that doesn't match the filter text
      // (using a filter that matches some emails but requesting snippet for one that doesn't)
      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds: [ctx.emailIds["plain-simple"]],
        filter: { text: "xylophone" },
      });
      const list = result.list as Array<{
        emailId: string;
        subject: string | null;
        preview: string | null;
      }>;
      if (list.length > 0) {
        const snippet = list[0];
        // For non-matching email, subject and preview should be null
        ctx.assertEqual(snippet.subject, null);
        ctx.assertEqual(snippet.preview, null);
      }
    },
  },
  {
    id: "snippet-response-structure",
    name: "SearchSnippet/get response has required properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds: [ctx.emailIds["plain-simple"]],
        filter: { text: "meeting" },
      });
      ctx.assertType(result.accountId, "string");
      ctx.assert(Array.isArray(result.list), "list must be array");
      ctx.assert(
        result.notFound === null || (
          Array.isArray(result.notFound) && result.notFound.length >= 1
        ),
        "notFound must be null or a non-empty array"
      );
    },
  },
  {
    id: "snippet-not-found",
    name: "SearchSnippet/get returns notFound for invalid emailId",
    fn: async (ctx) => {
      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds: ["nonexistent-email-xyz"],
        filter: { text: "test" },
      });
      // Unlike standard Foo/get where notFound is always String[] (RFC 8620 §5.1),
      // SearchSnippet/get defines notFound as Id[]|null — null meaning all ids
      // were found (RFC 8621 §5). Here we expect the id to be unfound, so null
      // would indicate a server bug.
      ctx.assert(
        Array.isArray(result.notFound),
        "Expected notFound to contain 'nonexistent-email-xyz', but got null (server claims all email ids were found)"
      );
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-email-xyz");
    },
  },
  {
    id: "snippet-mark-tags",
    name: "SearchSnippet/get SHOULD use <mark> tags for highlighting",
    required: false,
    fn: async (ctx) => {
      const queryResult = await ctx.client.call("Email/query", {
        accountId: ctx.accountId,
        filter: { text: "conference" },
      });
      const emailIds = queryResult.ids as string[];
      if (emailIds.length === 0) return;

      const result = await ctx.client.call("SearchSnippet/get", {
        accountId: ctx.accountId,
        emailIds,
        filter: { text: "conference" },
      });
      const list = result.list as Array<{
        emailId: string;
        preview: string | null;
      }>;

      const snippet = list.find((s) => s.preview !== null);
      if (snippet?.preview) {
        // RFC 8621 says highlight with <mark></mark> tags
        ctx.assertStringContains(snippet.preview, "<mark>");
        ctx.assertStringContains(snippet.preview, "</mark>");
      }
    },
  },
]);
