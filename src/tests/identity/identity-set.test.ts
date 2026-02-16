import { defineTests } from "../../runner/test-registry.js";
import { hasCapability } from "../../client/session.js";
import type { TestContext } from "../../runner/test-context.js";

const needsIdentities = (ctx: TestContext): true | string =>
  ctx.identityIds.length === 0 ? "No identities available" : true;

defineTests({ rfc: "RFC8621", section: "6.3", category: "identity" }, [
  {
    id: "set-update-name",
    name: "Identity/set update name",
    runIf: needsIdentities,
    fn: async (ctx) => {
      const identityId = ctx.identityIds[0];

      // Get original name
      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const originalName = (
        getResult.list as Array<{ name: string }>
      )[0].name;

      // Update
      const setResult = await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { name: "Test Updated Name" },
        },
      });
      ctx.assertTruthy(setResult.updated);

      // Verify
      const verifyResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const updated = (
        verifyResult.list as Array<{ name: string }>
      )[0];
      ctx.assertEqual(updated.name, "Test Updated Name");

      // Restore
      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { name: originalName },
        },
      });
    },
  },
  {
    id: "set-update-text-signature",
    name: "Identity/set update textSignature",
    runIf: needsIdentities,
    fn: async (ctx) => {
      const identityId = ctx.identityIds[0];

      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const originalSig = (
        getResult.list as Array<{ textSignature: string }>
      )[0].textSignature;

      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { textSignature: "-- \nTest Signature" },
        },
      });

      const verify = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const sig = (
        verify.list as Array<{ textSignature: string }>
      )[0].textSignature;
      ctx.assertStringContains(sig, "Test Signature");

      // Restore
      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { textSignature: originalSig },
        },
      });
    },
  },
  {
    id: "set-update-html-signature",
    name: "Identity/set update htmlSignature",
    runIf: needsIdentities,
    fn: async (ctx) => {
      const identityId = ctx.identityIds[0];

      const getResult = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const originalSig = (
        getResult.list as Array<{ htmlSignature: string }>
      )[0].htmlSignature;

      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: {
            htmlSignature: "<p><b>Test</b> HTML Signature</p>",
          },
        },
      });

      const verify = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const sig = (
        verify.list as Array<{ htmlSignature: string }>
      )[0].htmlSignature;
      ctx.assertStringContains(sig, "HTML Signature");

      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { htmlSignature: originalSig },
        },
      });
    },
  },
  {
    id: "set-update-reply-to",
    name: "Identity/set update replyTo",
    runIf: needsIdentities,
    fn: async (ctx) => {
      const identityId = ctx.identityIds[0];

      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: {
            replyTo: [{ name: "Reply Test", email: "reply@example.com" }],
          },
        },
      });

      const verify = await ctx.client.call("Identity/get", {
        accountId: ctx.accountId,
        ids: [identityId],
      });
      const replyTo = (
        verify.list as Array<{
          replyTo: Array<{ email: string }> | null;
        }>
      )[0].replyTo;
      ctx.assertTruthy(replyTo);
      ctx.assertEqual(replyTo![0].email, "reply@example.com");

      // Clear
      await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          [identityId]: { replyTo: null },
        },
      });
    },
  },
  {
    id: "set-not-found",
    name: "Identity/set update returns notUpdated for unknown id",
    runIf: (ctx) =>
      hasCapability(ctx.session, "urn:ietf:params:jmap:submission") ? true : "Server does not support submission capability",
    fn: async (ctx) => {
      const result = await ctx.client.call("Identity/set", {
        accountId: ctx.accountId,
        update: {
          "nonexistent-identity-xyz": { name: "test" },
        },
      });
      const notUpdated = result.notUpdated as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notUpdated,
        "Identity/set notUpdated must not be null when updating a nonexistent id"
      );
      ctx.assertTruthy(
        notUpdated!["nonexistent-identity-xyz"],
        "Expected notUpdated to contain error for 'nonexistent-identity-xyz'"
      );
    },
  },
]);
