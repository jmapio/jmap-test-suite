import { defineTests } from "../../runner/test-registry.js";
import { hasCapability } from "../../client/session.js";
import type { TestContext } from "../../runner/test-context.js";

const needsVacation = (ctx: TestContext): true | string =>
  hasCapability(ctx.session, "urn:ietf:params:jmap:vacationresponse") ? true : "Server does not support vacationresponse";

defineTests({ rfc: "RFC8621", section: "8.2", category: "vacation" }, [
  {
    id: "set-enable-vacation",
    name: "VacationResponse/set can enable vacation response",
    runIf: needsVacation,
    fn: async (ctx) => {
      // Get current state
      const getResult = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const original = (getResult.list as Array<Record<string, unknown>>)[0];

      // Enable with details
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: {
            isEnabled: true,
            subject: "Out of Office - Test",
            textBody: "I am currently out of the office for testing.",
          },
        },
      });

      // Verify
      const verify = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const vr = (verify.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(vr.isEnabled, true);
      ctx.assertEqual(vr.subject, "Out of Office - Test");

      // Restore
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: {
            isEnabled: original.isEnabled,
            subject: original.subject,
            textBody: original.textBody,
          },
        },
      });
    },
  },
  {
    id: "set-disable-vacation",
    name: "VacationResponse/set can disable vacation response",
    runIf: needsVacation,
    fn: async (ctx) => {
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: { isEnabled: false },
        },
      });

      const verify = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const vr = (verify.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(vr.isEnabled, false);
    },
  },
  {
    id: "set-dates",
    name: "VacationResponse/set can set fromDate and toDate",
    runIf: needsVacation,
    fn: async (ctx) => {
      const fromDate = "2026-03-01T00:00:00Z";
      const toDate = "2026-03-15T00:00:00Z";

      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: { fromDate, toDate },
        },
      });

      const verify = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const vr = (verify.list as Array<Record<string, unknown>>)[0];
      ctx.assertEqual(vr.fromDate, fromDate);
      ctx.assertEqual(vr.toDate, toDate);

      // Clear dates
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: { fromDate: null, toDate: null },
        },
      });
    },
  },
  {
    id: "set-html-body",
    name: "VacationResponse/set can set htmlBody",
    runIf: needsVacation,
    fn: async (ctx) => {
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: {
            htmlBody: "<p>I am out of office.</p>",
          },
        },
      });

      const verify = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const vr = (verify.list as Array<Record<string, unknown>>)[0];
      ctx.assertStringContains(vr.htmlBody as string, "out of office");

      // Clear
      await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        update: {
          singleton: { htmlBody: null },
        },
      });
    },
  },
  {
    id: "set-cannot-create",
    name: "VacationResponse/set rejects create (singleton)",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        create: {
          newVr: { isEnabled: false },
        },
      });
      const notCreated = result.notCreated as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notCreated?.newVr,
        "Should not allow creating new VacationResponse"
      );
      ctx.assertEqual(notCreated!.newVr.type, "singleton");
    },
  },
  {
    id: "set-cannot-destroy",
    name: "VacationResponse/set rejects destroy (singleton)",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/set", {
        accountId: ctx.accountId,
        destroy: ["singleton"],
      });
      const notDestroyed = result.notDestroyed as Record<
        string,
        { type: string }
      > | null;
      ctx.assertTruthy(
        notDestroyed?.singleton,
        "Should not allow destroying VacationResponse singleton"
      );
      ctx.assertEqual(notDestroyed!.singleton.type, "singleton");
    },
  },
]);
