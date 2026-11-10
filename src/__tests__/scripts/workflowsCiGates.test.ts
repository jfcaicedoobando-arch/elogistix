// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const ci=readFileSync(".github/workflows/ci.yml","utf8");
const required={changes:{result:"success",outputs:{database:"false",edge:"false"}},quality:{result:"success"},lint:{result:"success"},tests:{result:"success"},secrets:{result:"success"},database:{result:"skipped"},edge:{result:"skipped"}};
const gate=(jobs:unknown)=>spawnSync(process.execPath,["scripts/ci/result.mjs"],{env:{...process.env,RESULTS:JSON.stringify(jobs)},encoding:"utf8"});
describe("single CI workflow",()=> {
  it("retires every previous wrapper and local action",()=> {
    expect(readdirSync(".github/workflows").filter(name=>/\.ya?ml$/.test(name))).toEqual(["ci.yml"]);
    for(const name of ["setup-bun","setup-pg-client"]) expect(existsSync(`.github/actions/${name}/action.yml`)).toBe(false);
  });
  it("uses read-only credentials and immutable external action references",()=> {
    expect(ci).toContain("contents: read");
    expect(ci).not.toMatch(/(?:contents|actions|pull-requests): write|pull_request_target|secrets\./);
    for(const line of ci.split("\n").filter(line=>line.includes("uses:"))) expect(line).toMatch(/uses: [\w/-]+@[a-f0-9]{40}\s*$/);
    expect(ci).toContain("persist-credentials: false");
    expect(ci).toContain("cancel-in-progress: true");
  });
  it("requires full unit execution with an exact evidence union",()=> {
    expect(ci).toContain("bun run test -- --shard=${{ matrix.shard }}/${{ needs.changes.outputs.shards }}");
    expect(ci).toContain("fail-fast: false");
    expect(ci).toContain("if-no-files-found: error");
    expect(ci).toContain("node scripts/ci/verify-test-evidence.mjs reports/ci-evidence");
    expect(ci).not.toMatch(/continue-on-error|--retry|--passWithNoTests/);
  });
  it("retains output guards and conditional backend validation",()=> {
    for(const command of ["bun run lint -- --max-warnings 0","bun run typecheck","bun run test:dependencies","bun run build","bash scripts/check-bundle-size.sh","bash scripts/check-sourcemaps.sh","bun run test:pdf -- tests/pdf/carteraPagination.test.tsx","bash scripts/db/local-verify.sh --no-behavioral","bash scripts/ci/edge.sh"]) expect(ci).toContain(command);
    expect(ci.indexOf("bun run build")).toBeLessThan(ci.indexOf("bash scripts/check-bundle-size.sh"));
    expect(ci).toContain("if: needs.changes.outputs.database == 'true'");
    expect(ci).toContain("if: needs.changes.outputs.edge == 'true'");
    expect(ci).toContain('CI_REPORT_COMPRESSED_SIZE: "false"');
  });
});
describe("final required check fails closed",()=> {
  it("accepts successful checks and explicitly irrelevant backend jobs",()=>expect(gate(required).status).toBe(0));
  it.each(["changes","quality","lint","tests","secrets"])("rejects a failed, cancelled, missing or skipped %s",name=> {
    for(const result of ["failure","cancelled","skipped",undefined]) expect(gate({...required,[name]:{result}}).status).not.toBe(0);
  });
  it.each(["database","edge"])("requires %s when selected",name=> {
    const selected={...required,changes:{result:"success",outputs:{...required.changes.outputs,[name]:"true"}}};
    expect(gate(selected).status).not.toBe(0);
    expect(gate({...selected,[name]:{result:"success"}}).status).toBe(0);
    expect(gate({...selected,[name]:{result:"cancelled"}}).status).not.toBe(0);
  });
  it("rejects missing or malformed area decisions",()=> {
    for(const value of ["",undefined,"False","unknown"]) expect(gate({...required,changes:{result:"success",outputs:{database:value,edge:"false"}}}).status).not.toBe(0);
  });
});

