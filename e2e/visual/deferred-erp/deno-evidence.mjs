import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { JSDOM } from "jsdom";

const suite = "supabase/functions/parse-cfdi-xml/validarNcProveedor_test.ts";
const executable = "test-results/xml-deno-runtime/deno.exe";
const report = "reports/deferred-erp";
const version = "2.9.7";
const officialArchiveSha256 = "a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238";
const expectedArgs = [
  "test", "--no-config", "--no-lock", "--cached-only", "--node-modules-dir=none",
  "--sanitize-ops", "--sanitize-resources", "--no-prompt", "--check",
  "--deny-env", "--deny-net", "--deny-read", "--deny-write", "--deny-run", "--deny-ffi", "--deny-sys",
  `--junit-path=${report}/deno-original.junit.xml`, suite,
];
const expectedTestNames = [
  "96: conserva la relación del XML y acepta identidad completa coincidente",
  "96: rechaza emisor, receptor, tipo, UUID y relación antes del prefill",
  "96: lecturas aisladas por organización y rechaza duplicados o factura ajena",
];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const requireEvidence = (condition, detail) => { if (!condition) throw new Error(`Deno evidence: ${detail}`); };

export async function fingerprintDenoSources(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push({ path: relative(root, path).replaceAll("\\", "/"), sha256: sha256(await readFile(path)) });
      else throw new Error("Deno evidence: unexpected non-regular source input");
    }
  }
  for (const directory of ["supabase/functions/parse-cfdi-xml", "supabase/functions/_shared"]) await visit(join(root, directory));
  return files;
}

function validateResult(proof) {
  requireEvidence(proof?.schemaVersion === 1 && proof.status === "passed" && typeof proof.runId === "string" && proof.runId.length > 0, "missing successful original-suite proof");
  requireEvidence(proof.exitCode === 0 && proof.signal === null && proof.spawnError === null, "original-suite process did not succeed cleanly");
  requireEvidence(proof.suite === suite && proof.command?.executable === executable && proof.command.cwd === "." && proof.command.shell === false && equal(proof.command.args, expectedArgs), "original-suite command or permission flags changed");
  requireEvidence(proof.counts?.total === 3 && proof.counts.passed === 3 && proof.counts.failed === 0 && proof.counts.skipped === 0, "require three passed tests without failures or skips");
  const start = Date.parse(proof.startedAt), end = Date.parse(proof.completedAt);
  requireEvidence(Number.isFinite(start) && Number.isFinite(end) && start <= end, "invalid execution timestamps");
  requireEvidence(proof.isolation?.loader === "cached-only" && proof.isolation.typecheck === true && proof.isolation.sanitizeOps === true && proof.isolation.sanitizeResources === true && equal(proof.isolation.runtimePermissionGrants, []), "missing strict original-suite isolation");
}

