import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const fixturePath = "e2e/visual/deferred-erp";
const reportPath = "reports/deferred-erp";
const timeoutMs = 120_000;
const maxBufferBytes = 16 * 1024 * 1024;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const normalized = value => value.replaceAll("\\", "/");

export const validationCommands = [
  { name: "typecheck", args: ["node_modules/typescript/bin/tsc", "-p", `${fixturePath}/tsconfig.json`] },
  { name: "lint", args: ["node_modules/eslint/bin/eslint.js", "--no-cache", fixturePath] },
  { name: "build", args: ["node_modules/vite/bin/vite.js", "build", "--config", `${fixturePath}/vite.config.ts`] },
];

function isolatedEnvironment(root) {
  // Pass only OS runtime necessities. In particular no backend, token, VITE_*,
  // NODE_OPTIONS or user-supplied preload environment reaches the child process.
  const allowed = /^(?:path|systemroot|windir|comspec|pathext|number_of_processors|processor_architecture|os)$/i;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
  return { ...env, CI: "true", NO_COLOR: "1", TEMP: join(root, "test-results/temp"), TMP: join(root, "test-results/temp"), TMPDIR: join(root, "test-results/temp") };
}

export async function fingerprintSources(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", ".git", ".cache"].includes(entry.name) || (entry.name === "evidence" && normalized(relative(root, directory)) === fixturePath)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push({ path: normalized(relative(root, path)), sha256: sha256(await readFile(path)) });
      else throw new Error(`Unexpected non-regular validation input: ${normalized(relative(root, path))}`);
    }
  }
  // These cover the real component imports, lint helpers and all fixture code.
  for (const directory of ["src", "scripts", fixturePath]) await visit(join(root, directory));
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && /(?:\.config\.[^.]+$|^tsconfig.*\.json$|^package\.json$|(?:^|[-.])lock(?:b|\.json|\.yaml)?$)/.test(entry.name)) {
      files.push({ path: entry.name, sha256: sha256(await readFile(join(root, entry.name))) });
    }
  }
  // Vite intentionally uses the shared visual CSS and standalone PostCSS and
  // Tailwind configs. They must stay bound to the same source fingerprint.
  for (const entry of await readdir(join(root, "e2e/visual"), { withFileTypes: true })) {
    if (entry.isFile() && /^(?:index\.css|(?:postcss|tailwind)\.config\.[^.]+)$/.test(entry.name)) files.push({ path: `e2e/visual/${entry.name}`, sha256: sha256(await readFile(join(root, "e2e/visual", entry.name))) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { algorithm: "sha256", digest: sha256(JSON.stringify(files)), fileCount: files.length };
}

function errorDetails(error) {
  if (!error) return null;
  return { name: error.name ?? "Error", message: error.message ?? String(error), code: error.code ?? null };
}

export function assertSuccessfulValidation(record) {
  if (!record || record.exitCode !== 0 || record.signal !== null || record.spawnError !== null) {
    throw new Error(`Fresh validation failed: ${record?.name ?? "missing result"}; exitCode=${record?.exitCode ?? "missing"}; signal=${record?.signal ?? "none"}; error=${record?.spawnError?.message ?? "none"}`);
  }
}

export async function runValidation({ root, runId = randomUUID(), execute = spawnSync }) {
  const reports = join(root, reportPath);
  await mkdir(reports, { recursive: true });
  await mkdir(join(root, "test-results/temp"), { recursive: true });
  const proof = { schemaVersion: 1, runId, status: "running", startedAt: new Date().toISOString(), completedAt: null, sourceBefore: null, sourceAfter: null, commands: [] };
  const saveProof = () => writeFile(join(reports, "validation-results.json"), JSON.stringify(proof, null, 2) + "\n");
  await saveProof();
  try {
    proof.sourceBefore = await fingerprintSources(root);
    for (const command of validationCommands) {
      const startedAt = new Date().toISOString();
      let result;
      try {
        result = execute(process.execPath, [...command.args], { cwd: root, encoding: "utf8", shell: false, timeout: timeoutMs, maxBuffer: maxBufferBytes, env: isolatedEnvironment(root) });
      } catch (error) {
        result = { status: null, signal: null, error };
      }
      const log = `${result?.stdout ?? ""}\n[stderr]\n${result?.stderr ?? ""}`.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
      const logPath = `${reportPath}/${command.name}.log`;
      await writeFile(join(root, logPath), log);
      const record = {
        name: command.name, executable: process.execPath, args: [...command.args], cwd: ".", shell: false, timeoutMs, maxBufferBytes,
        startedAt, completedAt: new Date().toISOString(), exitCode: result?.status ?? null, signal: result?.signal ?? null,
        spawnError: errorDetails(result?.error), log: { path: logPath, sha256: sha256(log), bytes: Buffer.byteLength(log) },
      };
      proof.commands.push(record);
      await saveProof();
      assertSuccessfulValidation(record);
    }
    proof.sourceAfter = await fingerprintSources(root);
    if (proof.sourceBefore.digest !== proof.sourceAfter.digest) throw new Error("Validation source drift: source inputs changed during fresh checks");
    proof.status = "passed";
    proof.completedAt = new Date().toISOString();
    await saveProof();
    return proof;
  } catch (error) {
    proof.status = "failed";
    proof.completedAt = new Date().toISOString();
    proof.failure = errorDetails(error);
    await saveProof();
    throw error;
  }
}
