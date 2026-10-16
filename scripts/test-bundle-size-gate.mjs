#!/usr/bin/env node
// Integration controls for the existing Bash gate; requires Bash + GNU gzip.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCssBudget } from "./check-css-size.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), "elogistix-bundle-gate-"));
const baseEnv = { ...process.env };
for (const key of ["BUNDLE_BUDGET_KB", "LAZY_BUDGET_KB", "VENDOR_BUDGET_KB", "REACT_PDF_BUDGET_KB"]) {
  delete baseEnv[key];
}
const results = [];
const budgets = readCssBudget();
const noise = Array.from({ length: 256 }, (_, i) => createHash("sha256").update(`gate:${i}`).digest("hex")).join("");
const grownCss = Array.from({ length: Math.ceil(budgets.raw / 64) }, (_, i) => {
  const hash = createHash("sha256").update(`css:${i}`).digest("hex");
  return `.synthetic-${hash}{color:#${hash.slice(0, 6)};--sample:"${hash}"}`;
}).join("\n");

function trial(name, assets, overrides, expectedStatus, expectedMessages) {
  const directory = path.join(temporary, name);
  mkdirSync(directory);
  for (const [file, content] of Object.entries(assets)) writeFileSync(path.join(directory, file), content);
  const result = spawnSync(process.env.BASH_BINARY || "bash", ["scripts/check-bundle-size.sh"], {
    cwd: root, env: { ...baseEnv, ...overrides, DIST_DIR: directory }, encoding: "utf8",
  });
  if (result.error) throw result.error;
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, expectedStatus, `${name}: ${output}`);
  for (const message of expectedMessages) assert.ok(output.includes(message), `${name}: missing ${message}: ${output}`);
  results.push({ name, status: result.status, expectedMessages, output: output.replaceAll(temporary, "<temporary>").trim() });
  console.log(`${name}: exit ${result.status}, expected ${expectedStatus}`);
}

try {
  const assets = { "index-control.js": "export {};", "control.css": "a{color:red}" };
  trial("control", assets, {}, 0, ["entry + lazy + vendor + CSS"]);
  trial("css-growth", { ...assets, "grown.css": grownCss }, {}, 1, ["::error::CSS raw:", "::error::CSS gzip:", "::error::CSS brotli:"]);
  trial("missing-css", { "index-control.js": assets["index-control.js"] }, {}, 1, ["No CSS files"]);
  trial("entry", { ...assets, "index-control.js": noise }, { BUNDLE_BUDGET_KB: "1" }, 1, ["Entry chunk", "excede"]);
  trial("lazy", { ...assets, "route.js": noise }, { LAZY_BUDGET_KB: "1" }, 1, ["Chunk lazy 'route.js'", "excede"]);
  trial("vendor", { ...assets, "vendor-example.js": noise }, { VENDOR_BUDGET_KB: "1" }, 1, ["Chunk vendor 'vendor-example.js'", "excede"]);
  trial("react-pdf", { ...assets, "react-pdf-example.js": noise }, { REACT_PDF_BUDGET_KB: "1" }, 1, ["Chunk lazy(react-pdf) 'react-pdf-example.js'", "excede"]);
  const output = path.join(root, "reports/css-size/wrapper-controls.json");
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ node: process.version, budgets, results }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(temporary);
  assert.ok(resolved.startsWith(`${path.resolve(tmpdir())}${path.sep}elogistix-bundle-gate-`));
  rmSync(resolved, { recursive: true, force: true });
}
