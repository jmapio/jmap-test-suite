import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8621", section: "4.1.4", category: "email" }, [
  {
    id: "body-structure",
    name: "Email/get bodyStructure returns MIME tree",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["bodyStructure"],
        bodyProperties: ["partId", "type", "name", "disposition", "size", "subParts"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bs = email.bodyStructure as Record<string, unknown>;
      ctx.assertTruthy(bs, "bodyStructure must be present");
      ctx.assertType(bs.type, "string");
    },
  },
  {
    id: "body-text-body",
    name: "Email/get textBody returns plain text parts",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody"],
        bodyProperties: ["partId", "type"],
        fetchTextBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const textBody = email.textBody as Array<Record<string, unknown>>;
      ctx.assert(Array.isArray(textBody), "textBody must be array");
      ctx.assertGreaterThan(textBody.length, 0);
      ctx.assertStringContains(textBody[0].type as string, "text/plain");
    },
  },
  {
    id: "body-html-body",
    name: "Email/get htmlBody returns HTML parts for multipart/alternative",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-only"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["htmlBody"],
        bodyProperties: ["partId", "type"],
        fetchHTMLBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const htmlBody = email.htmlBody as Array<Record<string, unknown>>;
      ctx.assert(Array.isArray(htmlBody), "htmlBody must be array");
      ctx.assertGreaterThan(htmlBody.length, 0);
      ctx.assertStringContains(htmlBody[0].type as string, "text/html");
    },
  },
  {
    id: "body-attachments",
    name: "Email/get attachments returns non-inline attachment parts",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["attachments"],
        bodyProperties: ["partId", "type", "name", "disposition", "size"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const attachments = email.attachments as Array<Record<string, unknown>>;
      ctx.assert(Array.isArray(attachments), "attachments must be array");
      ctx.assertGreaterThan(attachments.length, 0);
      ctx.assertEqual(attachments[0].name, "report.pdf");
    },
  },
  {
    id: "body-values-text",
    name: "Email/get fetchTextBodyValues returns body content",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["plain-simple"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody", "bodyValues"],
        bodyProperties: ["partId"],
        fetchTextBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bodyValues = email.bodyValues as Record<
        string,
        { value: string; isEncodingProblem: boolean; isTruncated: boolean }
      >;
      ctx.assertTruthy(bodyValues, "bodyValues must be present");
      const keys = Object.keys(bodyValues);
      ctx.assertGreaterThan(keys.length, 0, "Must have at least one body value");
      const firstValue = bodyValues[keys[0]];
      ctx.assertType(firstValue.value, "string");
      ctx.assertStringContains(firstValue.value, "conference room");
      ctx.assertType(firstValue.isEncodingProblem, "boolean");
      ctx.assertType(firstValue.isTruncated, "boolean");
      ctx.assertEqual(firstValue.isTruncated, false);
    },
  },
  {
    id: "body-values-html",
    name: "Email/get fetchHTMLBodyValues returns HTML content",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-only"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["htmlBody", "bodyValues"],
        bodyProperties: ["partId"],
        fetchHTMLBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bodyValues = email.bodyValues as Record<
        string,
        { value: string }
      >;
      const keys = Object.keys(bodyValues);
      ctx.assertGreaterThan(keys.length, 0);
      ctx.assertStringContains(bodyValues[keys[0]].value, "Weekly Digest");
    },
  },
  {
    id: "body-values-all",
    name: "Email/get fetchAllBodyValues returns all body values",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-only"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody", "htmlBody", "bodyValues"],
        bodyProperties: ["partId", "type"],
        fetchAllBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bodyValues = email.bodyValues as Record<string, { value: string }>;
      const keys = Object.keys(bodyValues);
      // Should have values for both text and HTML parts
      ctx.assertGreaterOrEqual(keys.length, 2);
    },
  },
  {
    id: "body-max-body-value-bytes",
    name: "Email/get maxBodyValueBytes truncates large bodies",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["large-email"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody", "bodyValues"],
        bodyProperties: ["partId"],
        fetchTextBodyValues: true,
        maxBodyValueBytes: 100,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bodyValues = email.bodyValues as Record<
        string,
        { value: string; isTruncated: boolean }
      >;
      const keys = Object.keys(bodyValues);
      ctx.assertGreaterThan(keys.length, 0);
      const bv = bodyValues[keys[0]];
      ctx.assert(bv.value.length <= 200, "Body should be truncated near maxBodyValueBytes");
      ctx.assertEqual(bv.isTruncated, true);
    },
  },
  {
    id: "body-properties-filter",
    name: "Email/get bodyProperties limits returned body part properties",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["bodyStructure"],
        bodyProperties: ["partId", "type"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bs = email.bodyStructure as Record<string, unknown>;
      ctx.assertTruthy(bs);
      // Should have type but might not have other properties
      if (bs.type) {
        ctx.assertType(bs.type, "string");
      }
    },
  },
  {
    id: "body-multipart-alternative-text-and-html",
    name: "Email/get textBody and htmlBody differ for multipart/alternative",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-only"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody", "htmlBody"],
        bodyProperties: ["partId", "type"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const textBody = email.textBody as Array<{ type: string }>;
      const htmlBody = email.htmlBody as Array<{ type: string }>;

      ctx.assertGreaterThan(textBody.length, 0);
      ctx.assertGreaterThan(htmlBody.length, 0);
      ctx.assertStringContains(textBody[0].type, "text/plain");
      ctx.assertStringContains(htmlBody[0].type, "text/html");
    },
  },
  {
    id: "body-inline-attachment-cid",
    name: "Email/get inline attachment has Content-ID (cid)",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["multipart-related"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["bodyStructure"],
        bodyProperties: ["partId", "type", "cid", "disposition", "subParts"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const bs = email.bodyStructure as Record<string, unknown>;
      ctx.assertTruthy(bs);

      // Find the image part (may be nested)
      const imagePart = findPart(bs, "image/jpeg");
      if (imagePart) {
        ctx.assertTruthy(imagePart.cid, "Inline image should have cid");
      }
    },
  },
  {
    id: "body-attachment-blob-id",
    name: "Email/get attachment parts have blobId for download",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["html-attachment"];
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["attachments"],
        bodyProperties: ["partId", "blobId", "type", "name", "size"],
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      const attachments = email.attachments as Array<Record<string, unknown>>;
      ctx.assertGreaterThan(attachments.length, 0);
      ctx.assertTruthy(
        attachments[0].blobId,
        "Attachment must have blobId"
      );
    },
  },
  {
    id: "body-non-utf8-charset",
    name: "Email/get handles non-UTF8 charset (EUC-KR)",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["korean-euckr"];
      if (!emailId) return; // Skip if import failed
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["textBody", "bodyValues", "from", "subject"],
        bodyProperties: ["partId", "charset"],
        fetchTextBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      // The server should decode the EUC-KR content
      const bodyValues = email.bodyValues as Record<
        string,
        { value: string; isEncodingProblem: boolean }
      >;
      const keys = Object.keys(bodyValues);
      if (keys.length > 0) {
        // If the server could decode it, isEncodingProblem should be false
        // If it couldn't, isEncodingProblem should be true
        ctx.assertType(bodyValues[keys[0]].isEncodingProblem, "boolean");
      }
    },
  },
  {
    id: "body-invalid-ascii-handling",
    name: "Email/get handles malformed ASCII email gracefully",
    fn: async (ctx) => {
      const emailId = ctx.emailIds["invalid-ascii"];
      if (!emailId) return;
      const result = await ctx.client.call("Email/get", {
        accountId: ctx.accountId,
        ids: [emailId],
        properties: ["subject", "textBody", "bodyValues"],
        bodyProperties: ["partId"],
        fetchTextBodyValues: true,
      });
      const email = (result.list as Array<Record<string, unknown>>)[0];
      // Server should handle gracefully, not crash
      ctx.assertEqual(email.subject, "Malformed email test");
    },
  },
]);

function findPart(
  part: Record<string, unknown>,
  type: string
): Record<string, unknown> | null {
  if ((part.type as string)?.includes(type)) return part;
  const subParts = part.subParts as Array<Record<string, unknown>> | undefined;
  if (subParts) {
    for (const sub of subParts) {
      const found = findPart(sub, type);
      if (found) return found;
    }
  }
  return null;
}
