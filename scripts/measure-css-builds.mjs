#!/usr/bin/env node
// Three fresh production builds; no uploads, dependency changes or timing claims.
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { measureCss } from "./check-css-size.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(root, process.argv[2] ?? "reports/css-size/clean-builds.json");
const logs = path.dirname(output);
mkdirSync(logs, { recursive: true });

function command(commandName, args) {
  const result = spawnSync(commandName, args, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${commandName} ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex");
}

function cleanBuildOutput(relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`Refusing to clean outside project: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}

const env = { ...process.env, BUILD_SOURCEMAPS: "false", ANALYZE: "false", CI_REPORT_COMPRESSED_SIZE: "false" };
delete env.SENTRY_AUTH_TOKEN;
const buildArgs = ["node_modules/vite/bin/vite.js", "build", "--mode", "production"];
const report = {
  sourceSha: command("git", ["rev-parse", "HEAD"]),
  trackedWorktreeStatus: command("git", ["status", "--porcelain", "--untracked-files=no"]),
  lockSha256: sha256("bun.lock"),
  toolSha256: {
    measure: sha256("scripts/measure-css-builds.mjs"),
    compression: sha256("scripts/check-css-size.mjs"),
  },
  runtime: {
    platform: process.platform, arch: process.arch, node: process.version,
    bun: command("bun", ["--version"]), zlib: process.versions.zlib, brotli: process.versions.brotli,
  },
  compression: { gzipLevel: 9, brotliQuality: 11, brotliMode: "text", brotliSizeHint: "input bytes" },
  build: {
    command: "node node_modules/vite/bin/vite.js build --mode production",
    environment: { BUILD_SOURCEMAPS: "false", ANALYZE: "false", CI_REPORT_COMPRESSED_SIZE: "false", SENTRY_AUTH_TOKEN: "unset" },
    cleanedBeforeEachRun: ["dist", "node_modules/.vite", "node_modules/.vite-temp"],
    dependencyInstall: "bun install --frozen-lockfile --ignore-scripts (before this command)",
  },
  runs: [],
};

for (let run = 1; run <= 3; run += 1) {
  report.build.cleanedBeforeEachRun.forEach(cleanBuildOutput);
  const log = path.join(logs, `build-${run}.log`);
  const fd = openSync(log, "w");
  let result;
  try {
    result = spawnSync(process.execPath, buildArgs, { cwd: root, env, stdio: ["ignore", fd, fd] });
  } finally {
    closeSync(fd);
  }
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`Build ${run} failed (${result.status}); see ${log}`);
  }
  const measured = measureCss(path.join(root, "dist/assets"));
  report.runs.push({ run, ...measured });
  console.log(`Build ${run}: ${JSON.stringify(measured.total)} bytes`);
}

const metrics = ["raw", "gzip", "brotli"];
report.range = Object.fromEntries(metrics.map((metric) => {
  const values = report.runs.map((run) => run.total[metric]);
  return [metric, { min: Math.min(...values), max: Math.max(...values) }];
}));
report.identicalCss = report.runs.every((run) => JSON.stringify(run.files) === JSON.stringify(report.runs[0].files));
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Evidence: ${output}; identical CSS across runs: ${report.identicalCss}`);