async function validateRuntime(root, proof) {
  const runtime = proof.runtime, download = proof.download;
  requireEvidence(runtime?.version === version && runtime.versionExitCode === 0 && Array.isArray(runtime.versionOutput) && /^deno 2\.9\.7 \(/.test(runtime.versionOutput[0]), "runtime did not report pinned Deno 2.9.7");
  const workflow = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
  requireEvidence(/^\s+deno-version: v2\.9\.7\s*$/m.test(workflow) && download?.repositoryPinnedVersion === version, "repository Deno pin changed");
  requireEvidence(download.sourceUrl === "https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-pc-windows-msvc.zip" && download.releaseMetadataUrl === "https://api.github.com/repos/denoland/deno/releases/tags/v2.9.7", "download did not use the exact official pinned release");
  requireEvidence(download.archiveSha256 === officialArchiveSha256 && download.officialAssetDigest === `sha256:${officialArchiveSha256}`, "download archive does not match the verified official asset digest");
  requireEvidence(download.versionExitCode === 0 && equal(download.version, runtime.versionOutput), "download runtime version evidence differs");
  const provenance = JSON.parse(await readFile(join(root, "test-results/xml-deno-runtime/download-provenance.json"), "utf8"));
  requireEvidence(equal(provenance, download), "local download provenance differs from execution proof");
  const executableHash = sha256(await readFile(join(root, executable)));
  requireEvidence(executableHash === runtime.executableSha256 && executableHash === download.executableSha256, "local Deno executable hash differs from verified download");
}

async function checkedArtifact(root, descriptor, path, expectedBytes) {
  requireEvidence(descriptor?.path === path && /^[a-f0-9]{64}$/.test(descriptor.sha256), `missing or unexpected artifact: ${path}`);
  const bytes = await readFile(join(root, path));
  requireEvidence(sha256(bytes) === descriptor.sha256 && (expectedBytes === undefined || bytes.length === expectedBytes), `artifact hash or size changed: ${path}`);
  return bytes;
}

function validateJunit(bytes, expectedCounts) {
  const xml = bytes.toString("utf8");
  // Reject DTDs before parsing. JSDOM's default scripts and external resource
  // loading remain disabled; this is an XML document, never a browser page.
  requireEvidence(!/<!DOCTYPE\b/i.test(xml), "JUnit DOCTYPE is not permitted");
  let window;
  try {
    window = new JSDOM(xml, { contentType: "application/xml" }).window;
  } catch {
    throw new Error("Deno evidence: JUnit document is not well-formed XML");
  }
  try {
    const document = window.document;
    const root = document.documentElement;
    requireEvidence(!document.doctype && root?.localName === "testsuites" && root.namespaceURI === null, "JUnit document root is invalid");
    requireEvidence(root.getAttribute("tests") === "3" && root.getAttribute("failures") === "0" && root.getAttribute("errors") === "0", "JUnit suite totals are invalid");
    const suites = [...root.children];
    requireEvidence(suites.length === 1 && suites[0].localName === "testsuite" && suites[0].namespaceURI === null && suites[0].getAttribute("name") === `./${suite}`, "JUnit did not report exactly the original suite");
    const suiteElement = suites[0];
    requireEvidence(suiteElement.getAttribute("tests") === "3" && suiteElement.getAttribute("failures") === "0" && suiteElement.getAttribute("errors") === "0" && suiteElement.getAttribute("disabled") === "0", "JUnit original-suite totals are invalid");
    const testcases = [...suiteElement.children];
    requireEvidence(testcases.every(element => element.localName === "testcase" && element.namespaceURI === null && element.getAttribute("classname") === `./${suite}`), "JUnit cases did not execute the original suite");
    const names = testcases.map(element => element.getAttribute("name"));
    requireEvidence(names.length === 3 && new Set(names).size === 3 && expectedTestNames.every(name => names.includes(name)), "JUnit requires the exact three unique original test names");
    const elements = [...document.getElementsByTagName("*")];
    const failed = elements.filter(element => ["failure", "error"].includes(element.localName)).length;
    const skipped = elements.filter(element => element.localName === "skipped").length;
    const counts = { total: testcases.length, passed: testcases.length - failed - skipped, failed, skipped };
    requireEvidence(counts.total === expectedCounts.total && counts.passed === expectedCounts.passed && counts.failed === expectedCounts.failed && counts.skipped === expectedCounts.skipped, "JUnit actual test results differ from proof counts");
  } finally {
    window.close();
  }
}

export async function verifyDenoEvidence(root) {
  const proofBytes = await readFile(join(root, report, "deno-original-results.json"));
  const proof = JSON.parse(proofBytes.toString("utf8"));
  validateResult(proof);
  await validateRuntime(root, proof);
  const sources = await fingerprintDenoSources(root);
  requireEvidence(equal(proof.sourcesBefore, proof.sourcesAfter) && equal(proof.sourcesAfter, sources), "original-suite source inputs changed or are incomplete");
  const log = await checkedArtifact(root, proof.log, `${report}/deno-original.log`, proof.log?.bytes);
  requireEvidence(Number.isSafeInteger(proof.log?.bytes) && proof.log.bytes > 0 && /ok \| 3 passed \| 0 failed/.test(log.toString("utf8")), "missing original-suite successful runner output");
  const junit = await checkedArtifact(root, proof.junit, `${report}/deno-original.junit.xml`);
  validateJunit(junit, proof.counts);
  return { proof, proofBytes, proofSha256: sha256(proofBytes), log, junit };
}

export async function collectDenoEvidence({ root, output }) {
  const verified = await verifyDenoEvidence(root);
  await mkdir(join(output, "validation"), { recursive: true });
  await writeFile(join(output, "deno-original-results.json"), verified.proofBytes);
  await writeFile(join(output, "validation/deno-original.txt"), verified.log);
  await writeFile(join(output, "validation/deno-original.junit.xml"), verified.junit);
  return {
    status: verified.proof.status, runId: verified.proof.runId, suite, runtime: version,
    counts: verified.proof.counts, proof: "deno-original-results.json", proofSha256: verified.proofSha256,
    log: "validation/deno-original.txt", junit: "validation/deno-original.junit.xml",
    typecheck: true, runtimePermissionGrants: [], loader: "cached-only",
    scope: "Original local Deno suite with in-memory client; no backend, ACL/RLS or production certification",
  };
}
