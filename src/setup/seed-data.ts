import type { TestContext } from "../runner/test-context.js";

/**
 * Create test mailboxes and import test emails.
 * Records all created IDs in ctx for use by tests.
 */
export async function seedData(ctx: TestContext): Promise<void> {
  await createMailboxes(ctx);
  await uploadBlobs(ctx);
  await createEmails(ctx);
  await discoverIdentities(ctx);

  process.stderr.write(
    `Seeded: ${Object.keys(ctx.mailboxIds).length} mailboxes, ` +
      `${Object.keys(ctx.emailIds).length} emails\n`
  );
}

async function createMailboxes(ctx: TestContext): Promise<void> {
  const { client, accountId } = ctx;

  // Create top-level mailboxes
  const result = await client.call("Mailbox/set", {
    accountId,
    create: {
      folderA: { name: "Test Folder A", parentId: null },
      folderB: { name: "Test Folder B", parentId: null },
    },
  });

  const created = result.created as Record<string, { id: string }>;
  ctx.mailboxIds["folderA"] = created.folderA.id;
  ctx.mailboxIds["folderB"] = created.folderB.id;
  client.updateState("Mailbox", result.newState as string);

  process.stderr.write(
    `  Created: Test Folder A (${ctx.mailboxIds["folderA"]}), Test Folder B (${ctx.mailboxIds["folderB"]})\n`
  );

  // Create child mailboxes under Folder A
  const childResult = await client.call("Mailbox/set", {
    accountId,
    create: {
      child1: { name: "Child 1", parentId: ctx.mailboxIds["folderA"] },
      child2: { name: "Child 2", parentId: ctx.mailboxIds["folderA"] },
    },
  });

  const childCreated = childResult.created as Record<string, { id: string }>;
  ctx.mailboxIds["child1"] = childCreated.child1.id;
  ctx.mailboxIds["child2"] = childCreated.child2.id;
  client.updateState("Mailbox", childResult.newState as string);

  process.stderr.write(
    `  Created: Child 1 (${ctx.mailboxIds["child1"]}), Child 2 (${ctx.mailboxIds["child2"]})\n`
  );
}

async function uploadBlobs(ctx: TestContext): Promise<void> {
  const { client } = ctx;

  // Upload a small PDF-like blob for attachment tests
  const pdfData = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, // %PDF-1.4
    0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,       // binary header
    ...new Array(100).fill(0x20),                      // padding
  ]);
  const pdfUpload = await client.upload(pdfData, "application/pdf");
  ctx.blobIds["pdf"] = pdfUpload.blobId;

  // Upload a small JPEG-like blob for inline image tests
  // Minimal JFIF header
  const jpegData = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const jpegUpload = await client.upload(jpegData, "image/jpeg");
  ctx.blobIds["jpeg"] = jpegUpload.blobId;

  process.stderr.write(`  Uploaded ${Object.keys(ctx.blobIds).length} blobs\n`);
}

