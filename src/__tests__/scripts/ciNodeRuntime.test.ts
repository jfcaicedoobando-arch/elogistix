// @vitest-environment node
import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
const read=(file:string)=>readFileSync(file,"utf8");
it("selects runtimes from the same version files used by developers",()=> {
  const pkg=JSON.parse(read("package.json"));
  expect(read(".node-version").trim()).toBe(pkg.engines.node);
  expect(read(".nvmrc").trim()).toBe(pkg.engines.node);
  expect(read(".bun-version").trim()).toBe(pkg.engines.bun);
  const ci=read(".github/workflows/ci.yml");
  expect(ci).toContain("node-version-file: .node-version");
  expect(ci).toContain("bun-version-file: .bun-version");
  expect(ci).toContain("package-manager-cache: false");
  expect(read("scripts/ci/install.sh")).toContain("assert.equal(process.versions.node, pkg.engines.node)");
});
it("verifies the frozen lockfile on cache hits and misses",()=> {
  const script=read("scripts/ci/install.sh");
  expect(script).toContain("bun install --frozen-lockfile --ignore-scripts");
  expect(script).toContain('test "$before" = "$(sha256sum bun.lock)"');
  const ci=read(".github/workflows/ci.yml");
  expect(ci).toContain("hashFiles('.node-version','.bun-version','package.json','bun.lock')");
  expect(ci).not.toContain("if: steps.deps.outputs.cache-hit");
});
