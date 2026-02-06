import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "7.5", category: "submission" }, [
  {
    id: "set-create-submission",
    name: "EmailSubmission/set creates a submission (sends email)",
    runIf: (ctx) =>
      !ctx.config.users.secondary ? "No secondary user configured"
      : ctx.identityIds.length === 0 ? "No identities available"
      : true,
    fn: async (ctx) => {
      // Create a fresh draft to send
      const draftResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          sendDraft: {
            mailboxIds: {
              [ctx.roleMailboxes["drafts"] ?? ctx.roleMailboxes["inbox"]]: true,
            },
            from: [{ name: "Test", email: ctx.identityEmail }],
            to: [{ name: "Secondary", email: ctx.secondaryEmail }],
            subject: "Submission test " + Date.now(),
            keywords: { $seen: true, $draft: true },
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "Test email sent via EmailSubmission/set" } },
          },
        },
      });
      const emailId = (draftResult.created as Record<string, { id: string }>)
        .sendDraft.id;

      try {
        const result = await ctx.client.call("EmailSubmission/set", {
          accountId: ctx.accountId,
          create: {
            sub1: {
              identityId: ctx.identityIds[0],
              emailId: emailId,
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        ctx.assertTruthy(created?.sub1, "Submission should be created");
        ctx.assertTruthy(created!.sub1.id);
        ctx.assertTruthy(created!.sub1.sendAt);
        ctx.assertTruthy(
          created!.sub1.undoStatus === "pending" ||
            created!.sub1.undoStatus === "final",
          "undoStatus must be pending or final"
        );
      } finally {
        // Clean up the draft
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
  {
    id: "set-create-with-envelope",
    name: "EmailSubmission/set with explicit envelope",
    runIf: (ctx) =>
      !ctx.config.users.secondary ? "No secondary user configured"
      : ctx.identityIds.length === 0 ? "No identities available"
      : true,
    fn: async (ctx) => {
      const draftResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          envDraft: {
            mailboxIds: {
              [ctx.roleMailboxes["drafts"] ?? ctx.roleMailboxes["inbox"]]: true,
            },
            from: [{ name: "Test", email: ctx.identityEmail }],
            to: [{ name: "Secondary", email: ctx.secondaryEmail }],
            subject: "Envelope test " + Date.now(),
            keywords: { $seen: true, $draft: true },
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "Envelope test body" } },
          },
        },
      });
      const emailId = (draftResult.created as Record<string, { id: string }>)
        .envDraft.id;

      try {
        const result = await ctx.client.call("EmailSubmission/set", {
          accountId: ctx.accountId,
          create: {
            envSub: {
              identityId: ctx.identityIds[0],
              emailId: emailId,
              envelope: {
                mailFrom: {
                  email: ctx.identityEmail,
                  parameters: null,
                },
                rcptTo: [
                  {
                    email: ctx.secondaryEmail,
                    parameters: null,
                  },
                ],
              },
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        ctx.assertTruthy(created?.envSub);
      } finally {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
  {
    id: "set-on-success-update-email",
    name: "EmailSubmission/set onSuccessUpdateEmail moves to sent and removes $draft",
    runIf: (ctx) =>
      !ctx.config.users.secondary ? "No secondary user configured"
      : ctx.identityIds.length === 0 ? "No identities available"
      : !ctx.roleMailboxes["sent"] ? "No sent mailbox found"
      : true,
    fn: async (ctx) => {
      const sentMailbox = ctx.roleMailboxes["sent"];

      const draftResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          osuDraft: {
            mailboxIds: {
              [ctx.roleMailboxes["drafts"] ?? ctx.roleMailboxes["inbox"]]: true,
            },
            from: [{ name: "Test", email: ctx.identityEmail }],
            to: [{ name: "Secondary", email: ctx.secondaryEmail }],
            subject: "onSuccess test " + Date.now(),
            keywords: { $seen: true, $draft: true },
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "onSuccess test" } },
          },
        },
      });
      const emailId = (draftResult.created as Record<string, { id: string }>)
        .osuDraft.id;

      // Use the full request to include onSuccessUpdateEmail
      const response = await ctx.client.rawRequest(
        ctx.client.defaultUsing(),
        [
          [
            "EmailSubmission/set",
            {
              accountId: ctx.accountId,
              create: {
                osuSub: {
                  identityId: ctx.identityIds[0],
                  emailId: emailId,
                },
              },
              onSuccessUpdateEmail: {
                "#osuSub": {
                  [`mailboxIds/${sentMailbox}`]: true,
                  [`mailboxIds/${ctx.roleMailboxes["drafts"] ?? ctx.roleMailboxes["inbox"]}`]:
                    null,
                  "keywords/$draft": null,
                },
              },
            },
            "submit",
          ],
        ]
      );

      // Must get both EmailSubmission/set and implicit Email/set responses synchronously
      ctx.assertGreaterOrEqual(
        response.methodResponses.length,
        2,
        "Response must include both EmailSubmission/set and implicit Email/set"
      );

      // Verify EmailSubmission/set response is first
      const [subName] = response.methodResponses[0];
      ctx.assertEqual(subName, "EmailSubmission/set");

      // Verify implicit Email/set response is present
      const emailSetResponse = response.methodResponses.find(
        ([name]) => name === "Email/set"
      );
      ctx.assertTruthy(
        emailSetResponse,
        "Implicit Email/set from onSuccessUpdateEmail must appear in methodResponses"
      );

      // Verify the email was moved (response was synchronous, no delay needed)
      const getResult = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["mailboxIds", "keywords"],
      });
      const list = getResult.list as Array<Record<string, unknown>>;
      if (list.length > 0) {
        const email = list[0];
        const mailboxIds = email.mailboxIds as Record<string, boolean>;
        const keywords = email.keywords as Record<string, boolean>;
        // Should be in sent, not in drafts
        if (mailboxIds[sentMailbox]) {
          ctx.assertEqual(mailboxIds[sentMailbox], true);
        }
        // $draft should be removed
        ctx.assertFalsy(keywords.$draft);

        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
  {
    id: "set-submission-properties",
    name: "EmailSubmission object has required properties",
    runIf: (ctx) =>
      !ctx.config.users.secondary ? "No secondary user configured"
      : ctx.identityIds.length === 0 ? "No identities available"
      : true,
    fn: async (ctx) => {
      const draftResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          propDraft: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: ctx.identityEmail }],
            to: [{ name: "Secondary", email: ctx.secondaryEmail }],
            subject: "Properties test " + Date.now(),
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (draftResult.created as Record<string, { id: string }>)
        .propDraft.id;

      try {
        const result = await ctx.client.call("EmailSubmission/set", {
          accountId: ctx.accountId,
          create: {
            propSub: {
              identityId: ctx.identityIds[0],
              emailId: emailId,
            },
          },
        });
        const created = result.created as Record<
          string,
          Record<string, unknown>
        > | null;
        if (created?.propSub) {
          const sub = created.propSub;
          ctx.assertType(sub.id, "string");
          // Verify we can fetch it
          const getResult = await ctx.client.call("EmailSubmission/get", {
            accountId: ctx.accountId,
            ids: [sub.id as string],
          });
          const fetchedSub = (
            getResult.list as Array<Record<string, unknown>>
          )[0];
          ctx.assertTruthy(fetchedSub.identityId);
          ctx.assertTruthy(fetchedSub.emailId);
          ctx.assertTruthy(fetchedSub.sendAt);
          ctx.assertTruthy(fetchedSub.undoStatus);
        }
      } finally {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
  {
    id: "set-no-recipients-error",
    name: "EmailSubmission/set MUST reject email with no recipients",
    runIf: (ctx) => ctx.identityIds.length === 0 ? "No identities available" : true,
    fn: async (ctx) => {
      // Create a draft with no To/Cc/Bcc
      const draftResult = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          noRecip: {
            mailboxIds: { [ctx.roleMailboxes["inbox"]]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            subject: "No recipients",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (draftResult.created as Record<string, { id: string }>)
        .noRecip.id;

      try {
        const result = await ctx.client.call("EmailSubmission/set", {
          accountId: ctx.accountId,
          create: {
            noRecipSub: {
              identityId: ctx.identityIds[0],
              emailId: emailId,
            },
          },
        });
        // RFC 8621 S7.5: Server MUST reject submission with no recipients
        const notCreated = result.notCreated as Record<
          string,
          { type: string }
        > | null;
        ctx.assertTruthy(
          notCreated?.noRecipSub,
          "Server MUST reject submission of email with no recipients"
        );
        ctx.assertTruthy(notCreated!.noRecipSub.type);
      } finally {
        await ctx.client.call("Email/set", {
          accountId: ctx.accountId,
          destroy: [emailId],
        });
      }
    },
  },
]);
