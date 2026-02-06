import { defineTests } from "../../runner/test-registry.js";
import { hasCapability } from "../../client/session.js";
import type { TestContext } from "../../runner/test-context.js";

const needsVacation = (ctx: TestContext): true | string =>
  hasCapability(ctx.session, "urn:ietf:params:jmap:vacationresponse") ? true : "Server does not support vacationresponse";

defineTests({ rfc: "RFC8621", section: "8.1", category: "vacation" }, [
  {
    id: "get-singleton",
    name: "VacationResponse/get returns singleton with id='singleton'",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: ["singleton"],
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, "singleton");
    },
  },
  {
    id: "get-singleton-null-ids",
    name: "VacationResponse/get with ids=null returns singleton",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const list = result.list as Array<Record<string, unknown>>;
      ctx.assertLength(list, 1);
      ctx.assertEqual(list[0].id, "singleton");
    },
  },
  {
    id: "get-singleton-properties",
    name: "VacationResponse has all required properties",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: null,
      });
      const vr = (result.list as Array<Record<string, unknown>>)[0];

      ctx.assertEqual(vr.id, "singleton");
      ctx.assertType(vr.isEnabled, "boolean");
      // fromDate, toDate, subject, textBody, htmlBody can be null
      ctx.assert(
        vr.fromDate === null || typeof vr.fromDate === "string",
        "fromDate must be null or string"
      );
      ctx.assert(
        vr.toDate === null || typeof vr.toDate === "string",
        "toDate must be null or string"
      );
      ctx.assert(
        vr.subject === null || typeof vr.subject === "string",
        "subject must be null or string"
      );
      ctx.assert(
        vr.textBody === null || typeof vr.textBody === "string",
        "textBody must be null or string"
      );
      ctx.assert(
        vr.htmlBody === null || typeof vr.htmlBody === "string",
        "htmlBody must be null or string"
      );
    },
  },
  {
    id: "get-not-found-invalid-id",
    name: "VacationResponse/get returns notFound for non-singleton id",
    runIf: needsVacation,
    fn: async (ctx) => {
      const result = await ctx.client.call("VacationResponse/get", {
        accountId: ctx.accountId,
        ids: ["not-singleton"],
      });
      const notFound = result.notFound as string[];
      ctx.assertIncludes(notFound, "not-singleton");
    },
  },
]);
