import type { TestContext } from "./test-context.js";

export interface TestDescriptor {
  testId: string;
  name: string;
  rfc: string;
  section: string;
  category: string;
  required: boolean;
  runIf?: (ctx: TestContext) => true | string;
  fn: (ctx: TestContext) => Promise<void>;
}

const tests: TestDescriptor[] = [];

/**
 * Register a test. Called by test files at import time.
 */
export function registerTest(descriptor: TestDescriptor): void {
  tests.push(descriptor);
}

/**
 * Register multiple tests at once.
 */
export function registerTests(descriptors: TestDescriptor[]): void {
  tests.push(...descriptors);
}

/**
 * Helper to create and register tests for a category.
 */
export function defineTests(
  defaults: {
    rfc: string;
    section: string;
    category: string;
  },
  defs: Array<{
    id: string;
    name: string;
    section?: string;
    required?: boolean;
    runIf?: (ctx: TestContext) => true | string;
    fn: (ctx: TestContext) => Promise<void>;
  }>
): void {
  for (const def of defs) {
    tests.push({
      testId: `${defaults.category}/${def.id}`,
      name: def.name,
      rfc: defaults.rfc,
      section: def.section ?? defaults.section,
      category: defaults.category,
      required: def.required ?? true,
      runIf: def.runIf,
      fn: def.fn,
    });
  }
}

/**
 * Get all registered tests, optionally filtered.
 */
export function getTests(options?: {
  filter?: string;
  skipCategories?: string[];
}): TestDescriptor[] {
  let result = [...tests];

  if (options?.skipCategories?.length) {
    result = result.filter(
      (t) => !options.skipCategories!.includes(t.category)
    );
  }

  if (options?.filter) {
    const patterns = options.filter.split(",").map((p) => globToRegex(p.trim()));
    result = result.filter((t) =>
      patterns.some((p) => p.test(t.testId))
    );
  }

  return result;
}

function globToRegex(glob: string): RegExp {
  // If no glob metacharacters, treat as substring match
  if (!glob.includes("*") && !glob.includes("?")) {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped);
  }
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
