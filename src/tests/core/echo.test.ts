import { defineTests } from "../../runner/test-registry.js";

defineTests({ rfc: "RFC8620", section: "4", category: "core" }, [
  {
    id: "echo-basic",
    name: "Core/echo returns same arguments",
    fn: async (ctx) => {
      const args = { hello: "world", number: 42 };
      const result = await ctx.client.call("Core/echo", args);
      ctx.assertEqual(result.hello, "world");
      ctx.assertEqual(result.number, 42);
    },
  },
  {
    id: "echo-empty",
    name: "Core/echo with empty arguments",
    fn: async (ctx) => {
      const result = await ctx.client.call("Core/echo", {});
      ctx.assertDeepEqual(result, {});
    },
  },
  {
    id: "echo-nested",
    name: "Core/echo with nested complex arguments",
    fn: async (ctx) => {
      const args = {
        string: "test",
        number: 42,
        bool: true,
        null: null,
        array: [1, "two", false],
        object: { nested: { deep: "value" } },
      };
      const result = await ctx.client.call("Core/echo", args);
      ctx.assertDeepEqual(result, args);
    },
  },
]);
