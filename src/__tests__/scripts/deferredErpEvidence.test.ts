// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { collectEvidence } from "../../../e2e/visual/deferred-erp/collect-evidence.mjs";
import { assertSuccessfulValidation, runValidation } from "../../../e2e/visual/deferred-erp/validation-checks.mjs";
import type { ValidationExecutionResult, ValidationExecutor } from "../../../e2e/visual/deferred-erp/validation-checks.mjs";
import { collectDenoEvidence, verifyDenoEvidence } from "../../../e2e/visual/deferred-erp/deno-evidence.mjs";

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

const denoSuite = "supabase/functions/parse-cfdi-xml/validarNcProveedor_test.ts";
const denoReport = "reports/deferred-erp";
const hashBytes = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const originalDenoNames = [
  "96: conserva la relación del XML y acepta identidad completa coincidente",
  "96: rechaza emisor, receptor, tipo, UUID y relación antes del prefill",
  "96: lecturas aisladas por organización y rechaza duplicados o factura ajena",
];

async function denoFixture() {
  const root = await fixture();
  for (const directory of ["supabase/functions/parse-cfdi-xml", "supabase/functions/_shared", ".github/workflows", "test-results/xml-deno-runtime", denoReport]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  const inputs = [
    { path: denoSuite, content: '// Synthetic consumer fixture, never executed.\nDeno.test("a", () => {});\n' },
    { path: "supabase/functions/_shared/cfdiParser.ts", content: "export const synthetic = true;\n" },
  ];
  for (const input of inputs) await writeFile(join(root, input.path), input.content);
  await writeFile(join(root, ".github/workflows/ci.yml"), "with:\n  deno-version: v2.9.7\n");
  // These bytes are intentionally not an executable. The consumer only hashes
  // the file; unit tests must never launch Deno or download a runtime.
  const executableBytes = "synthetic non-executable Deno consumer fixture\n";
  await writeFile(join(root, "test-results/xml-deno-runtime/deno.exe"), executableBytes);
  const versionOutput = ["deno 2.9.7 (stable, release, x86_64-pc-windows-msvc)", "v8 synthetic", "typescript synthetic"];
  const download = {
    repositoryPinnedVersion: "2.9.7",
    releaseMetadataUrl: "https://api.github.com/repos/denoland/deno/releases/tags/v2.9.7",
    sourceUrl: "https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-pc-windows-msvc.zip",
    officialAssetDigest: "sha256:a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238",
    archiveSha256: "a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238",
    executableSha256: hashBytes(executableBytes), version: versionOutput, versionExitCode: 0,
  };
  await writeFile(join(root, "test-results/xml-deno-runtime/download-provenance.json"), JSON.stringify(download));
  const log = "running 3 tests from original suite\nok | 3 passed | 0 failed (1ms)\n[stderr]\nCheck original suite\n";
  const junit = `<testsuites tests="3" failures="0" errors="0"><testsuite name="./${denoSuite}" tests="3" disabled="0" errors="0" failures="0">${originalDenoNames.map(name => `<testcase name="${name}" classname="./${denoSuite}"></testcase>`).join("")}</testsuite></testsuites>\n`;
  await writeFile(join(root, denoReport, "deno-original.log"), log);
  await writeFile(join(root, denoReport, "deno-original.junit.xml"), junit);
  const sources = inputs.map(({ path, content }) => ({ path, sha256: hashBytes(content) }));
  const proof = {
    schemaVersion: 1, runId: "synthetic-deno-proof", status: "passed", suite: denoSuite,
    startedAt: "2026-10-17T22:00:00.000Z", completedAt: "2026-10-17T22:00:01.000Z",
    command: {
      executable: "test-results/xml-deno-runtime/deno.exe", cwd: ".", shell: false,
      args: ["test", "--no-config", "--no-lock", "--cached-only", "--node-modules-dir=none", "--sanitize-ops", "--sanitize-resources", "--no-prompt", "--check", "--deny-env", "--deny-net", "--deny-read", "--deny-write", "--deny-run", "--deny-ffi", "--deny-sys", `--junit-path=${denoReport}/deno-original.junit.xml`, denoSuite],
    },
    runtime: { version: "2.9.7", versionOutput, versionExitCode: 0, executableSha256: hashBytes(executableBytes) },
    download, exitCode: 0 as number | null, signal: null as string | null, spawnError: null as { message: string } | null,
    counts: { total: 3, passed: 3, failed: 0, skipped: 0 },
    log: { path: `${denoReport}/deno-original.log`, sha256: hashBytes(log), bytes: Buffer.byteLength(log) },
    junit: { path: `${denoReport}/deno-original.junit.xml`, sha256: hashBytes(junit) },
    sourcesBefore: sources, sourcesAfter: structuredClone(sources),
    isolation: { runtimePermissionGrants: [] as string[], loader: "cached-only", typecheck: true, sanitizeOps: true, sanitizeResources: true },
  };
  const save = () => writeFile(join(root, denoReport, "deno-original-results.json"), JSON.stringify(proof, null, 2) + "\n");
  await save();
  return { root, proof, save, output: join(root, fixturePath, "evidence") };
}

type DenoFixture = Awaited<ReturnType<typeof denoFixture>>;

describe("deferred ERP original Deno evidence consumer", () => {
  it("verifies and copies original-suite proof, log and JUnit without executing the fake runtime", async () => {
    const sample = await denoFixture();
    const summary = await collectDenoEvidence(sample);
    expect(summary).toMatchObject({ status: "passed", runtime: "2.9.7", counts: { total: 3, passed: 3, failed: 0, skipped: 0 }, runtimePermissionGrants: [], typecheck: true, loader: "cached-only" });
    expect(summary).not.toHaveProperty("localXmlParser");
    expect(summary).not.toHaveProperty("denoSuiteExecuted");
    const proofBytes = await readFile(join(sample.root, denoReport, "deno-original-results.json"));
    expect(summary.proofSha256).toBe(hashBytes(proofBytes));
    expect(await readFile(join(sample.output, summary.proof))).toEqual(proofBytes);
    expect(hashBytes(await readFile(join(sample.output, summary.log)))).toBe(sample.proof.log.sha256);
    expect(hashBytes(await readFile(join(sample.output, summary.junit)))).toBe(sample.proof.junit.sha256);
  });

  const invalid: { name: string; change: (sample: DenoFixture) => void | Promise<unknown> }[] = [
    { name: "failed status", change: ({ proof }) => { proof.status = "failed"; } },
    { name: "nonzero exit", change: ({ proof }) => { proof.exitCode = 1; } },
    { name: "missing exit", change: ({ proof }) => { proof.exitCode = null; } },
    { name: "termination signal", change: ({ proof }) => { proof.signal = "SIGTERM"; } },
    { name: "spawn error", change: ({ proof }) => { proof.spawnError = { message: "synthetic launch failure" }; } },
    { name: "skipped test", change: ({ proof }) => { proof.counts.skipped = 1; proof.counts.passed = 2; } },
    { name: "wrong runtime", change: ({ proof }) => { proof.runtime.version = "2.5.6"; } },
    { name: "failed version command", change: ({ proof }) => { proof.runtime.versionExitCode = 1; } },
    { name: "unofficial download URL", change: ({ proof }) => { proof.download.sourceUrl = "https://invalid.example/deno.zip"; } },
    { name: "wrong archive integrity", change: ({ proof }) => { proof.download.archiveSha256 = "a".repeat(64); } },
    { name: "changed executable bytes", change: ({ root }) => writeFile(join(root, "test-results/xml-deno-runtime/deno.exe"), "modified synthetic runtime") },
    { name: "wrong original suite", change: ({ proof }) => { proof.suite = "supabase/functions/smoke_test.ts"; } },
    { name: "extra network permission", change: ({ proof }) => { proof.command.args.push("--allow-net"); } },
    { name: "omitted typecheck", change: ({ proof }) => { proof.command.args = proof.command.args.filter(arg => arg !== "--check"); } },
    { name: "missing resource sanitization", change: ({ proof }) => { proof.isolation.sanitizeResources = false; } },
    { name: "changed source", change: ({ root }) => writeFile(join(root, denoSuite), "modified synthetic source") },
    { name: "incomplete source manifest", change: ({ proof }) => { proof.sourcesBefore.pop(); proof.sourcesAfter.pop(); } },
    { name: "source drift during Deno", change: ({ proof }) => { proof.sourcesBefore[0].sha256 = "0".repeat(64); } },
    { name: "changed log", change: ({ root }) => writeFile(join(root, denoReport, "deno-original.log"), "forged PASS") },
    { name: "changed JUnit", change: ({ root }) => writeFile(join(root, denoReport, "deno-original.junit.xml"), "<testsuites/>") },
    { name: "workflow pin drift", change: ({ root }) => writeFile(join(root, ".github/workflows/ci.yml"), "with:\n  deno-version: v2.5.6\n") },
    { name: "different local provenance", change: ({ root }) => writeFile(join(root, "test-results/xml-deno-runtime/download-provenance.json"), "{}") },
    { name: "artifact path substitution", change: ({ proof }) => { proof.log.path = "../outside.log"; } },
  ];
  it.each(invalid)("rejects $name before copying a passing proof", async ({ change }) => {
    const sample = await denoFixture();
    await change(sample);
    await sample.save();
    await expect(collectDenoEvidence(sample)).rejects.toThrow(/Deno evidence:/);
    await expect(readFile(join(sample.output, "deno-original-results.json"))).rejects.toThrow(/ENOENT/);
  });

  it("recounts actual JUnit failures even when its hash and claimed counts look valid", async () => {
    const sample = await denoFixture();
    const path = join(sample.root, denoReport, "deno-original.junit.xml");
    const junit = (await readFile(path, "utf8")).replace('</testcase>', '<failure message="synthetic failure"/></testcase>');
    await writeFile(path, junit);
    sample.proof.junit.sha256 = hashBytes(junit);
    await sample.save();
    await expect(verifyDenoEvidence(sample.root)).rejects.toThrow(/JUnit actual test results/);
  });

  it.each([
    { name: "comment-only test cases", change: (xml: string) => xml.replace(/(<testsuite\b[^>]*>)([\s\S]*?)(<\/testsuite>)/, "$1<!--$2-->$3") },
    { name: "CDATA-only test cases", change: (xml: string) => xml.replace(/(<testsuite\b[^>]*>)([\s\S]*?)(<\/testsuite>)/, "$1<![CDATA[$2]]>$3") },
    { name: "malformed XML", change: (xml: string) => xml.replace("</testcase>", "") },
    { name: "duplicate original test names", change: (xml: string) => xml.replace(originalDenoNames[1], originalDenoNames[0]) },
    { name: "wrong testcase classname", change: (xml: string) => xml.replace(`classname="./${denoSuite}"`, 'classname="./supabase/functions/other_test.ts"') },
    { name: "external DOCTYPE", change: (xml: string) => '<!DOCTYPE testsuites SYSTEM "https://invalid.example/never-load.dtd">' + xml },
  ])("rejects $name even with matching proof hashes and three claimed passes", async ({ change }) => {
    const sample = await denoFixture();
    const path = join(sample.root, denoReport, "deno-original.junit.xml");
    const junit = change(await readFile(path, "utf8"));
    await writeFile(path, junit);
    sample.proof.junit.sha256 = hashBytes(junit);
    await sample.save();
    await expect(collectDenoEvidence(sample)).rejects.toThrow(/Deno evidence: JUnit/);
    await expect(readFile(join(sample.output, "deno-original-results.json"))).rejects.toThrow(/ENOENT/);
  });

  it.each(["deno-original-results.json", "deno-original.log", "deno-original.junit.xml"])("requires the real %s artifact", async file => {
    const sample = await denoFixture();
    await rm(join(sample.root, denoReport, file));
    await expect(verifyDenoEvidence(sample.root)).rejects.toThrow(/ENOENT/);
  });

  it("makes the collector fail closed when Deno proof is absent despite passing local report counts", async () => {
    const root = await fixture();
    await mkdir(join(root, denoReport), { recursive: true });
    await writeFile(join(root, denoReport, "results.json"), JSON.stringify({ stats: { expected: 26, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] }));
    await writeFile(join(root, denoReport, "unit-results.json"), JSON.stringify({ success: true, numPassedTests: 100, numFailedTests: 0, numPendingTests: 0 }));
    await mkdir(join(root, "test-results"), { recursive: true });
    await writeFile(join(root, "test-results/xml-parser-local.json"), JSON.stringify({ assertions: Array.from({ length: 22 }, () => ({ passed: true })), denoSuiteExecuted: false, networkAttempts: [] }));
    await expect(collectEvidence({ root, execute: () => ({ ...passed }) })).rejects.toThrow(/ENOENT/);
    const summary = await readJson(root, `${fixturePath}/evidence/summary.json`);
    expect(summary.status).toBe("failed");
    expect(summary).not.toHaveProperty("originalDenoSuite");
  });
});
