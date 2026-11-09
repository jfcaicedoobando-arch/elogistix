import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const previewPackages = [
  "@lovable.dev/vite-plugin-dev-server-bridge",
  "@lovable.dev/vite-plugin-hmr-gate",
];
const controls = ["@lovable.dev/unused-preview-control", "unused-dependency-control"];
const require = createRequire(import.meta.url);
const binary = path.resolve(path.dirname(require.resolve("knip")), "../bin/knip.js");
interface KnipIssue { dependencies?: { name: string }[]; devDependencies?: { name: string }[] }

describe("Lovable preview dependency inventory", () => {
  it("accounts only for the two platform plugins and still rejects unused dependencies", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    const config = JSON.parse(readFileSync("knip.json", "utf8"));
    const ignored: string[] = config.workspaces["."].ignoreDependencies;
    expect(ignored.filter((name) => name.startsWith("@lovable.dev/"))).toEqual(previewPackages);
    expect(config.rules.dependencies).toBe("error");
    const versions = previewPackages.map((name) => {
      expect(manifest.devDependencies[name]).toEqual(expect.any(String));
      return [name, manifest.devDependencies[name]];
    });
    const directory = mkdtempSync(path.join(tmpdir(), "elog-knip-preview-"));
    try {
      writeFileSync(path.join(directory, "package.json"), JSON.stringify({
        name: "preview-inventory-contract", private: true, type: "module",
        devDependencies: Object.fromEntries([...versions, ...controls.map((name) => [name, "1.0.0"])]),
      }));
      writeFileSync(path.join(directory, "index.js"), "export const live = 1;\n");
      for (const accountForPreview of [false, true]) {
        writeFileSync(path.join(directory, "knip.json"), JSON.stringify({
          entry: ["index.js"], project: ["index.js"], rules: config.rules,
          ignoreDependencies: [...config.ignoreDependencies,
            ...ignored.filter((name) => accountForPreview || !previewPackages.includes(name))],
        }));
        const result = spawnSync(process.execPath, [binary, "--directory", directory,
          "--include", "dependencies", "--no-progress", "--reporter", "json"], {
          cwd: directory, encoding: "utf8", timeout: 10000, windowsHide: true,
          env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
            TEMP: process.env.TEMP, TMP: process.env.TMP, NO_COLOR: "1" },
        });
        expect(result.error, result.error?.message).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(1);
        const issues: KnipIssue[] = JSON.parse(result.stdout).issues;
        const unused = issues.flatMap((issue) =>
          [...(issue.dependencies ?? []), ...(issue.devDependencies ?? [])].map(({ name }) => name));
        const expectedUnused = accountForPreview ? [...controls] : [...previewPackages, ...controls];
        expect(unused.sort()).toEqual(expectedUnused.sort());
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);
});
