// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { collectEvidence } from "../../../e2e/visual/deferred-erp/collect-evidence.mjs";
import { assertSuccessfulValidation, runValidation } from "../../../e2e/visual/deferred-erp/validation-checks.mjs";
import type { ValidationExecutionResult, ValidationExecutor } from "../../../e2e/visual/deferred-erp/validation-checks.mjs";

const directories: string[] = [];
const temporaryRoot = resolve("test-results/temp");
const fixturePath = "e2e/visual/deferred-erp";
const passed = { status: 0, signal: null, stdout: "fresh compiler output", stderr: "" };
const readJson = async (root: string, file: string) => JSON.parse(await readFile(join(root, file), "utf8"));

async function fixture() {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(join(temporaryRoot, "deferred-evidence-"));
  directories.push(root);
  for (const directory of ["src", "scripts", fixturePath]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, "src/component.ts"), "export const synthetic = true;\n");
  await writeFile(join(root, fixturePath, "fixture.ts"), "export const isolated = true;\n");
  await writeFile(join(root, "package.json"), '{"private":true}\n');
  return root;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    // Only remove the exact temporary fixture created inside this workspace.
    if (!resolve(directory).startsWith(temporaryRoot + sep)) throw new Error("Temporary fixture escaped the workspace");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("deferred ERP fresh evidence checks", () => {
  it("runs the three exact local commands without a shell, backend environment or cached logs", async () => {
    const root = await fixture();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-must-not-pass");
    vi.stubEnv("VITE_SUPABASE_URL", "https://invalid.example");
    vi.stubEnv("NODE_OPTIONS", "--require synthetic-must-not-load");
    const execute = vi.fn<ValidationExecutor>(() => ({ ...passed }));
    const proof = await runValidation({ root, runId: "fresh-run", execute });
    expect(execute.mock.calls.map(([executable, args]) => [executable, args])).toEqual([
      [process.execPath, ["node_modules/typescript/bin/tsc", "-p", `${fixturePath}/tsconfig.json`]],
      [process.execPath, ["node_modules/eslint/bin/eslint.js", "--no-cache", fixturePath]],
      [process.execPath, ["node_modules/vite/bin/vite.js", "build", "--config", `${fixturePath}/vite.config.ts`]],
    ]);
    for (const [, , options] of execute.mock.calls) {
      expect(options).toMatchObject({ cwd: root, shell: false, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
      expect(options.env).toMatchObject({ TEMP: join(root, "test-results/temp"), TMP: join(root, "test-results/temp"), TMPDIR: join(root, "test-results/temp") });
      expect(options.env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
      expect(options.env).not.toHaveProperty("VITE_SUPABASE_URL");
      expect(options.env).not.toHaveProperty("NODE_OPTIONS");
    }
    expect(proof).toMatchObject({ runId: "fresh-run", status: "passed", commands: Array(3).fill(expect.objectContaining({ exitCode: 0, signal: null, spawnError: null })) });
    expect(proof.sourceBefore).toEqual(proof.sourceAfter);
    expect(proof.sourceBefore?.fileCount).toBe(3);
    expect(Date.parse(proof.startedAt)).toBeLessThanOrEqual(Date.parse(proof.completedAt!));
    for (const command of proof.commands) {
      const log = await readFile(join(root, command.log.path));
      expect(command.log.sha256).toBe(createHash("sha256").update(log).digest("hex"));
      expect(command.log.bytes).toBe(log.length);
      expect(command.startedAt).toBeTruthy();
      expect(command.completedAt).toBeTruthy();
    }
    expect(await readJson(root, "reports/deferred-erp/validation-results.json")).toEqual(proof);
  });

  it.each([
    ["nonzero", { ...passed, status: 1 }],
    ["null exit status", { ...passed, status: null }],
    ["missing exit status", { signal: null, stdout: "old PASS" }],
    ["missing result", undefined],
    ["terminated process", { ...passed, signal: "SIGTERM" }],
    ["spawn error", { ...passed, error: new Error("synthetic spawn failure") }],
  ] satisfies [string, ValidationExecutionResult | undefined][])("fails closed for %s and replaces a stale PASS summary", async (_name, result) => {
    const root = await fixture();
    const output = join(root, fixturePath, "evidence");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "summary.json"), JSON.stringify({ status: "passed", runId: "stale-run", validation: { typecheck: "passed" } }));
    await mkdir(join(root, "reports/deferred-erp"), { recursive: true });
    await writeFile(join(root, "reports/deferred-erp/typecheck.log"), "old PASS log must not certify this run");
    const execute = vi.fn<ValidationExecutor>(() => result);
    await expect(collectEvidence({ root, execute })).rejects.toThrow(/Fresh validation failed/);
    expect(execute).toHaveBeenCalledTimes(1);
    const summary = await readJson(root, `${fixturePath}/evidence/summary.json`);
    expect(summary.status).toBe("failed");
    expect(summary.runId).not.toBe("stale-run");
    expect(summary).not.toHaveProperty("validation.typecheck", "passed");
    const proof = await readJson(root, `${fixturePath}/evidence/validation-results.json`);
    expect(proof.status).toBe("failed");
    expect(proof.runId).toBe(summary.runId);
    expect(proof.commands).toHaveLength(1);
    expect(await readFile(join(root, "reports/deferred-erp/typecheck.log"), "utf8")).not.toContain("old PASS log");
  });

  it("invalidates the previous summary before invoking a fresh process and records a thrown executor error", async () => {
    const root = await fixture();
    const output = join(root, fixturePath, "evidence");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "summary.json"), '{"status":"passed"}');
    let observed: unknown;
    const execute: ValidationExecutor = () => {
      observed = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
      throw new Error("synthetic launch error");
    };
    await expect(collectEvidence({ root, execute })).rejects.toThrow(/synthetic launch error/);
    expect(observed).toMatchObject({ status: "running" });
    const proof = await readJson(root, `${fixturePath}/evidence/validation-results.json`);
    expect(proof.commands[0]).toMatchObject({ exitCode: null, spawnError: { message: "synthetic launch error" } });
    expect(await readJson(root, `${fixturePath}/evidence/summary.json`)).toMatchObject({ status: "failed" });
  });

  it("rejects source drift after successful checks and never publishes a passing summary", async () => {
    const root = await fixture();
    let mutation: Promise<void> | undefined;
    const execute = vi.fn<ValidationExecutor>(() => {
      mutation = writeFile(join(root, "src/component.ts"), "export const synthetic = false;\n");
      return { ...passed };
    });
    await expect(collectEvidence({ root, execute })).rejects.toThrow(/Validation source drift/);
    await mutation;
    expect(execute).toHaveBeenCalledTimes(3);
    expect(await readJson(root, `${fixturePath}/evidence/summary.json`)).toMatchObject({ status: "failed" });
    const proof = await readJson(root, `${fixturePath}/evidence/validation-results.json`);
    expect(proof.status).toBe("failed");
    expect(proof.sourceBefore.digest).not.toBe(proof.sourceAfter.digest);
  });

  it.each([2, 3])("stops on failed command %i after earlier checks passed", async failedCommand => {
    const root = await fixture();
    let calls = 0;
    const execute = vi.fn<ValidationExecutor>(() => ({ ...passed, status: ++calls === failedCommand ? 1 : 0 }));
    await expect(collectEvidence({ root, execute })).rejects.toThrow(/Fresh validation failed/);
    expect(execute).toHaveBeenCalledTimes(failedCommand);
    expect(await readJson(root, `${fixturePath}/evidence/summary.json`)).toMatchObject({ status: "failed" });
    const proof = await readJson(root, `${fixturePath}/evidence/validation-results.json`);
    expect(proof.commands.map((command: { exitCode: number }) => command.exitCode)).toEqual([...Array(failedCommand - 1).fill(0), 1]);
  });

  it("does not publish PASS when fresh checks pass but GUI reports are missing", async () => {
    const root = await fixture();
    const execute = vi.fn<ValidationExecutor>(() => ({ ...passed }));
    await expect(collectEvidence({ root, execute })).rejects.toThrow(/ENOENT/);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(await readJson(root, `${fixturePath}/evidence/summary.json`)).toMatchObject({ status: "failed" });
  });

  it("rejects incomplete command records rather than treating a missing signal or error as successful", () => {
    expect(() => assertSuccessfulValidation()).toThrow(/Fresh validation failed/);
    expect(() => assertSuccessfulValidation({ name: "typecheck", exitCode: 0 } as Parameters<typeof assertSuccessfulValidation>[0])).toThrow(/Fresh validation failed/);
  });
});
