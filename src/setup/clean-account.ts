import type { TestContext } from "../runner/test-context.js";

/**
 * Ensure the account is empty. If not empty and force=true, delete everything.
 * If not empty and force=false, throw an error.
 */
export async function cleanAccount(
  ctx: TestContext,
  force: boolean
): Promise<void> {
  const { client, accountId } = ctx;

  // Fetch all mailboxes
  const mbResult = await client.call("Mailbox/get", {
    accountId,
    ids: null,
  });
  const mailboxes = mbResult.list as Array<{
    id: string;
    name: string;
    role: string | null;
    parentId: string | null;
    totalEmails: number;
  }>;

  // Discover role-based mailboxes
  for (const mb of mailboxes) {
    if (mb.role) {
      ctx.roleMailboxes[mb.role] = mb.id;
    }
  }

  // Check for non-role mailboxes (custom folders)
  const customMailboxes = mailboxes.filter((mb) => mb.role === null);

  // Fetch email count
  const emailResult = await client.call("Email/query", {
    accountId,
    limit: 1,
    calculateTotal: true,
  });
  const emailCount = (emailResult.total as number) ?? 0;

  const hasData = customMailboxes.length > 0 || emailCount > 0;

  if (hasData && !force) {
    throw new Error(
      `Account is not empty (${emailCount} emails, ${customMailboxes.length} custom mailboxes). ` +
        `Use -f to force-delete existing data.`
    );
  }

  if (hasData && force) {
    process.stderr.write(
      `Force-cleaning: ${emailCount} emails, ${customMailboxes.length} custom mailboxes\n`
    );
    await forceClean(ctx, mailboxes);
  } else {
    process.stderr.write("Account is clean.\n");
  }
}

async function forceClean(
  ctx: TestContext,
  mailboxes: Array<{
    id: string;
    name: string;
    role: string | null;
    parentId: string | null;
  }>
): Promise<void> {
  const { client, accountId } = ctx;

  // First, destroy all emails in batches
  let hasMore = true;
  while (hasMore) {
    const queryResult = await client.call("Email/query", {
      accountId,
      limit: 50,
    });
    const ids = queryResult.ids as string[];

    if (ids.length === 0) {
      hasMore = false;
      break;
    }

    await client.call("Email/set", {
      accountId,
      destroy: ids,
    });

    process.stderr.write(`  Deleted ${ids.length} emails...\n`);

    if (ids.length < 50) {
      hasMore = false;
    }
  }

  // Destroy custom mailboxes (children first, then parents)
  const customMailboxes = mailboxes.filter((mb) => mb.role === null);

  // Sort so children come before parents
  const sorted = topologicalSort(customMailboxes);

  for (const mb of sorted) {
    try {
      await client.call("Mailbox/set", {
        accountId,
        destroy: [mb.id],
        onDestroyRemoveEmails: true,
      });
      process.stderr.write(`  Deleted mailbox: ${mb.name}\n`);
    } catch {
      // Some servers may not allow destroying certain mailboxes
      process.stderr.write(`  Warning: could not delete mailbox ${mb.name}\n`);
    }
  }
}

/**
 * Sort mailboxes so children appear before their parents.
 */
function topologicalSort(
  mailboxes: Array<{ id: string; name: string; parentId: string | null }>
): Array<{ id: string; name: string; parentId: string | null }> {
  const result: typeof mailboxes = [];
  const remaining = [...mailboxes];

  // Simple approach: keep removing leaves (mailboxes that aren't parents of anyone remaining)
  while (remaining.length > 0) {
    const parentIds = new Set(remaining.map((m) => m.id));
    const leaves = remaining.filter(
      (m) => !parentIds.has(m.id) || !remaining.some((o) => o.parentId === m.id)
    );

    if (leaves.length === 0) {
      // Shouldn't happen, but avoid infinite loop
      result.push(...remaining);
      break;
    }

    for (const leaf of leaves) {
      result.push(leaf);
      const idx = remaining.indexOf(leaf);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  return result;
}
