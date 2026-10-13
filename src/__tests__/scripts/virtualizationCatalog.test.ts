// @vitest-environment node
import { describe, expect, it } from "vitest";
import { classifyFiles } from "../../../scripts/ci/test-catalog.mjs";

const virtualization = "e2e/visual/virtualization/specs/virtualization.spec.ts";
const guards = ["supabase/tests/guard.sql"];
const support = { "supabase/tests/helper.sql": "Synthetic support fixture" };
// One representative per mandatory lane keeps this classifier test independent
// of Git checkout state, credentials, databases and browser execution.
const files = [
  "src/unit.test.ts", "src/benchmark.perf.ts", ...guards, ...Object.keys(support),
  "supabase/tests/rls/test_rls_fixture.sql",
  "supabase/functions/fixture/index_test.ts", "supabase/functions/fixture/smoke_test.ts",
  "tests/pdf/carteraPagination.test.tsx", "e2e/specs/example.spec.ts",
  "e2e/visual/audit119-126/specs/dialog-card.spec.ts",
  "e2e/visual/audit136-137/specs/filters.spec.ts",
  "e2e/visual/specs/shared-ui.spec.ts",
];

describe("virtualization execution lane", () => {
  it("registers the exact PR-automatic spec while preserving the existing isolated suites", () => {
    const entries = classifyFiles([...files, virtualization], guards, support);
    expect(entries.filter(entry => entry.lane === "playwright-isolated")).toEqual([
      { path: "e2e/visual/audit119-126/specs/dialog-card.spec.ts", lane: "playwright-isolated", mode: "automatic" },
      { path: "e2e/visual/audit136-137/specs/filters.spec.ts", lane: "playwright-isolated", mode: "automatic" },
      { path: virtualization, lane: "playwright-isolated", mode: "automatic" },
    ]);
  });

  it.each([
    "e2e/visual/virtualization/specs/unregistered.spec.ts",
    "e2e/visual/virtualization/specs/nested/virtualization.spec.ts",
    "e2e/visual/virtualization/specs/virtualization.spec.tsx",
    "e2e/visual/virtualization-other/specs/virtualization.spec.ts",
    "e2e/visual/future-suite/specs/new.spec.ts",
  ])("still rejects an unregistered test: %s", extra => {
    expect(() => classifyFiles([...files, virtualization, extra], guards, support))
      .toThrow(`Test has no execution lane: ${extra}`);
  });
});
