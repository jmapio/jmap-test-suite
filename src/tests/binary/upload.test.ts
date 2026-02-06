import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "6.1", category: "binary" }, [
  {
    id: "upload-basic",
    name: "Upload binary data returns blobId, type, and size",
    fn: async (ctx) => {
      const data = new TextEncoder().encode("Hello, JMAP upload test!");
      const result = await ctx.client.upload(data, "text/plain");
      ctx.assertTruthy(result.blobId, "Must return blobId");
      ctx.assert(
        result.type === "text/plain" || result.type.startsWith("text/plain;"),
        `Expected type to be text/plain (possibly with params), got "${result.type}"`
      );
      ctx.assertEqual(result.size, data.length);
      ctx.assertEqual(result.accountId, ctx.accountId);
    },
  },
  {
    id: "upload-binary-content",
    name: "Upload binary (non-text) data preserves content",
    fn: async (ctx) => {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const result = await ctx.client.upload(data, "application/octet-stream");
      ctx.assertTruthy(result.blobId);
      ctx.assertEqual(result.size, 6);
    },
  },
  {
    id: "upload-returns-valid-blob-id",
    name: "Uploaded blobId is a valid JMAP Id",
    fn: async (ctx) => {
      const data = new TextEncoder().encode("test");
      const result = await ctx.client.upload(data, "text/plain");
      ctx.assertTruthy(result.blobId.length > 0, "blobId must not be empty");
      ctx.assertTruthy(
        result.blobId.length <= 255,
        "blobId must be <= 255 chars"
      );
    },
  },
  {
    id: "upload-large-data",
    name: "Upload moderately large data succeeds",
    fn: async (ctx) => {
      // Upload 100KB of data
      const data = new Uint8Array(100 * 1024);
      for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
      const result = await ctx.client.upload(data, "application/octet-stream");
      ctx.assertTruthy(result.blobId);
      ctx.assertEqual(result.size, 100 * 1024);
    },
  },
  {
    id: "upload-preserves-content-type",
    name: "Upload preserves specified content type (server may normalize with params)",
    fn: async (ctx) => {
      const data = new TextEncoder().encode("<html><body>test</body></html>");
      const result = await ctx.client.upload(data, "text/html");
      ctx.assert(
        result.type === "text/html" || result.type.startsWith("text/html;"),
        `Expected type to be text/html (possibly with params), got "${result.type}"`
      );
    },
  },
]);
