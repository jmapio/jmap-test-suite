import { defineTests } from "../../runner/test-registry.js";
import { JmapMethodError } from "../../client/jmap-client.js";

defineTests({ rfc: "RFC8620", section: "6.3", category: "binary" }, [
  {
    id: "blob-copy-same-account-error",
    name: "Blob/copy rejects same-account copy",
    fn: async (ctx) => {
      try {
        await ctx.client.call("Blob/copy", {
          fromAccountId: ctx.accountId,
          accountId: ctx.accountId,
          blobIds: ["placeholder"],
        });
        ctx.assert(
          false,
          "Server must reject Blob/copy when fromAccountId equals accountId"
        );
      } catch (err) {
        if (err instanceof JmapMethodError) {
          ctx.assertTruthy(
            err.type,
            "Error response must include a type"
          );
        }
      }
    },
  },
  {
    id: "blob-copy-cross-account",
    name: "Blob/copy copies blob to another account",
    fn: async (ctx) => {
      if (!ctx.secondaryClient) {
        throw new Error("SKIP: No secondary account configured");
      }

      const secondaryAccountId = ctx.secondaryClient.accountId;

      // Upload a blob in the primary account
      const data = new TextEncoder().encode("blob cross-account copy test");
      const upload = await ctx.client.upload(data, "text/plain");

      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: secondaryAccountId,
        blobIds: [upload.blobId],
      });

      const copied = result.copied as Record<string, string> | null;
      ctx.assertTruthy(copied, "copied must not be null");
      ctx.assertTruthy(
        copied![upload.blobId],
        "Blob should be in copied map"
      );
    },
  },
  {
    id: "blob-copy-not-found",
    name: "Blob/copy returns notCopied for invalid blobId",
    fn: async (ctx) => {
      if (!ctx.secondaryClient) {
        throw new Error("SKIP: No secondary account configured");
      }

      const secondaryAccountId = ctx.secondaryClient.accountId;

      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: secondaryAccountId,
        blobIds: ["nonexistent-blob-xyz"],
      });

      const notCopied = result.notCopied as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(notCopied, "notCopied must be present");
      ctx.assertTruthy(
        notCopied!["nonexistent-blob-xyz"],
        "Invalid blob should be in notCopied"
      );
      ctx.assertEqual(notCopied!["nonexistent-blob-xyz"].type, "blobNotFound");
    },
  },
  {
    id: "blob-copy-response-structure",
    name: "Blob/copy response has required properties",
    fn: async (ctx) => {
      if (!ctx.secondaryClient) {
        throw new Error("SKIP: No secondary account configured");
      }

      const secondaryAccountId = ctx.secondaryClient.accountId;

      const data = new TextEncoder().encode("structure test");
      const upload = await ctx.client.upload(data, "text/plain");

      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: secondaryAccountId,
        blobIds: [upload.blobId],
      });

      ctx.assertEqual(result.fromAccountId, ctx.accountId);
      ctx.assertEqual(result.accountId, secondaryAccountId);
    },
  },
]);
