import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.6", category: "email" }, [
  {
    id: "set-create-plain-text",
    name: "Email/set create plain text email",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          draft1: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test User", email: "test@example.com" }],
            to: [{ name: "Recipient", email: "recipient@example.com" }],
            subject: "Plain text creation test",
            bodyStructure: {
              type: "text/plain",
              partId: "1",
            },
            bodyValues: {
              "1": { value: "This is a plain text body created via Email/set." },
            },
          },
        },
      });
      const created = result.created as Record<string, Record<string, unknown>>;
      ctx.assertTruthy(created.draft1);
      ctx.assertTruthy(created.draft1.id);
      ctx.assertTruthy(created.draft1.blobId);
      ctx.assertTruthy(created.draft1.threadId);
      ctx.assertType(created.draft1.size, "number");

      // Cleanup
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.draft1.id as string],
      });
    },
  },
  {
    id: "set-create-html",
    name: "Email/set create HTML email",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          htmlDraft: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "Recipient", email: "recipient@example.com" }],
            subject: "HTML creation test",
            bodyStructure: {
              type: "text/html",
              partId: "1",
            },
            bodyValues: {
              "1": {
                value:
                  "<html><body><h1>Hello</h1><p>HTML body.</p></body></html>",
              },
            },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.htmlDraft);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.htmlDraft.id],
      });
    },
  },
  {
    id: "set-create-multipart-alternative",
    name: "Email/set create multipart/alternative email",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          altDraft: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "Recipient", email: "recipient@example.com" }],
            subject: "Multipart alternative test",
            bodyStructure: {
              type: "multipart/alternative",
              subParts: [
                { type: "text/plain", partId: "text" },
                { type: "text/html", partId: "html" },
              ],
            },
            bodyValues: {
              text: { value: "Plain text version" },
              html: {
                value: "<html><body><p>HTML version</p></body></html>",
              },
            },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.altDraft);

      // Verify both parts exist
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.altDraft.id],
        properties: ["textBody", "htmlBody"],
        bodyProperties: ["type"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      const textBody = email.textBody as Array<{ type: string }>;
      const htmlBody = email.htmlBody as Array<{ type: string }>;
      ctx.assertGreaterThan(textBody.length, 0);
      ctx.assertGreaterThan(htmlBody.length, 0);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.altDraft.id],
      });
    },
  },
  {
    id: "set-create-with-keywords",
    name: "Email/set create with keywords (draft, seen)",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          kwDraft: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            keywords: { $draft: true, $seen: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Keywords test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      const id = created.kwDraft.id;

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [id],
        properties: ["keywords"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      const keywords = email.keywords as Record<string, boolean>;
      ctx.assertEqual(keywords.$draft, true);
      ctx.assertEqual(keywords.$seen, true);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [id],
      });
    },
  },
  {
    id: "set-create-server-set-properties",
    name: "Email/set create returns server-set properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          ssp: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Server-set props",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const created = result.created as Record<string, Record<string, unknown>>;
      ctx.assertTruthy(created.ssp.id, "id must be server-set");
      ctx.assertTruthy(created.ssp.blobId, "blobId must be server-set");
      ctx.assertTruthy(created.ssp.threadId, "threadId must be server-set");
      ctx.assertType(created.ssp.size, "number");

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.ssp.id as string],
      });
    },
  },
  {
    id: "set-create-with-attachment",
    name: "Email/set create email with attachment via blobId",
    fn: async (ctx) => {
      const pdfBlobId = ctx.blobIds["pdf"];
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          attachEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "With attachment",
            bodyStructure: {
              type: "multipart/mixed",
              subParts: [
                { type: "text/plain", partId: "text" },
                {
                  type: "application/pdf",
                  blobId: pdfBlobId,
                  name: "test.pdf",
                  disposition: "attachment",
                },
              ],
            },
            bodyValues: {
              text: { value: "See attached PDF." },
            },
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.attachEmail);

      // Verify it has an attachment
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [created.attachEmail.id],
        properties: ["hasAttachment", "attachments"],
        bodyProperties: ["type", "name"],
      });
      const email = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(email.hasAttachment, true);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [created.attachEmail.id],
      });
    },
  },
  {
    id: "set-create-state-changes",
    name: "Email/set create changes state",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          stateEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "State change test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      ctx.assertTruthy(result.oldState);
      ctx.assertTruthy(result.newState);
      ctx.assertNotEqual(result.oldState, result.newState);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [
          (result.created as Record<string, { id: string }>).stateEmail.id,
        ],
      });
    },
  },
  {
    id: "set-create-creation-id-reference",
    name: "Email/set create uses creation id reference for mailbox",
    fn: async (ctx) => {
      // Create a mailbox and email in one request using creation id reference
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "Mailbox/set",
            {
              accountId: ctx.accountId,
              create: {
                newMb: { name: "Creation Ref Test", parentId: null },
              },
            },
            "mb",
          ],
          [
            "Email/set",
            {
              accountId: ctx.accountId,
              create: {
                refEmail: {
                  mailboxIds: { "#newMb": true },
                  from: [{ name: "Test", email: "test@example.com" }],
                  to: [{ name: "User", email: "user@example.com" }],
                  subject: "Creation ref test",
                  bodyStructure: { type: "text/plain", partId: "1" },
                  bodyValues: { "1": { value: "body" } },
                },
              },
            },
            "em",
          ],
        ]
      );

      const [, mbArgs] = response.methodResponses[0];
      const [, emArgs] = response.methodResponses[1];
      const mbCreated = (mbArgs as Record<string, unknown>)
        .created as Record<string, { id: string }>;
      const emCreated = (emArgs as Record<string, unknown>)
        .created as Record<string, { id: string }>;

      ctx.assertTruthy(mbCreated?.newMb, "Mailbox should be created");
      ctx.assertTruthy(emCreated?.refEmail, "Email should be created");

      // Cleanup
      if (emCreated?.refEmail) {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emCreated.refEmail.id],
        });
      }
      if (mbCreated?.newMb) {
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          destroy: [mbCreated.newMb.id],
        });
      }
    },
  },
]);
