import type { TestContext } from "../runner/test-context.js";

/**
 * Clean up all test data created during the run.
 */
export async function teardown(ctx: TestContext): Promise<void> {
  const { client, accountId } = ctx;

  // Destroy all emails (query + destroy in batches)
  let hasMore = true;
  let totalDestroyed = 0;
  while (hasMore) {
    const queryResult = await client.call("Email/query", {
      accountId,
      limit: 50,
    });
    const ids = queryResult.ids as string[];

    if (ids.length === 0) break;

    await client.call("Email/set", {
      accountId,
      destroy: ids,
    });

    totalDestroyed += ids.length;
    if (ids.length < 50) hasMore = false;
  }

  if (totalDestroyed > 0) {
    process.stderr.write(`  Destroyed ${totalDestroyed} emails\n`);
  }

  // Destroy custom mailboxes (children first)
  const childMailboxes = ["child1", "child2"];
  const topMailboxes = ["folderA", "folderB"];

  for (const key of childMailboxes) {
    const id = ctx.mailboxIds[key];
    if (id) {
      try {
        await client.call("Mailbox/set", {
          accountId,
          destroy: [id],
          onDestroyRemoveEmails: true,
        });
      } catch {
        // May already be gone
      }
    }
  }

  for (const key of topMailboxes) {
    const id = ctx.mailboxIds[key];
    if (id) {
      try {
        await client.call("Mailbox/set", {
          accountId,
          destroy: [id],
          onDestroyRemoveEmails: true,
        });
      } catch {
        // May already be gone
      }
    }
  }

  const destroyedMb =
    childMailboxes.filter((k) => ctx.mailboxIds[k]).length +
    topMailboxes.filter((k) => ctx.mailboxIds[k]).length;

  if (destroyedMb > 0) {
    process.stderr.write(`  Destroyed ${destroyedMb} mailboxes\n`);
  }

  process.stderr.write("  Teardown complete.\n");
}
