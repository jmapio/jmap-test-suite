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
          ctx.assertEqual(
            err.type,
            "invalidArguments",
            "Same-account copy must return invalidArguments"
          );
        }
      }
    },
  },
  {
    id: "blob-copy-cross-account",
    name: "Blob/copy copies blob to another account",
    runIf: (ctx) => ctx.crossAccountId ? true : "No cross-account access available",
    fn: async (ctx) => {
      // Upload a blob in the primary account
      const data = new TextEncoder().encode("blob cross-account copy test");
      const upload = await ctx.client.upload(data, "text/plain");

      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: ctx.crossAccountId,
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
    runIf: (ctx) => ctx.crossAccountId ? true : "No cross-account access available",
    fn: async (ctx) => {
      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: ctx.crossAccountId,
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
    runIf: (ctx) => ctx.crossAccountId ? true : "No cross-account access available",
    fn: async (ctx) => {
      const data = new TextEncoder().encode("structure test");
      const upload = await ctx.client.upload(data, "text/plain");

      const result = await ctx.client.call("Blob/copy", {
        fromAccountId: ctx.accountId,
        accountId: ctx.crossAccountId,
        blobIds: [upload.blobId],
      });

      ctx.assertEqual(result.fromAccountId, ctx.accountId);
      ctx.assertEqual(result.accountId, ctx.crossAccountId);
    },
  },
]);
