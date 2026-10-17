// @vitest-environment node
import { describe, expect, it } from "vitest";
import { classifyFiles } from "../../../scripts/ci/test-catalog.mjs";

const specs = [
  "e2e/visual/deferred-erp/specs/correo.spec.ts",
  "e2e/visual/deferred-erp/specs/crm.spec.ts",
  "e2e/visual/deferred-erp/specs/xml.spec.ts",
];
const guards = ["supabase/tests/guard.sql"];
const support = { "supabase/tests/helper.sql": "Synthetic support fixture" };
const files = [
  "src/unit.test.ts", "src/benchmark.perf.ts", ...guards, ...Object.keys(support),
  "supabase/tests/rls/test_rls_fixture.sql",
  "supabase/functions/fixture/index_test.ts", "supabase/functions/fixture/smoke_test.ts",
  "tests/pdf/carteraPagination.test.tsx", "e2e/specs/example.spec.ts",
  "e2e/visual/audit119-126/specs/dialog-card.spec.ts",
  "e2e/visual/specs/shared-ui.spec.ts",
];

describe("deferred ERP catalog registration", () => {
  it("registers all three exact specs as manual, without claiming automatic CI execution", () => {
    const entries = classifyFiles([...files, ...specs], guards, support);
    expect(entries.filter(entry => specs.includes(entry.path))).toEqual(specs.map(path => ({
      path, lane: "playwright-isolated", mode: "manual",
    })));
    expect(entries.find(entry => entry.path === "e2e/visual/audit119-126/specs/dialog-card.spec.ts"))
      .toEqual({ path: "e2e/visual/audit119-126/specs/dialog-card.spec.ts", lane: "playwright-isolated", mode: "automatic" });
  });

  it.each([
    "e2e/visual/deferred-erp/specs/unregistered.spec.ts",
    "e2e/visual/deferred-erp/specs/nested/correo.spec.ts",
    "e2e/visual/deferred-erp/specs/correo.spec.tsx",
    "e2e/visual/deferred-erp-other/specs/crm.spec.ts",
    "e2e/visual/future-suite/specs/xml.spec.ts",
  ])("still rejects unregistered or renamed neighbors: %s", extra => {
    expect(() => classifyFiles([...files, ...specs, extra], guards, support))
      .toThrow(`Test has no execution lane: ${extra}`);
  });
});
