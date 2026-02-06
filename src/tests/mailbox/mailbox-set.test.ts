import { defineTests } from "../../runner/test-registry.js";
import { JmapMethodError } from "../../client/jmap-client.js";

defineTests({ rfc: "RFC8621", section: "2.5", category: "mailbox" }, [
  {
    id: "set-create-top-level",
    name: "Mailbox/set create top-level mailbox",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          test1: { name: "Set Test Top Level", parentId: null },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.test1);
      ctx.assertTruthy(created.test1.id);

      // Cleanup
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [created.test1.id],
      });
    },
  },
  {
    id: "set-create-child",
    name: "Mailbox/set create child mailbox",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          child: {
            name: "Set Test Child",
            parentId: ctx.mailboxIds["folderA"],
          },
        },
      });
      const created = result.created as Record<string, { id: string }>;
      ctx.assertTruthy(created.child);

      // Verify parent
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [created.child.id],
      });
      const mb = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.parentId, ctx.mailboxIds["folderA"]);

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [created.child.id],
      });
    },
  },
  {
    id: "set-rename",
    name: "Mailbox/set rename mailbox",
    fn: async (ctx) => {
      // Create
      const createResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          rename: { name: "Before Rename", parentId: null },
        },
      });
      const mbId = (createResult.created as Record<string, { id: string }>).rename.id;

      // Rename
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        update: {
          [mbId]: { name: "After Rename" },
        },
      });

      // Verify
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [mbId],
      });
      const mb = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.name, "After Rename");

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mbId],
      });
    },
  },
  {
    id: "set-move-parent",
    name: "Mailbox/set change parent (move mailbox)",
    fn: async (ctx) => {
      // Create under folderA
      const createResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          movable: {
            name: "Movable Folder",
            parentId: ctx.mailboxIds["folderA"],
          },
        },
      });
      const mbId = (createResult.created as Record<string, { id: string }>).movable.id;

      // Move to folderB
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        update: {
          [mbId]: { parentId: ctx.mailboxIds["folderB"] },
        },
      });

      // Verify
      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [mbId],
      });
      const mb = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.parentId, ctx.mailboxIds["folderB"]);

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mbId],
      });
    },
  },
  {
    id: "set-destroy-empty",
    name: "Mailbox/set destroy empty mailbox",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          destroyMe: { name: "Destroy Me", parentId: null },
        },
      });
      const mbId = (createResult.created as Record<string, { id: string }>).destroyMe.id;

      const destroyResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mbId],
      });
      const destroyed = destroyResult.destroyed as string[];
      ctx.assertIncludes(destroyed, mbId);
    },
  },
  {
    id: "set-destroy-not-found",
    name: "Mailbox/set destroy returns notDestroyed for unknown id",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: ["nonexistent-mailbox-xyz"],
      });
      const notDestroyed = result.notDestroyed as Record<
        string,
        { type: string }
      >;
      ctx.assertTruthy(notDestroyed["nonexistent-mailbox-xyz"]);
      ctx.assertEqual(notDestroyed["nonexistent-mailbox-xyz"].type, "notFound");
    },
  },
  {
    id: "set-create-returns-server-set-props",
    name: "Mailbox/set create returns server-set properties",
    fn: async (ctx) => {
      const result = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          serverSet: { name: "Server Set Props", parentId: null },
        },
      });
      const created = result.created as Record<string, Record<string, unknown>>;
      const mb = created.serverSet;
      ctx.assertTruthy(mb.id, "Server must set id");

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mb.id as string],
      });
    },
  },
  {
    id: "set-state-changes",
    name: "Mailbox/set returns oldState and newState",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          stateTest: { name: "State Test", parentId: null },
        },
      });
      ctx.assertTruthy(createResult.oldState);
      ctx.assertTruthy(createResult.newState);
      ctx.assertNotEqual(createResult.oldState, createResult.newState);

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [(createResult.created as Record<string, { id: string }>).stateTest.id],
      });
    },
  },
  {
    id: "set-on-destroy-remove-emails",
    name: "Mailbox/set destroy with onDestroyRemoveEmails removes emails",
    fn: async (ctx) => {
      // Create a mailbox and put an email in it
      const createMb = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          tempMb: { name: "Temp With Email", parentId: null },
        },
      });
      const mbId = (createMb.created as Record<string, { id: string }>).tempMb.id;

      // Create an email in this mailbox
      const createEmail = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          tempEmail: {
            mailboxIds: { [mbId]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Temp email for destroy test",
            bodyStructure: {
              type: "text/plain",
              partId: "1",
            },
            bodyValues: {
              "1": { value: "Temporary email body" },
            },
          },
        },
      });

      // Destroy mailbox with onDestroyRemoveEmails
      const destroyResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mbId],
        onDestroyRemoveEmails: true,
      });
      const destroyed = destroyResult.destroyed as string[];
      ctx.assertIncludes(destroyed, mbId);
    },
  },
  {
    id: "set-on-destroy-remove-emails-with-children",
    name: "Mailbox/set destroy with onDestroyRemoveEmails MUST fail if mailbox has children",
    fn: async (ctx) => {
      // Create parent with an email and a child mailbox
      const createParent = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          parent: { name: "Parent For Destroy Child Test", parentId: null },
        },
      });
      const parentId = (createParent.created as Record<string, { id: string }>).parent.id;

      const createChild = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          child: { name: "Child Of Destroy Test", parentId: parentId },
        },
      });
      const childId = (createChild.created as Record<string, { id: string }>).child.id;

      // Put an email in the parent
      const createEmail = await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        create: {
          tempEmail: {
            mailboxIds: { [parentId]: true },
            from: [{ name: "Test", email: "test@example.com" }],
            to: [{ name: "User", email: "user@example.com" }],
            subject: "Email in parent with child",
            bodyStructure: { type: "text/plain", partId: "1" },
            bodyValues: { "1": { value: "body" } },
          },
        },
      });
      const emailId = (createEmail.created as Record<string, { id: string }>).tempEmail.id;

      // Try to destroy parent with onDestroyRemoveEmails — must still fail with mailboxHasChild
      const destroyResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [parentId],
        onDestroyRemoveEmails: true,
      });
      const notDestroyed = destroyResult.notDestroyed as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notDestroyed?.[parentId],
        "Server MUST refuse to destroy mailbox with children even with onDestroyRemoveEmails"
      );
      ctx.assertEqual(notDestroyed![parentId].type, "mailboxHasChild");

      // Verify child mailbox still exists
      const childGet = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [childId],
      });
      ctx.assertLength(childGet.list as unknown[], 1, "Child mailbox must still exist");

      // Verify email still exists
      const emailGet = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["id"],
      });
      ctx.assertLength(emailGet.list as unknown[], 1, "Email in parent must still exist");

      // Cleanup
      await ctx.client.call("Email/set", {
        accountId: ctx.accountId,
        destroy: [emailId],
      });
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [childId],
      });
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [parentId],
      });
    },
  },
  {
    id: "set-duplicate-name-same-parent",
    name: "Mailbox/set MUST reject duplicate name under same parent",
    fn: async (ctx) => {
      // Create first
      const create1 = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          dup1: { name: "Duplicate Name Test", parentId: null },
        },
      });
      const id1 = (create1.created as Record<string, { id: string }>).dup1.id;

      try {
        // Try to create another with same name — RFC 8621 S2 says MUST reject
        const create2 = await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          create: {
            dup2: { name: "Duplicate Name Test", parentId: null },
          },
        });
        const notCreated = create2.notCreated as Record<
          string,
          { type: string }
        > | null;
        ctx.assertTruthy(
          notCreated?.dup2,
          "Server MUST reject duplicate mailbox name under same parent"
        );
        ctx.assertEqual(notCreated!.dup2.type, "alreadyExists");
        // Clean up if server erroneously created it
        if ((create2.created as Record<string, { id: string }>)?.dup2) {
          await ctx.client.call("Mailbox/set", {
            accountId: ctx.accountId,
            destroy: [
              (create2.created as Record<string, { id: string }>).dup2.id,
            ],
          });
        }
      } finally {
        await ctx.client.call("Mailbox/set", {
          accountId: ctx.accountId,
          destroy: [id1],
        });
      }
    },
  },
  {
    id: "set-change-sort-order",
    name: "Mailbox/set update sortOrder",
    fn: async (ctx) => {
      const createResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          sortTest: { name: "Sort Order Test", parentId: null, sortOrder: 10 },
        },
      });
      const mbId = (createResult.created as Record<string, { id: string }>).sortTest.id;

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        update: { [mbId]: { sortOrder: 99 } },
      });

      const getResult = await ctx.client.call("Mailbox/get", {
        accountId: ctx.accountId,
        ids: [mbId],
      });
      const mb = (getResult.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(mb.sortOrder, 99);

      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [mbId],
      });
    },
  },
  {
    id: "set-cannot-destroy-with-children",
    name: "Mailbox/set MUST fail to destroy mailbox with children",
    fn: async (ctx) => {
      // Create parent + child
      const createParent = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          parent: { name: "Parent With Child", parentId: null },
        },
      });
      const parentId = (createParent.created as Record<string, { id: string }>).parent.id;

      const createChild = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        create: {
          child: { name: "The Child", parentId: parentId },
        },
      });
      const childId = (createChild.created as Record<string, { id: string }>).child.id;

      // Try to destroy parent without removing child first — RFC 8621 S2.5: MUST fail
      const destroyResult = await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [parentId],
      });
      const notDestroyed = destroyResult.notDestroyed as Record<
        string,
        { type: string }
      > | null;

      ctx.assertTruthy(
        notDestroyed?.[parentId],
        "Server MUST refuse to destroy mailbox that has child mailboxes"
      );
      ctx.assertEqual(notDestroyed![parentId].type, "mailboxHasChild");

      // Cleanup
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [childId],
      });
      await ctx.client.call("Mailbox/set", {
        accountId: ctx.accountId,
        destroy: [parentId],
      });
    },
  },
]);
