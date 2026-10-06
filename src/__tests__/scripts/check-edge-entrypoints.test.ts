import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const bashAvailable = spawnSync("bash", ["--version"]).status === 0;
describe.skipIf(!bashAvailable)("all Edge entrypoints are checked", () => {
  it("includes an adapter without tests and propagates a failed typecheck", () => {
    const root = mkdtempSync(join(tmpdir(), "edge-inventory-"));
    roots.push(root);
    for (const name of ["tested", "untested"]) {
      mkdirSync(join(root, "supabase/functions", name), { recursive: true });
      writeFileSync(join(root, "supabase/functions", name, "index.ts"), "export const value: string = 1;");
    }
    const bin = join(root, "bin");
    mkdirSync(bin);
    const recorded = join(root, "args");
    writeFileSync(join(bin, "deno"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$RECORDED"\nexit 7\n', { mode: 0o755 });
    const result = spawnSync("bash", [join(process.cwd(), "scripts/check-edge-entrypoints.sh")], {
      cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RECORDED: recorded }, encoding: "utf8",
    });
    expect(result.status).toBe(7);
    expect(readFileSync(recorded, "utf8").split("\n")).toContain("supabase/functions/untested/index.ts");
    expect(result.stdout).toContain("Checking 2 Edge entrypoints");
  });
});
