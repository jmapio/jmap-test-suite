import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "2", category: "core" }, [
  {
    id: "session-has-capabilities",
    name: "Session resource has capabilities object",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.capabilities, "object");
      ctx.assertTruthy(
        Object.keys(ctx.session.capabilities).length > 0,
        "capabilities must not be empty"
      );
    },
  },
  {
    id: "session-has-core-capability",
    name: "Session advertises urn:ietf:params:jmap:core",
    fn: async (ctx) => {
      ctx.assertTruthy(
        ctx.session.capabilities["urn:ietf:params:jmap:core"],
        "Must have core capability"
      );
    },
  },
  {
    id: "session-has-mail-capability",
    name: "Session advertises urn:ietf:params:jmap:mail",
    fn: async (ctx) => {
      ctx.assertTruthy(
        ctx.session.capabilities["urn:ietf:params:jmap:mail"],
        "Must have mail capability"
      );
    },
  },
  {
    id: "session-core-capability-properties",
    name: "Core capability has required properties",
    fn: async (ctx) => {
      const core = ctx.session.capabilities[
        "urn:ietf:params:jmap:core"
      ] as Record<string, unknown>;
      ctx.assertType(core.maxSizeUpload, "number");
      ctx.assertType(core.maxConcurrentUpload, "number");
      ctx.assertType(core.maxSizeRequest, "number");
      ctx.assertType(core.maxConcurrentRequests, "number");
      ctx.assertType(core.maxCallsInRequest, "number");
      ctx.assertType(core.maxObjectsInGet, "number");
      ctx.assertType(core.maxObjectsInSet, "number");
      ctx.assert(
        Array.isArray(core.collationAlgorithms),
        "collationAlgorithms must be an array"
      );
    },
  },
  {
    id: "session-accounts-present",
    name: "Session has accounts object with at least one account",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.accounts, "object");
      ctx.assertGreaterThan(
        Object.keys(ctx.session.accounts).length,
        0,
        "Must have at least one account"
      );
    },
  },
  {
    id: "session-account-properties",
    name: "Account objects have required properties",
    fn: async (ctx) => {
      const account = ctx.session.accounts[ctx.accountId];
      ctx.assertTruthy(account, "Primary account must exist");
      ctx.assertType(account.name, "string");
      ctx.assertType(account.isPersonal, "boolean");
      ctx.assertType(account.isReadOnly, "boolean");
      ctx.assertType(account.accountCapabilities, "object");
    },
  },
  {
    id: "session-primary-accounts",
    name: "Session has primaryAccounts with mail account",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.primaryAccounts, "object");
      const mailAcct =
        ctx.session.primaryAccounts["urn:ietf:params:jmap:mail"];
      ctx.assertTruthy(mailAcct, "Must have primary mail account");
      ctx.assertEqual(mailAcct, ctx.accountId);
    },
  },
  {
    id: "session-username",
    name: "Session has username string",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.username, "string");
      ctx.assertTruthy(ctx.session.username.length > 0, "username must not be empty");
    },
  },
  {
    id: "session-api-url",
    name: "Session has apiUrl string",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.apiUrl, "string");
      ctx.assertTruthy(ctx.session.apiUrl.length > 0);
    },
  },
  {
    id: "session-download-url-template",
    name: "Session downloadUrl contains template variables",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.downloadUrl, "string");
      ctx.assertStringContains(ctx.session.downloadUrl, "{accountId}");
      ctx.assertStringContains(ctx.session.downloadUrl, "{blobId}");
      ctx.assertStringContains(ctx.session.downloadUrl, "{name}");
      ctx.assertStringContains(ctx.session.downloadUrl, "{type}");
    },
  },
  {
    id: "session-upload-url",
    name: "Session has uploadUrl with accountId template",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.uploadUrl, "string");
      ctx.assertStringContains(ctx.session.uploadUrl, "{accountId}");
    },
  },
  {
    id: "session-event-source-url",
    name: "Session has eventSourceUrl",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.eventSourceUrl, "string");
      ctx.assertTruthy(ctx.session.eventSourceUrl.length > 0);
    },
  },
  {
    id: "session-state",
    name: "Session has state string",
    fn: async (ctx) => {
      ctx.assertType(ctx.session.state, "string");
      ctx.assertTruthy(ctx.session.state.length > 0);
    },
  },
  {
    id: "session-account-capabilities-mail",
    name: "Mail account has urn:ietf:params:jmap:mail capability",
    fn: async (ctx) => {
      const account = ctx.session.accounts[ctx.accountId];
      ctx.assertTruthy(
        account.accountCapabilities["urn:ietf:params:jmap:mail"],
        "Account must have mail capability"
      );
    },
  },
  {
    id: "session-mail-capability-properties",
    name: "Mail capability has required properties",
    fn: async (ctx) => {
      const account = ctx.session.accounts[ctx.accountId];
      const mail = account.accountCapabilities[
        "urn:ietf:params:jmap:mail"
      ] as Record<string, unknown>;
      ctx.assertTruthy(mail, "Account must have mail capability object");
      // maxMailboxesPerEmail can be null or UnsignedInt
      ctx.assert(
        mail.maxMailboxesPerEmail === null ||
          typeof mail.maxMailboxesPerEmail === "number",
        "maxMailboxesPerEmail must be null or number"
      );
      ctx.assert(
        mail.maxMailboxDepth === null ||
          typeof mail.maxMailboxDepth === "number",
        "maxMailboxDepth must be null or number"
      );
      ctx.assertType(mail.maxSizeMailboxName, "number");
      ctx.assertType(mail.maxSizeAttachmentsPerEmail, "number");
      ctx.assert(
        Array.isArray(mail.emailQuerySortOptions),
        "emailQuerySortOptions must be an array"
      );
      ctx.assertType(mail.mayCreateTopLevelMailbox, "boolean");
    },
  },
]);