async function createEmails(ctx: TestContext): Promise<void> {
  const { client, accountId } = ctx;
  const inbox = ctx.roleMailboxes["inbox"];
  const drafts = ctx.roleMailboxes["drafts"];
  const folderA = ctx.mailboxIds["folderA"];
  const folderB = ctx.mailboxIds["folderB"];
  const child1 = ctx.mailboxIds["child1"];

  if (!inbox) throw new Error("No inbox found");

  const now = new Date();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 86400000).toISOString();
  const hoursAgo = (h: number) =>
    new Date(now.getTime() - h * 3600000).toISOString();

  // We'll import emails using Email/import for precise header control.
  // First upload the raw RFC 5322 messages as blobs, then import them.

  const emails: Array<{
    key: string;
    rfc5322: string;
    mailboxIds: Record<string, boolean>;
    keywords?: Record<string, boolean>;
    receivedAt: string;
  }> = [
    {
      key: "plain-simple",
      rfc5322: buildMessage({
        from: "Alice Sender <alice@example.com>",
        to: "testuser@example.com",
        subject: "Meeting tomorrow morning",
        date: daysAgo(10),
        messageId: "<plain-simple-001@test>",
        body: "Let's meet tomorrow at 9am in the conference room.",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(10),
    },
    {
      key: "html-attachment",
      rfc5322: buildMultipartMixed({
        from: "Bob Jones <bob@example.org>",
        to: "testuser@example.com",
        cc: "charlie@example.net",
        subject: "Q3 Financial Report",
        date: daysAgo(9),
        messageId: "<html-attach-001@test>",
        htmlBody:
          "<html><body><h1>Q3 Report</h1><p>Please find the report attached.</p></body></html>",
        attachmentBlobId: ctx.blobIds["pdf"],
        attachmentName: "report.pdf",
        attachmentType: "application/pdf",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true, $flagged: true },
      receivedAt: daysAgo(9),
    },
    {
      key: "thread-starter",
      rfc5322: buildMessage({
        from: "testuser@example.com",
        to: "alice@example.com",
        subject: "Project Alpha Discussion",
        date: daysAgo(8),
        messageId: "<thread-alpha-001@test>",
        body: "I'd like to discuss the Project Alpha timeline.",
      }),
      mailboxIds: { [folderA]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(8),
    },
    {
      key: "thread-reply-1",
      rfc5322: buildMessage({
        from: "Alice Sender <alice@example.com>",
        to: "testuser@example.com",
        subject: "Re: Project Alpha Discussion",
        date: daysAgo(7),
        messageId: "<thread-alpha-002@test>",
        inReplyTo: "<thread-alpha-001@test>",
        references: "<thread-alpha-001@test>",
        body: "Sure, let's discuss. How about Thursday?",
      }),
      mailboxIds: { [inbox]: true },
      keywords: {},
      receivedAt: daysAgo(7),
    },
    {
      key: "thread-reply-2",
      rfc5322: buildMessage({
        from: "Bob Jones <bob@example.org>",
        to: "testuser@example.com, alice@example.com",
        subject: "Re: Project Alpha Discussion",
        date: daysAgo(6),
        messageId: "<thread-alpha-003@test>",
        inReplyTo: "<thread-alpha-002@test>",
        references: "<thread-alpha-001@test> <thread-alpha-002@test>",
        body: "Thursday works for me. I'll bring the xylophone presentation materials.",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $answered: true },
      receivedAt: daysAgo(6),
    },
    {
      key: "multi-mailbox",
      rfc5322: buildMessage({
        from: "David Cross <david@example.com>",
        to: "testuser@example.com",
        subject: "Cross-filed document",
        date: daysAgo(5),
        messageId: "<multi-mb-001@test>",
        body: "This document should appear in multiple folders.",
      }),
      mailboxIds: { [inbox]: true, [folderA]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(5),
    },
    {
      key: "large-email",
      rfc5322: buildMessage({
        from: "Eve Large <eve@example.com>",
        to: "testuser@example.com",
        subject: "Detailed analysis with data",
        date: daysAgo(4),
        messageId: "<large-001@test>",
        body: "Start of analysis. " + "This is a detailed paragraph of analysis text that covers various topics. ".repeat(700) + "End of analysis.",
      }),
      mailboxIds: { [folderB]: true },
      keywords: {},
      receivedAt: daysAgo(4),
    },
    {
      key: "html-only",
      rfc5322: buildMultipartAlternative({
        from: "Frank Newsletter <frank@example.com>",
        to: "testuser@example.com",
        subject: "Newsletter: Weekly Digest",
        date: daysAgo(3),
        messageId: "<html-only-001@test>",
        textBody: "Weekly Digest - plain text version",
        htmlBody:
          '<html><body><h1>Weekly Digest</h1><p>Here is your <b>weekly digest</b> of news.</p><img src="cid:image1"/></body></html>',
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(3),
    },
    {
      key: "no-subject",
      rfc5322: buildMessage({
        from: "Grace Minimal <grace@example.com>",
        to: "testuser@example.com",
        subject: "",
        date: daysAgo(2),
        messageId: "<no-subj-001@test>",
        body: "This message has no subject.",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(2),
    },
    {
      key: "custom-keywords",
      rfc5322: buildMessage({
        from: "Henry Tags <henry@example.com>",
        to: "testuser@example.com",
        subject: "Tagged message",
        date: daysAgo(1),
        messageId: "<custom-kw-001@test>",
        body: "This message has custom keywords applied.",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true, $forwarded: true, custom_label: true },
      receivedAt: daysAgo(1),
    },
    {
      key: "very-old",
      rfc5322: buildMessage({
        from: "Iris Archive <iris@example.com>",
        to: "testuser@example.com",
        subject: "Archived correspondence",
        date: daysAgo(30),
        messageId: "<old-001@test>",
        body: "This is an old archived email from a month ago.",
      }),
      mailboxIds: { [folderA]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(30),
    },
    {
      key: "bcc-email",
      rfc5322: buildMessage({
        from: "testuser@example.com",
        to: "jack@example.com",
        bcc: "secret@example.com",
        subject: "Confidential note",
        date: daysAgo(2),
        messageId: "<bcc-001@test>",
        body: "This is a confidential message with a BCC recipient.",
      }),
      mailboxIds: { [folderA]: true },
      keywords: { $seen: true, $draft: true },
      receivedAt: daysAgo(2),
    },
    {
      key: "special-headers",
      rfc5322: buildMessage({
        from: "List Admin <list-admin@example.com>",
        to: "testuser@example.com",
        subject: "Mailing list post",
        date: daysAgo(1),
        messageId: "<list-001@test>",
        body: "This is a post from a mailing list.",
        extraHeaders: [
          "List-Post: <mailto:list@example.com>",
          "List-Unsubscribe: <https://example.com/unsub>",
          "X-Custom-Header: custom-value-12345",
        ],
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(1),
    },
    {
      key: "multipart-related",
      rfc5322: buildMultipartRelated({
        from: "Kate Images <kate@example.com>",
        to: "testuser@example.com",
        subject: "Image embedded email",
        date: hoursAgo(12),
        messageId: "<related-001@test>",
        htmlBody:
          '<html><body><p>See the image below:</p><img src="cid:image001@test"/></body></html>',
        inlineImageBlobId: ctx.blobIds["jpeg"],
        inlineImageCid: "image001@test",
      }),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: hoursAgo(12),
    },
    {
      key: "intl-sender",
      rfc5322: buildMessage({
        from: "=?UTF-8?B?6YeR5Z+O5q2m?= <kaneshiro@example.com>",
        to: "testuser@example.com",
        subject: "=?UTF-8?B?44GT44KT44Gr44Gh44Gv?=",
        date: hoursAgo(6),
        messageId: "<intl-001@test>",
        body: "This message has an internationalized sender name and subject.",
      }),
      mailboxIds: { [inbox]: true },
      keywords: {},
      receivedAt: hoursAgo(6),
    },
    // Sort test emails (16-18)
    {
      key: "sort-test-1",
      rfc5322: buildMessage({
        from: "Zara First <zara@example.com>",
        to: "testuser@example.com",
        subject: "Alpha sort test",
        date: daysAgo(5),
        messageId: "<sort-001@test>",
        body: "A".repeat(100),
      }),
      mailboxIds: { [folderB]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(3),
    },
    {
      key: "sort-test-2",
      rfc5322: buildMessage({
        from: "Amy Second <amy@example.com>",
        to: "testuser@example.com",
        subject: "Beta sort test",
        date: daysAgo(3),
        messageId: "<sort-002@test>",
        body: "B".repeat(500),
      }),
      mailboxIds: { [folderB]: true },
      keywords: { $seen: true, $flagged: true },
      receivedAt: daysAgo(2),
    },
    {
      key: "sort-test-3",
      rfc5322: buildMessage({
        from: "Mike Third <mike@example.com>",
        to: "testuser@example.com",
        subject: "Gamma sort test",
        date: daysAgo(1),
        messageId: "<sort-003@test>",
        body: "C".repeat(50),
      }),
      mailboxIds: { [folderB]: true },
      keywords: {},
      receivedAt: daysAgo(1),
    },
    // Draft for submission tests
    ...(ctx.config.users.secondary
      ? [
          {
            key: "draft-for-submission",
            rfc5322: buildMessage({
              from: `${ctx.config.users.primary.username}`,
              to: ctx.config.users.secondary.username,
              subject: "Test submission email",
              date: hoursAgo(1),
              messageId: "<submission-001@test>",
              body: "This email will be used for submission testing.",
            }),
            mailboxIds: { [drafts ?? inbox]: true },
            keywords: { $seen: true, $draft: true },
            receivedAt: hoursAgo(1),
          },
        ]
      : []),
    {
      key: "child-mailbox-email",
      rfc5322: buildMessage({
        from: "Nancy Nested <nancy@example.com>",
        to: "testuser@example.com",
        subject: "In nested folder",
        date: daysAgo(5),
        messageId: "<child-001@test>",
        body: "This email lives in a nested child mailbox.",
      }),
      mailboxIds: { [child1]: true },
      keywords: { $seen: true },
      receivedAt: daysAgo(5),
    },
    // Korean (EUC-KR) encoded email
    {
      key: "korean-euckr",
      rfc5322: buildRawMessage(
        [
          "From: =?EUC-KR?B?seS/tbjR?= <korean-sender@example.com>",
          "To: testuser@example.com",
          "Subject: =?EUC-KR?B?sNa0z7TZx9Cw+A==?=",
          `Date: ${formatRfc2822Date(new Date(now.getTime() - 5 * 3600000))}`,
          "Message-ID: <korean-001@test>",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=EUC-KR",
          "Content-Transfer-Encoding: base64",
          "",
          // "테스트 이메일입니다" in EUC-KR, base64 encoded
          Buffer.from([
            0xc5, 0xd7, 0xbd, 0xba, 0xc6, 0xae, 0x20,
            0xc0, 0xcc, 0xb8, 0xde, 0xc0, 0xcf, 0xc0, 0xd4, 0xb4, 0xcf, 0xb4, 0xd9,
          ]).toString("base64"),
        ].join("\r\n")
      ),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: hoursAgo(5),
    },
    // Invalid/malformed ASCII email
    {
      key: "invalid-ascii",
      rfc5322: [
        "From: broken@example.com",
        "To: testuser@example.com",
        "Subject: Malformed email test",
        `Date: ${formatRfc2822Date(new Date(now.getTime() - 4 * 3600000))}`,
        "Message-ID: <invalid-001@test>",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=us-ascii",
        "X-Broken-Header: value with \x01\x02 control chars",
        "",
        "This email has some issues.\r\n",
        "It has a line that is way too long: " + "x".repeat(1000) + "\r\n",
        "And some 8-bit chars in ASCII: caf\xe9 na\xefve r\xe9sum\xe9\r\n",
        "End of message.",
      ].join("\r\n"),
      mailboxIds: { [inbox]: true },
      keywords: { $seen: true },
      receivedAt: hoursAgo(4),
    },
  ];

  // Import emails in batches
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await importBatch(ctx, batch);
  }
}

async function importBatch(
  ctx: TestContext,
  batch: Array<{
    key: string;
    rfc5322: string;
    mailboxIds: Record<string, boolean>;
    keywords?: Record<string, boolean>;
    receivedAt: string;
  }>
): Promise<void> {
  const { client, accountId } = ctx;

  // Upload all messages as blobs first
  const blobIds: Record<string, string> = {};
  for (const email of batch) {
    const data = new TextEncoder().encode(email.rfc5322);
    const upload = await client.upload(data, "message/rfc5322");
    blobIds[email.key] = upload.blobId;
  }

  // Build the import request
  const importMap: Record<string, unknown> = {};
  for (const email of batch) {
    importMap[email.key] = {
      blobId: blobIds[email.key],
      mailboxIds: email.mailboxIds,
      keywords: email.keywords ?? {},
      receivedAt: email.receivedAt,
    };
  }

  const result = await client.call("Email/import", {
    accountId,
    emails: importMap,
  });

  const created = result.created as Record<string, { id: string }> | null;
  const notCreated = result.notCreated as Record<
    string,
    { type: string; description?: string }
  > | null;

  for (const email of batch) {
    if (created?.[email.key]) {
      ctx.emailIds[email.key] = created[email.key].id;
    } else if (notCreated?.[email.key]) {
      const err = notCreated[email.key];
      process.stderr.write(
        `  Warning: Failed to import '${email.key}': ${err.type} - ${err.description ?? "no details"}\n`
      );
    }
  }

  if (result.newState) {
    client.updateState("Email", result.newState as string);
  }

  const importedCount = batch.filter((e) => created?.[e.key]).length;
  process.stderr.write(`  Imported ${importedCount}/${batch.length} emails\n`);
}

async function discoverIdentities(ctx: TestContext): Promise<void> {
  const { client, accountId, session } = ctx;

  // Only if the server supports identities
  if (!session.capabilities["urn:ietf:params:jmap:submission"]) {
    return;
  }

  try {
    const result = await client.call("Identity/get", {
      accountId,
      ids: null,
    });
    const list = result.list as Array<{ id: string; email: string }>;
    ctx.identityIds = list.map((i) => i.id);
    if (list.length > 0) {
      ctx.identityEmail = list[0].email;
    }
    process.stderr.write(`  Discovered ${ctx.identityIds.length} identities\n`);

    // Discover secondary email if secondary client is available
    if (ctx.secondaryClient) {
      try {
        const secResult = await ctx.secondaryClient.call("Identity/get", {
          accountId: ctx.secondaryClient.accountId,
          ids: null,
        });
        const secList = secResult.list as Array<{ id: string; email: string }>;
        if (secList.length > 0) {
          ctx.secondaryEmail = secList[0].email;
        }
      } catch {
        // Fall back gracefully
      }
    }
  } catch {
    process.stderr.write("  Warning: Could not fetch identities\n");
  }
}

// --- RFC 5322 Message Builders ---

interface MessageOptions {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  body: string;
  extraHeaders?: string[];
}

function buildMessage(opts: MessageOptions): string {
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
  ];

  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);

  lines.push(`Subject: ${opts.subject || ""}`);
  lines.push(`Date: ${formatRfc2822Date(new Date(opts.date))}`);
  lines.push(`Message-ID: ${opts.messageId}`);

  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);

  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");

  if (opts.extraHeaders) {
    lines.push(...opts.extraHeaders);
  }

  lines.push(""); // blank line separating headers from body
  lines.push(opts.body);

  return lines.join("\r\n");
}

function buildRawMessage(raw: string): string {
  return raw;
}

interface MultipartMixedOptions {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  messageId: string;
  htmlBody: string;
  attachmentBlobId: string;
  attachmentName: string;
  attachmentType: string;
}

function buildMultipartMixed(opts: MultipartMixedOptions): string {
  // For Email/import, we can't reference blobIds in the raw message.
  // Instead, we'll create a self-contained multipart message with a dummy attachment.
  const boundary = "----=_Part_001_" + Date.now();

  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push(`Date: ${formatRfc2822Date(new Date(opts.date))}`);
  lines.push(`Message-ID: ${opts.messageId}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(opts.htmlBody);
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: ${opts.attachmentType}; name="${opts.attachmentName}"`);
  lines.push(`Content-Disposition: attachment; filename="${opts.attachmentName}"`);
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  // A minimal dummy PDF content
  lines.push(
    Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    ).toString("base64")
  );
  lines.push(`--${boundary}--`);

  return lines.join("\r\n");
}

interface MultipartAlternativeOptions {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  textBody: string;
  htmlBody: string;
}

function buildMultipartAlternative(opts: MultipartAlternativeOptions): string {
  const boundary = "----=_Alt_001_" + Date.now();

  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${formatRfc2822Date(new Date(opts.date))}`,
    `Message-ID: ${opts.messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.textBody,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.htmlBody,
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

interface MultipartRelatedOptions {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  htmlBody: string;
  inlineImageBlobId: string;
  inlineImageCid: string;
}

function buildMultipartRelated(opts: MultipartRelatedOptions): string {
  const boundary = "----=_Rel_001_" + Date.now();

  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${formatRfc2822Date(new Date(opts.date))}`,
    `Message-ID: ${opts.messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.htmlBody,
    `--${boundary}`,
    "Content-Type: image/jpeg",
    `Content-ID: <${opts.inlineImageCid}>`,
    "Content-Disposition: inline",
    "Content-Transfer-Encoding: base64",
    "",
    // Minimal JPEG data
    Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]).toString("base64"),
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

function formatRfc2822Date(date: Date): string {
  // Format: "Thu, 01 Jan 2026 00:00:00 +0000"
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const d = days[date.getUTCDay()];
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const m = months[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");

  return `${d}, ${dd} ${m} ${y} ${hh}:${mm}:${ss} +0000`;
}
