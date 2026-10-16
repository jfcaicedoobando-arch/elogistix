// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const read = (file: string) => readFileSync(file, "utf8");
const setup = read(".github/actions/setup-bun/action.yml");
const ci = read(".github/workflows/ci.yml");
const workflows = readdirSync(".github/workflows").filter(file => /\.ya?ml$/.test(file));
const officialPins = {
  "checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
  "setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0",
  "upload-artifact": "cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2",
};

// New migration contract against main 6674a1b9. Existing historical inventories
// remain literal; they must not be rewritten to pretend earlier runs used v7.
// Only reviewed action refs/comments are normalized, never gates or commands.
const historicalWorkflowBodies = {
  "demo-financial-behavior-recovery.yml": "4f52041b2f1d05d489b019c1d3b90644a7133f3266b069f67e5770d3781154c6",
  "demo-financial-retry-negative-review.yml": "7629c07f36cc68b64dcb60118da82cbc235161144a5035906517f72b6f93586f",
  "demo-financial-commit-review.yml": "f65eb515e9caccb5a5ba53082bf5980c2b485dc8801c54b65fa086e3b67b487c",
};
const normalizedWorkflow = (source: string) => source.replace(
  /(uses: actions\/(?:checkout|setup-node|upload-artifact))@[^\r\n]+/g,
  "$1@REVIEWED_OFFICIAL_ACTION",
);

describe("Node 24 workflow migration", () => {
  it("pins the installed LTS independently of the Actions runtime and Bun", () => {
    expect(setup).toContain('node-version: "24.22.0"');
    expect(setup).toContain('bun-version: "1.4.0"');
    expect(setup).toContain('using: "composite"');
    expect(setup).toContain("package-manager-cache: false");
    expect(setup).toContain("id: setup-node");
    expect(setup).toContain("value: ${{ steps.setup-node.outputs.node-version }}");
    expect(setup).toContain("run: node --version");
    expect(JSON.parse(read("package.json")).engines.node).toBe(">=22.22.0");
  });

  it("keys complete dependency caches by actual Node, architecture, Bun and lock", () => {
    const step = setup.split("    - name: Cache node_modules")[1].split("    - name: Cache Bun deps")[0];
    expect(step).toContain("${{ runner.os }}-${{ runner.arch }}-node${{ steps.setup-node.outputs.node-version }}-node-modules-bun1.4.0-${{ hashFiles('bun.lock', 'package.json') }}");
    expect(step).not.toContain("restore-keys:");
    expect(setup).not.toContain("node22.22.0");
    expect(setup).toContain("bun install --frozen-lockfile --ignore-scripts");
    expect(setup).toContain("if ! bun pm ls > /dev/null 2>&1; then");
    expect(setup).toContain("steps.verify-cache.outputs.reinstalled != 'true'");
  });

  it("keeps every ESLint cache fallback on the actual Node runtime", () => {
    const lint = ci.split("  lint:\n")[1].split("  checks:\n")[0];
    expect(lint).toMatch(/name: Setup Bun \+ install\s+id: setup\s+uses: \.\/.github\/actions\/setup-bun/);
    const keys = lint.split("path: .cache/eslint")[1].split("# `react-compiler`")[0];
    expect(keys.match(/steps\.setup\.outputs\.node-version/g)).toHaveLength(3);
    expect(keys.match(/runner\.arch/g)).toHaveLength(3);
    expect(keys).not.toContain("-eslint-bun");
  });

  it("uses SHA-pinned current official actions throughout active workflows", () => {
    const sources = [...workflows.map(file => read(path.join(".github/workflows", file))), setup];
    for (const [name, expected] of Object.entries(officialPins)) {
      const refs = sources.flatMap(source => [...source.matchAll(new RegExp(`uses: actions/${name}@([^\\r\\n]+)`, "g"))].map(match => match[1]));
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(ref === expected || ref.startsWith(`${expected};`)).toBe(true);
    }
    for (const source of sources) {
      expect(source).not.toMatch(/using:\s*["']?node26|FORCE_JAVASCRIPT_ACTIONS_TO_NODE24|allow-unsafe-pr-checkout:\s*true/);
    }
  });

  it("preserves historical gates, commands, inputs and Node 24.19 fixtures", () => {
    for (const [file, expected] of Object.entries(historicalWorkflowBodies)) {
      const normalized = normalizedWorkflow(read(path.join(".github/workflows", file)));
      expect(createHash("sha256").update(normalized).digest("hex")).toBe(expected);
    }
    for (const file of ["ci.yml", "demo-persistence-prerequisites.yml", "demo-wire-lab.yml", "demo-authority-entry-review.yml"]) {
      expect(read(path.join(".github/workflows", file))).toContain("node-version: '24.19.0'");
    }
  });
});
