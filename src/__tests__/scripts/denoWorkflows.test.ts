import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflows = ["ci.yml", "post-deploy-smoke.yml"];

function readWorkflow(name: string): string {
  return readFileSync(resolve(process.cwd(), ".github/workflows", name), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("Deno workflows · runtime compatible y sanitizers explícitos", () => {
  it.each(workflows)("%s fija la misma versión estable, sin rango flotante", (name) => {
    const workflow = readWorkflow(name);
    expect(workflow).toMatch(/^\s+deno-version: v2\.9\.7$/m);
  });

  it.each(workflows)("%s mantiene detección de fugas y typecheck", (name) => {
    const workflow = readWorkflow(name);
    const command = workflow.match(/^\s+deno test \\\n(?:\s+--[^\n]+\n)+/m)?.[0];
    expect(command).toBeDefined();
    expect(command).toMatch(/^\s+--sanitize-ops \\$/m);
    expect(command).toMatch(/^\s+--sanitize-resources \\$/m);
    expect(command).toContain("--node-modules-dir=none");
    expect(command).not.toContain("--no-check");
    expect(command).not.toContain("--no-sanitize");
  });
});
