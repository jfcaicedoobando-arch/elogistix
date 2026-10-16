import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const fixtures = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function runScript(script, args = [], failTool) {
  const fixture = mkdtempSync(join(tmpdir(), "elogistix-package-scripts-"));
  fixtures.push(fixture);
  const bin = join(fixture, "node_modules/.bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ scripts }));
  const log = join(fixture, "calls.jsonl");
  for (const tool of ["eslint", "knip", "tsc", "vitest", "vite"]) {
    const executable = join(bin, tool);
    writeFileSync(executable, `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.SCRIPT_CALL_LOG, JSON.stringify({tool: ${JSON.stringify(tool)}, args: process.argv.slice(2)}) + "\\n");
process.exit(process.env.SCRIPT_FAIL_TOOL === ${JSON.stringify(tool)} ? 7 : 0);
`);
    chmodSync(executable, 0o755);
  }
  const result = spawnSync("bun", ["run", script, ...args], {
    cwd: fixture,
    env: { ...process.env, SCRIPT_CALL_LOG: log, SCRIPT_FAIL_TOOL: failTool ?? "" },
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    calls: readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)),
    stderr: result.stderr,
  };
}

describe("package script execution contracts", () => {
  it("test:ci runs tests in a clean checkout and forwards the requested shard without coverage", () => {
    const result = runScript("test:ci", ["--", "--shard=2/14"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, [{ tool: "vitest", args: ["run", "--shard=2/14"] }]);
  });

  it("keeps the merge-only coverage command explicit", () => {
    const result = runScript("test:coverage:merge");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, [{
      tool: "vitest", args: ["run", "--merge-reports=.vitest-reports", "--coverage"],
    }]);
  });

  it("ci:local enforces zero lint warnings and typechecks before testing and building", () => {
    const result = runScript("ci:local");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, [
      { tool: "eslint", args: [".", "--cache", "--cache-location", ".cache/eslint/", "--cache-strategy", "content", "--max-warnings=0"] },
      { tool: "tsc", args: ["-b"] },
      { tool: "knip", args: ["--no-progress"] },
      { tool: "vitest", args: ["run"] },
      { tool: "vite", args: ["build"] },
    ]);
  });

  it("ci:local stops on type errors instead of running tests and a build", () => {
    const result = runScript("ci:local", [], "tsc");
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls.map(({ tool }) => tool), ["eslint", "tsc"]);
  });
});
