import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.6", category: "email" }, [
  {
    id: "set-update-add-keyword",
    name: "Email/set update adds keyword",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$flagged": true },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["keywords"],
      });
      const keywords = (getResult.list as Array<Record<string, unknown>>)[0]
        .keywords as Record<string, boolean>;
      ctx.assertEqual(keywords.$flagged, true);

      // Revert
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$flagged": null },
        },
      });
    },
  },
  {
    id: "set-update-remove-keyword",
    name: "Email/set update removes keyword via patch null",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["custom-keywords"];

      // Remove $forwarded
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$forwarded": null },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["keywords"],
      });
      const keywords = (getResult.list as Array<Record<string, unknown>>)[0]
        .keywords as Record<string, boolean>;
      ctx.assertFalsy(keywords.$forwarded);

      // Restore
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$forwarded": true },
        },
      });
    },
  },
  {
    id: "set-update-replace-keywords",
    name: "Email/set update replaces all keywords at once",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: {
            keywords: { $seen: true, $flagged: true },
          },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["keywords"],
      });
      const keywords = (getResult.list as Array<Record<string, unknown>>)[0]
        .keywords as Record<string, boolean>;
      ctx.assertEqual(keywords.$seen, true);
      ctx.assertEqual(keywords.$flagged, true);

      // Restore original
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: {
            keywords: { $seen: true },
          },
        },
      });
    },
  },
  {
    id: "set-update-move-mailbox",
    name: "Email/set update moves email to different mailbox",
    fn: async (ctx) => {
      // Create a temporary email in inbox
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          moveEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Move test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createResult.created as Record<string, { id: string }>)
        .moveEmail.id;

      // Move to folderA
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: {
            mailboxIds: { [ctx.mailboxIds["folderA"]]: true },
          },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["mailboxIds"],
      });
      const mailboxIds = (getResult.list as Array<Record<string, unknown>>)[0]
        .mailboxIds as Record<string, boolean>;
      ctx.assertEqual(mailboxIds[ctx.mailboxIds["folderA"]], true);
      ctx.assertFalsy(mailboxIds[ctx.roleMailboxes["inbox"]]);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });
    },
  },
  {
    id: "set-update-add-mailbox",
    name: "Email/set update adds email to additional mailbox",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          addMbEmail: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Add mailbox test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createResult.created as Record<string, { id: string }>)
        .addMbEmail.id;

      // Add to folderB while keeping inbox
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: {
            [`mailboxIds/${ctx.mailboxIds["folderB"]}`]: true,
          },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["mailboxIds"],
      });
      const mailboxIds = (getResult.list as Array<Record<string, unknown>>)[0]
        .mailboxIds as Record<string, boolean>;
      ctx.assertEqual(mailboxIds[ctx.roleMailboxes["inbox"]], true);
      ctx.assertEqual(mailboxIds[ctx.mailboxIds["folderB"]], true);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });
    },
  },
  {
    id: "set-update-remove-mailbox",
    name: "Email/set update removes email from a mailbox via patch null",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          rmMbEmail: {
            mailboxIds: {
              [ctx.roleMailboxes["inbox"]]: true,
              [ctx.mailboxIds["folderA"]]: true,
            },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Remove mailbox test",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createResult.created as Record<string, { id: string }>)
        .rmMbEmail.id;

      // Remove from folderA
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: {
            [`mailboxIds/${ctx.mailboxIds["folderA"]}`]: null,
          },
        },
      });

      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["mailboxIds"],
      });
      const mailboxIds = (getResult.list as Array<Record<string, unknown>>)[0]
        .mailboxIds as Record<string, boolean>;
      ctx.assertEqual(mailboxIds[ctx.roleMailboxes["inbox"]], true);
      ctx.assertFalsy(mailboxIds[ctx.mailboxIds["folderA"]]);

      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });
    },
  },
  {
    id: "set-update-if-in-state",
    name: "Email/set update with ifInState succeeds with correct state",
    fn: async (ctx) => {
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [],
      });
      const state = getResult.state as string;

      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        ifInState: state,
        update: {
          [emailId]: { "keywords/$flagged": true },
        },
      });
      ctx.assertTruthy(result.newState);

      // Revert
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          [emailId]: { "keywords/$flagged": null },
        },
      });
    },
  },
  {
    id: "set-update-not-found",
    name: "Email/set update returns notUpdated for unknown id",
    fn: async (ctx) => {
      const result = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        update: {
          "nonexistent-email-xyz": { "keywords/$seen": true },
        },
      });
      const notUpdated = result.notUpdated as Record<
        string,
        { type: string }
      >;
      ctx.assertTruthy(notUpdated["nonexistent-email-xyz"]);
      ctx.assertEqual(notUpdated["nonexistent-email-xyz"].type, "notFound");
    },
  },
]);
