// @vitest-environment node
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const ci=readFileSync(".github/workflows/ci.yml","utf8");
const edge=readFileSync("scripts/ci/edge.sh","utf8");
describe("Edge runtime and checks",()=>{
  it("pins the Deno CLI in the active workflow",()=>{
    expect(ci).toMatch(/^\s+deno-version: v2\.9\.8$/m);
    expect(ci).toContain("run: bash scripts/ci/edge.sh");
  });
  it("typechecks original adapters and tests without suppression",()=>{
    expect(edge).toContain("deno check --node-modules-dir=none supabase/functions/demo-access/index.ts");
    expect(edge).toContain("bash scripts/check-edge-entrypoints.sh");
    expect(edge).toContain("deno test");
    expect(edge).toContain("--sanitize-ops");
    expect(edge).toContain("--sanitize-resources");
    expect(edge).toContain("--node-modules-dir=none");
    expect(edge).not.toMatch(/--no-check|--no-sanitize|--unsafely-ignore/);
  });
  it("isolates Edge test dependencies and rejects empty discovery",()=>{
    const isolate=edge.indexOf("export DENO_NO_PACKAGE_JSON='1'");
    expect(isolate).toBeGreaterThan(0);
    expect(isolate).toBeLessThan(edge.indexOf("deno test"));
    expect(edge).toContain('if [ "${#tests[@]}" -eq 0 ]');
    expect(edge).toContain("exit 1");
  });
});
