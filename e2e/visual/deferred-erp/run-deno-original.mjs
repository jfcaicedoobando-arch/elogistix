import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const report = "reports/deferred-erp";
const suite = "supabase/functions/parse-cfdi-xml/validarNcProveedor_test.ts";
const executable = "test-results/xml-deno-runtime/deno.exe";
const sha256 = value => createHash("sha256").update(value).digest("hex");
const normalizeLog = value => value.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "");
const args = [
  "test", "--no-config", "--no-lock", "--cached-only", "--node-modules-dir=none",
  "--sanitize-ops", "--sanitize-resources", "--no-prompt", "--check",
  "--deny-env", "--deny-net", "--deny-read", "--deny-write", "--deny-run", "--deny-ffi", "--deny-sys",
  `--junit-path=${report}/deno-original.junit.xml`, suite,
];

async function sources() {
  const files = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push({ path: relative(root, path).replaceAll("\\", "/"), sha256: sha256(await readFile(path)) });
      else throw new Error("Unexpected Deno source input");
    }
  }
  for (const directory of ["supabase/functions/parse-cfdi-xml", "supabase/functions/_shared"]) await visit(join(root, directory));
  return files;
}

await mkdir(join(root, report), { recursive: true });
await mkdir(join(root, "test-results/temp"), { recursive: true });
const download = JSON.parse(await readFile(join(root, "test-results/xml-deno-runtime/download-provenance.json"), "utf8"));
const pinnedWorkflow = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
if (!/^\s+deno-version: v2\.9\.7\s*$/m.test(pinnedWorkflow) || download.repositoryPinnedVersion !== "2.9.7") throw new Error("Repository Deno pin drift");
const executableSha256 = sha256(await readFile(join(root, executable)));
if (executableSha256 !== download.executableSha256 || download.officialAssetDigest !== `sha256:${download.archiveSha256}`) throw new Error("Deno download integrity mismatch");
const allowed = /^(?:path|systemroot|windir|comspec|pathext|number_of_processors|processor_architecture|os)$/i;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
Object.assign(env, {
  DENO_DIR: join(root, "test-results/xml-deno-cache"), DENO_NO_UPDATE_CHECK: "1", DENO_NO_PACKAGE_JSON: "1",
  NO_COLOR: "1", TEMP: join(root, "test-results/temp"), TMP: join(root, "test-results/temp"), TMPDIR: join(root, "test-results/temp"),
});
const launch = commandArgs => spawnSync(join(root, executable), commandArgs, { cwd: root, env, shell: false, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
const versionResult = launch(["--version"]);
if (versionResult.status !== 0 || versionResult.signal || versionResult.error || !/^deno 2\.9\.7 /m.test(versionResult.stdout)) throw new Error("Pinned Deno executable did not report version 2.9.7");
const before = await sources();
const startedAt = new Date().toISOString();
const result = launch(args);
const completedAt = new Date().toISOString();
const after = await sources();
const log = normalizeLog(`${result.stdout ?? ""}\n[stderr]\n${result.stderr ?? ""}`);
const logPath = `${report}/deno-original.log`;
await writeFile(join(root, logPath), log);
let junit = null;
let counts = null;
try {
  const bytes = await readFile(join(root, `${report}/deno-original.junit.xml`));
  const xml = bytes.toString("utf8");
  junit = { path: `${report}/deno-original.junit.xml`, sha256: sha256(bytes) };
  counts = { total: [...xml.matchAll(/<testcase\b/g)].length, failed: [...xml.matchAll(/<(?:failure|error)\b/g)].length, skipped: [...xml.matchAll(/<skipped\b/g)].length };
  counts.passed = counts.total - counts.failed - counts.skipped;
} catch { /* A missing JUnit report must fail closed below. */ }
const passed = result.status === 0 && result.signal === null && !result.error && counts?.total === 3 && counts.passed === 3
  && counts.failed === 0 && counts.skipped === 0 && JSON.stringify(before) === JSON.stringify(after);
const proof = {
  schemaVersion: 1, runId: randomUUID(), status: passed ? "passed" : "failed", suite,
  startedAt, completedAt, command: { executable, args, cwd: ".", shell: false },
  runtime: { version: "2.9.7", versionOutput: versionResult.stdout.trim().split(/\r?\n/), versionExitCode: versionResult.status, executableSha256 },
  download, exitCode: result.status, signal: result.signal, spawnError: result.error ? { message: result.error.message, code: result.error.code ?? null } : null,
  counts, log: { path: logPath, sha256: sha256(log), bytes: Buffer.byteLength(log) }, junit,
  sourcesBefore: before, sourcesAfter: after,
  isolation: { environment: "OS allowlist plus isolated Deno cache/temp; no secrets or backend environment", runtimePermissionGrants: [], loader: "cached-only", typecheck: true, sanitizeOps: true, sanitizeResources: true },
  limits: ["Original three-test suite with in-memory client only", "No production/backend, SAT, stamping, upload, or real ACL/RLS certification", "GUI parser remains simulated; 22 Node assertions remain separate"],
};
const proofPath = join(root, `${report}/deno-original-results.json`);
await mkdir(dirname(proofPath), { recursive: true });
await writeFile(proofPath, JSON.stringify(proof, null, 2) + "\n");
console.log(log);
console.log(JSON.stringify({ status: proof.status, version: proof.runtime.version, exitCode: proof.exitCode, counts: proof.counts, proof: relative(root, proofPath).replaceAll("\\", "/") }));
if (!passed) process.exitCode = 1;
