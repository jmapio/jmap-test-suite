import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.8", category: "email" }, [
  {
    id: "import-valid-message",
    name: "Email/import imports a valid RFC 5322 message",
    fn: async (ctx) => {
      const message = [
        "From: import-test@example.com",
        "To: testuser@example.com",
        "Subject: Import test message",
        "Date: Thu, 01 Jan 2026 12:00:00 +0000",
        "Message-ID: <import-test-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        "This is an imported message.",
      ].join("\r\n");

      const data = new TextEncoder().encode(message);
      const upload = await ctx.client.upload(data, "message/rfc5322");

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          imp1: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            keywords: { $seen: true },
            receivedAt: "2026-01-01T12:00:00Z",
          },
        },
      });

      const created = result.created as Record<string, { id: string; blobId: string; size: number }>;
      ctx.assertTruthy(created.imp1);
      ctx.assertTruthy(created.imp1.id);
      ctx.assertTruthy(created.imp1.blobId);
      ctx.assertType(created.imp1.size, "number");

      // Verify the imported email
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.imp1.id],
        properties: ["subject", "from", "keywords", "receivedAt"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(email.subject, "Import test message");

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.imp1.id],
      });
    },
  },
  {
    id: "import-sets-mailbox",
    name: "Email/import places email in specified mailbox",
    fn: async (ctx) => {
      const message = [
        "From: import-mb@example.com",
        "To: testuser@example.com",
        "Subject: Import mailbox test",
        "Date: Thu, 01 Jan 2026 12:00:00 +0000",
        "Message-ID: <import-mb-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain",
        "",
        "Imported to specific mailbox.",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          mbImp: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.mailboxIds["folderB"]]: true },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.mbImp);

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.mbImp.id],
        properties: ["mailboxIds"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      const mailboxIds = email.mailboxIds as Record<string, boolean>;
      ctx.assertEqual(mailboxIds[ctx.mailboxIds["folderB"]], true);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.mbImp.id],
      });
    },
  },
  {
    id: "import-sets-keywords",
    name: "Email/import sets specified keywords",
    fn: async (ctx) => {
      const message = [
        "From: import-kw@example.com",
        "To: testuser@example.com",
        "Subject: Import keywords test",
        "Date: Thu, 01 Jan 2026 12:00:00 +0000",
        "Message-ID: <import-kw-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain",
        "",
        "Keywords test.",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          kwImp: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            keywords: { $seen: true, $flagged: true },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.kwImp.id],
        properties: ["keywords"],
      });
      const keywords = (getResult.list as Array<Record<string, unknown>>)[0]
        .keywords as Record<string, boolean>;
      ctx.assertEqual(keywords.$seen, true);
      ctx.assertEqual(keywords.$flagged, true);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.kwImp.id],
      });
    },
  },
  {
    id: "import-sets-received-at",
    name: "Email/import sets specified receivedAt date",
    fn: async (ctx) => {
      const message = [
        "From: import-date@example.com",
        "To: testuser@example.com",
        "Subject: Import date test",
        "Date: Wed, 15 Jan 2025 10:30:00 +0000",
        "Message-ID: <import-date-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain",
        "",
        "Date test.",
      ].join("\r\n");

      const upload = await ctx.client.upload(
        new TextEncoder().encode(message),
        "message/rfc5322"
      );

      const receivedAt = "2025-06-15T10:30:00Z";
      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          dateImp: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            receivedAt,
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.dateImp.id],
        properties: ["receivedAt"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      const actual = new Date(email.receivedAt as string).getTime();
      const expected = new Date(receivedAt).getTime();
      ctx.assertEqual(actual, expected);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.dateImp.id],
      });
    },
  },
  {
    id: "import-invalid-blob",
    name: "Email/import rejects non-message blob",
    required: false,
    fn: async (ctx) => {
      // Upload non-email data
      const data = new TextEncoder().encode("this is not an email");
      const upload = await ctx.client.upload(data, "application/octet-stream");

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          badImp: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
          },
        },
      });
      // RFC 8621 S4.8: blob must be a valid RFC 5322 message
      const notCreated = result.notCreated as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notCreated?.badImp,
        "Server MUST reject import of non-RFC5322 blob"
      );
      ctx.assertTruthy(notCreated!.badImp.type);
      // Clean up if server erroneously created it
      const created = result.created as Record<string, { id: string }> | null;
      if (created?.badImp) {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [created.badImp.id],
        });
      }
    },
  },
  {
    id: "import-not-found-blob",
    name: "Email/import returns error for nonexistent blobId",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          notFound: {
            blobId: "nonexistent-blob-xyz",
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
          },
        },
      });
      const notCreated = result.notCreated as Record<
        string,
        { type: string }
      >;
      ctx.assertTruthy(notCreated.notFound);
      ctx.assertEqual(notCreated.notFound.type, "blobNotFound");
    },
  },
  {
    id: "import-multiple",
    name: "Email/import can import multiple emails at once",
    fn: async (ctx) => {
      const msg1 = new TextEncoder().encode(
        [
          "From: batch1@example.com",
          "To: testuser@example.com",
          "Subject: Batch import 1",
          "Message-ID: <batch1@test>",
          "MIME-Version: 1.0",
          "Content-Type: text/plain",
          "",
          "Batch 1",
        ].join("\r\n")
      );
      const msg2 = new TextEncoder().encode(
        [
          "From: batch2@example.com",
          "To: testuser@example.com",
          "Subject: Batch import 2",
          "Message-ID: <batch2@test>",
          "MIME-Version: 1.0",
          "Content-Type: text/plain",
          "",
          "Batch 2",
        ].join("\r\n")
      );

      const up1 = await ctx.client.upload(msg1, "message/rfc5322");
      const up2 = await ctx.client.upload(msg2, "message/rfc5322");

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          b1: {
            blobId: up1.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
          },
          b2: {
            blobId: up2.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.b1);
      ctx.assertTruthy(created.b2);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.b1.id, created.b2.id],
      });
    },
  },
  {
    id: "import-state-changes",
    name: "Email/import returns oldState and newState",
    fn: async (ctx) => {
      const message = new TextEncoder().encode(
        [
          "From: state@example.com",
          "To: testuser@example.com",
          "Subject: State test",
          "Message-ID: <state-imp@test>",
          "MIME-Version: 1.0",
          "Content-Type: text/plain",
          "",
          "body",
        ].join("\r\n")
      );
      const upload = await ctx.client.upload(message, "message/rfc5322");

      const result = await ctx.client.call("Email/import", {
        accountId: ctx.accountId,
        emails: {
          st: {
            blobId: upload.blobId,
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
          },
        },
      });
      ctx.assertTruthy(result.newState);

      const created = result.created as Record<string, { id: string }>;
      if (created?.st) {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [created.st.id],
        });
      }
    },
  },
]);
