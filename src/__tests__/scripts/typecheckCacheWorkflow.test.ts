// @vitest-environment node
import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
it("always checks TypeScript instead of treating cached state as success",()=> {
  const ci=readFileSync(".github/workflows/ci.yml","utf8");
  expect(ci).toContain("bun run typecheck");
  expect(ci).not.toMatch(/--noCheck|--no-check|path: \.cache\/tsc/);
  for(const project of ["app","node"]) {
    const config=readFileSync(`tsconfig.${project}.json`,"utf8");
    expect(config).toContain('"noEmit": true');
    expect(config).toContain(`"tsBuildInfoFile": ".cache/tsc/tsconfig.${project}.tsbuildinfo"`);
  }
});
