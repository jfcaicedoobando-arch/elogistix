// @vitest-environment node
import { describe, expect, it } from "vitest";
import { classifyFiles } from "../../../scripts/ci/test-catalog.mjs";

const demo = "e2e/visual/dependency-audit/specs/demo.spec.ts";
const guards = ["supabase/tests/guard.sql"];
const support = { "supabase/tests/helper.sql": "Synthetic support fixture" };
// The classifier requires one representative of every mandatory execution lane.
const files = [
  "src/unit.test.ts", "src/benchmark.perf.ts", ...guards, ...Object.keys(support),
  "supabase/tests/rls/test_rls_fixture.sql",
  "supabase/functions/fixture/index_test.ts", "supabase/functions/fixture/smoke_test.ts",
  "tests/pdf/carteraPagination.test.tsx", "e2e/specs/example.spec.ts",
  "e2e/visual/audit119-126/specs/dialog-card.spec.ts",
  "e2e/visual/specs/shared-ui.spec.ts",
];

describe("dependency audit execution lane", () => {
  it("registers the exact demo spec for automatic isolated execution", () => {
    const entries = classifyFiles([...files, demo], guards, support);
    expect(entries.find(entry => entry.path === demo)).toEqual({
      path: demo, lane: "playwright-isolated", mode: "automatic",
    });
  });

  it.each([
    "e2e/visual/dependency-audit/specs/unregistered.spec.ts",
    "e2e/visual/dependency-audit/specs/nested/demo.spec.ts",
    "e2e/visual/dependency-audit/specs/demo.spec.tsx",
    "e2e/visual/dependency-audit-other/specs/demo.spec.ts",
  ])("still rejects an unregistered neighboring test: %s", extra => {
    expect(() => classifyFiles([...files, demo, extra], guards, support))
      .toThrow(`Test has no execution lane: ${extra}`);
  });
});
