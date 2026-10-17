import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const fixture = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = join(fixture, "evidence");
const readJson = async path => JSON.parse(await readFile(join(root, path), "utf8"));
const browser = await readJson("reports/deferred-erp/results.json");
const unit = await readJson("reports/deferred-erp/unit-results.json");
const parser = await readJson("test-results/xml-parser-local.json");
const { expected, unexpected, flaky, skipped } = browser.stats;
if (expected !== 26 || unexpected !== 0 || flaky !== 0 || skipped !== 0 || browser.errors.length !== 0) {
  throw new Error("Require all 26 GUI cases without failures, skips, retries or runner errors");
}
if (!unit.success || unit.numPassedTests !== 100 || unit.numFailedTests !== 0 || unit.numPendingTests !== 0) {
  throw new Error("Require all 100 existing unit tests");
}
if (parser.assertions.length !== 22 || parser.assertions.some(item => !item.passed) || parser.denoSuiteExecuted !== false || parser.networkAttempts.length) {
  throw new Error("Require separate local parser evidence with Deno limitation preserved");
}
await mkdir(join(output, "screenshots"), { recursive: true });
await mkdir(join(output, "validation"), { recursive: true });
const cases = [];
const screenshots = [];
async function visit(suite, parents = []) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests) {
    if (test.results.length !== 1 || test.results[0].status !== "passed") throw new Error("Each GUI case must pass once");
    const result = test.results[0];
    const facts = [];
    const images = [];
    const ordinal = String(cases.length + 1).padStart(2, "0");
    for (const attachment of result.attachments ?? []) {
      if (attachment.contentType === "application/json") {
        const content = attachment.body ? Buffer.from(attachment.body, "base64").toString("utf8") : await readFile(attachment.path, "utf8");
        facts.push({ name: attachment.name, ...JSON.parse(content) });
      }
      if (attachment.contentType === "image/png") {
        const name = `${ordinal}-${test.projectName}-${basename(attachment.path)}`;
        await copyFile(attachment.path, join(output, "screenshots", name));
        images.push(`screenshots/${name}`);
        screenshots.push({ case: ordinal, project: test.projectName, name: attachment.name, path: `screenshots/${name}` });
      }
    }
    const network = facts.find(item => item.network)?.network;
    if (!network || network.blocked.length || network.errors.length || !network.requests.length) throw new Error(`Missing clean network evidence: ${spec.title}`);
    if (network.requests.some(request => !/^GET http:\/\/127\.0\.0\.1:8097\/(?:$|index\.html$|assets\/)/.test(request))) throw new Error("Unexpected network request");
    cases.push({ id: ordinal, project: test.projectName, title: [...parents, spec.title].filter(Boolean).join(" / "), status: result.status, durationMs: result.duration, facts, screenshots: images });
  }
  for (const child of suite.suites ?? []) await visit(child, [...parents, suite.title]);
}
for (const suite of browser.suites) await visit(suite);
if (cases.length !== 26) throw new Error("Incomplete GUI evidence");

const inputs = [];
async function fingerprint(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "evidence") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await fingerprint(path);
    else inputs.push({ path: relative(root, path).replaceAll("\\", "/"), sha256: createHash("sha256").update(await readFile(path)).digest("hex") });
  }
}
await fingerprint(fixture);
const unitFiles = unit.testResults.map(file => ({
  path: relative(root, file.name).replaceAll("\\", "/"), status: file.status,
  assertions: file.assertionResults.map(assertion => ({ name: assertion.fullName, status: assertion.status })),
}));
for (const name of ["build", "typecheck", "lint", "unit", "browser"]) {
  const log = await readFile(join(root, "reports", "deferred-erp", `${name}.log`), "utf8");
  await writeFile(join(output, "validation", `${name}.txt`), log.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, ""));
}
const network = cases.map(item => item.facts.find(fact => fact.network).network);
const summary = {
  baseCommit: "b02c3391a97ea7d54b0a6b0b514c4626738ab639",
  initialBaseCommit: "9af3859fabd6e57343cb5fadd4494a0a14579cb2",
  integration: "main PR387 retained unchanged; validation repeated on integrated tree",
  generatedAt: new Date().toISOString(),
  scope: "Local synthetic components and in-memory backend only; no production/staging certification",
  validation: { typecheck: "passed", eslint: "passed", isolatedBuild: "passed; forbidden dependency guard active" },
  unit: { files: unitFiles.length, passed: unit.numPassedTests, failed: unit.numFailedTests, pending: unit.numPendingTests },
  gui: { passed: expected, failed: unexpected, flaky, skipped, retries: 0, viewports: ["1280x720", "390x640"], browser: "Isolated Playwright Chromium 156.0.8078.4 (revision1248)", screenshotCount: screenshots.length },
  network: { fixtureGetRequests: network.reduce((count, item) => count + item.requests.length, 0), blockedAttempts: network.reduce((count, item) => count + item.blocked.length, 0), browserErrors: network.reduce((count, item) => count + item.errors.length, 0), externalRequests: 0, nonGetRequests: 0, serviceWorkers: "blocked", webSockets: "blocked" },
  localXmlParser: { assertions: parser.assertions.length, passed: true, denoSuiteExecuted: false },
  blocker: "Original Deno suite not executed: runtime unavailable; auto-review rejected network download. Requires a locally authorized Deno runtime.",
  notExecuted: ["real Gmail", "real Supabase/database/RLS/ACL", "real writes/deletes/uploads", "SAT or stamping", "production/staging E2E", "merge or deployment"],
  productDefectsObserved: [],
  harnessCorrectionsBeforeFinalRun: ["Add QueryClientProvider to XML fixture", "Match accessible typographic dash and normalized case in Correo selectors", "Refactor CRM mock to satisfy complexity rule", "Use production Toaster and ThemeProvider for matching toast placement"],
  fixtureInputs: inputs,
};
await writeFile(join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
await writeFile(join(output, "assertions-network.json"), JSON.stringify({ cases }, null, 2) + "\n");
await writeFile(join(output, "unit-results.json"), JSON.stringify({ files: unitFiles }, null, 2) + "\n");
await writeFile(join(output, "xml-parser-local.json"), JSON.stringify(parser, null, 2) + "\n");
await writeFile(join(output, "screenshots.json"), JSON.stringify(screenshots, null, 2) + "\n");
console.log(`Collected ${cases.length} passing GUI cases, ${screenshots.length} screenshots, 100 unit tests and 22 local parser assertions.`);
