import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "6.2", category: "binary" }, [
  {
    id: "download-uploaded-blob",
    name: "Download a previously uploaded blob returns same data",
    fn: async (ctx) => {
      const original = new TextEncoder().encode("Download test content 12345");
      const upload = await ctx.client.upload(original, "text/plain");

      const result = await ctx.client.download(upload.blobId, "text/plain", "test.txt");
      ctx.assertEqual(result.status, 200);
      const downloaded = new Uint8Array(result.body);
      ctx.assertEqual(downloaded.length, original.length);
      for (let i = 0; i < original.length; i++) {
        ctx.assertEqual(downloaded[i], original[i], `Byte ${i} mismatch`);
      }
    },
  },
  {
    id: "download-email-blob",
    name: "Download an email's blob by blobId",
    fn: async (ctx) => {
      // Get the blobId of a known email
      const emailId = ctx.emailIds["plain-simple"];
      if (!emailId) {
        throw new Error("Test email 'plain-simple' not found");
      }

      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["blobId"],
      });
      const email = (result.list as Array<{ blobId: string }>)[0];
      ctx.assertTruthy(email.blobId);

      const download = await ctx.client.download(
        email.blobId,
        "message/rfc5322",
        "email.eml"
      );
      ctx.assertEqual(download.status, 200);
      ctx.assertGreaterThan(download.body.byteLength, 0);
    },
  },
  {
    id: "download-nonexistent-blob",
    name: "Download nonexistent blobId returns 404",
    fn: async (ctx) => {
      const result = await ctx.client.download(
        "nonexistent-blob-id-xyz",
        "application/octet-stream",
        "missing.bin"
      );
      ctx.assertEqual(result.status, 404);
    },
  },
  {
    id: "download-respects-type-param",
    name: "Download URL type parameter affects Content-Type header",
    fn: async (ctx) => {
      const data = new TextEncoder().encode("type test");
      const upload = await ctx.client.upload(data, "text/plain");

      const result = await ctx.client.download(
        upload.blobId,
        "application/octet-stream",
        "test.bin"
      );
      ctx.assertEqual(result.status, 200);
      // Content-Type should match requested type
      const ct = result.headers.get("content-type") ?? "";
      ctx.assertStringContains(ct, "application/octet-stream");
    },
  },
]);
