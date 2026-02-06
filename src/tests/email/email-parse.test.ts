import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.9", category: "email" }, [
  {
    id: "parse-valid-message",
    name: "Email/parse parses uploaded RFC 5322 message",
    fn: async (ctx) => {
      const message = [
        "From: Parser Test <parse@example.com>",
        "To: testuser@example.com",
        "Subject: Parse test message",
        "Date: Mon, 01 Jan 2026 12:00:00 +0000",
        "Message-ID: <parse-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        "This is a message to be parsed.",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: [upload.blobId],
        properties: ["subject", "from", "to", "textBody", "bodyValues"],
        fetchTextBodyValues: true,
      });

      const parsed = result.parsed as Record<
        string,
        Record<string, unknown>
      >;
      ctx.assertTruthy(parsed[upload.blobId]);
      const email = parsed[upload.blobId];
      ctx.assertEqual(email.subject, "Parse test message");
      const from = email.from as Array<{ email: string }>;
      ctx.assertEqual(from[0].email, "parse@example.com");
    },
  },
  {
    id: "parse-null-metadata",
    name: "Email/parse returns null for metadata properties (id, mailboxIds, etc)",
    fn: async (ctx) => {
      const message = [
        "From: meta@example.com",
        "To: testuser@example.com",
        "Subject: Metadata parse test",
        "Message-ID: <parse-meta@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain",
        "",
        "body",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: [upload.blobId],
        properties: [
          "id",
          "blobId",
          "threadId",
          "mailboxIds",
          "keywords",
          "receivedAt",
          "subject",
        ],
      });

      const parsed = result.parsed as Record<
        string,
        Record<string, unknown>
      >;
      const email = parsed[upload.blobId];
      // Metadata properties should be null for parsed (not-stored) emails
      ctx.assertEqual(email.id, null);
      ctx.assertEqual(email.threadId, null);
      ctx.assertEqual(email.mailboxIds, null);
      ctx.assertEqual(email.keywords, null);
      ctx.assertEqual(email.receivedAt, null);
      // But subject should be parsed
      ctx.assertEqual(email.subject, "Metadata parse test");
    },
  },
  {
    id: "parse-not-found",
    name: "Email/parse returns notFound for invalid blobId",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: ["nonexistent-blob-xyz"],
      });
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "nonexistent-blob-xyz");
    },
  },
  {
    id: "parse-not-parsable",
    name: "Email/parse returns notParsable for non-email blob",
    required: false,
    fn: async (ctx) => {
      // Upload non-email content
      const upload = await ctx.client.upload(
        new TextEncoder().encode("this is not an email at all, just random text"),
        "application/octet-stream"
      );

      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: [upload.blobId],
      });

      // RFC 8621 S4.9: "If the blobId is syntactically valid but the data is
      // not parsable... the blobId is included in the notParsable list."
      const notParsable = result.notParsable as string[];
      ctx.assertTruthy(
        notParsable?.length > 0,
        "Server MUST return notParsable for non-email blob"
      );
      ctx.assertIncludes(notParsable, upload.blobId);
    },
  },
  {
    id: "parse-body-values",
    name: "Email/parse returns body values when requested",
    fn: async (ctx) => {
      const message = [
        "From: bv@example.com",
        "To: testuser@example.com",
        "Subject: Body values parse",
        "Message-ID: <parse-bv@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain",
        "",
        "The body content for parsing.",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: [upload.blobId],
        properties: ["textBody", "bodyValues"],
        bodyProperties: ["partId"],
        fetchTextBodyValues: true,
      });

      const parsed = result.parsed as Record<
        string,
        Record<string, unknown>
      >;
      const email = parsed[upload.blobId];
      const bodyValues = email.bodyValues as Record<
        string,
        { value: string }
      >;
      const keys = Object.keys(bodyValues);
      ctx.assertGreaterThan(keys.length, 0);
      ctx.assertStringContains(
        bodyValues[keys[0]].value,
        "body content for parsing"
      );
    },
  },
  {
    id: "parse-response-structure",
    name: "Email/parse response has required properties",
    fn: async (ctx) => {
      const message = new TextEncoder().encode(
        "From: x@example.com\r\nTo: y@example.com\r\nSubject: test\r\n\r\nbody"
      );
      const upload = await ctx.client.upload(message, "message/rfc5322");

      const result = await ctx.client.call("Email/parse", {
        accountId: ctx.accountId,
        blobIds: [upload.blobId],
      });

      ctx.assertType(result.accountId, "string");
      ctx.assertTruthy(
        result.parsed !== undefined || result.notParsable !== undefined,
        "Must have parsed or notParsable"
      );
    },
  },
]);
