// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runner = fileURLToPath(new URL("../../../scripts/ci/typecheck-incremental.mjs", import.meta.url));
const compiler = require.resolve("typescript/bin/tsc");
type ChildResult = { status: number | null; signal: NodeJS.Signals | null; error?: Error };
type ChildOptions = { cwd: string; stdio: "inherit" | ["inherit", number, number] };
type Launch = (command: string, args: string[], options: ChildOptions) => ChildResult;
const { runTypecheck } = require(runner) as {
  runTypecheck(options: { cwd: string; spawn?: Launch; outputFd?: number }): number;
};
const fixtures: string[] = [];
const appSource = 'import { shared } from "../external/shared";\nexport const check: string = shared;\nexport const result: string = "okay";\n';

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fs.rmSync(fixture, { recursive: true, force: true });
});

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function childConfig(name: "app" | "node" | "extra") {
  return {
    compilerOptions: {
      strict: true, skipLibCheck: true, noEmit: true, incremental: true,
      tsBuildInfoFile: `.cache/tsc/tsconfig.${name}.tsbuildinfo`,
      target: "ES2022", module: "ESNext", moduleResolution: "bundler",
      types: [], lib: ["ES2022"],
    },
    include: [name === "app" ? "src" : name],
  };
}

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "elogistix-typecheck-test-"));
  fixtures.push(cwd);
  const rootConfig = { files: [] as string[], references: [{ path: "./tsconfig.app.json" }, { path: "./tsconfig.node.json" }] };
  write(path.join(cwd, "tsconfig.json"), JSON.stringify(rootConfig));
  for (const project of ["app", "node"] as const)
    write(path.join(cwd, `tsconfig.${project}.json`), JSON.stringify(childConfig(project)));
  const app = path.join(cwd, "src/app.ts");
  const node = path.join(cwd, "node/config.ts");
  const dependency = path.join(cwd, "external/shared.ts");
  write(app, appSource);
  write(node, 'export const result: string = "ok";\n');
  write(dependency, 'export const shared: string = "ok";\n');
  return { cwd, app, node, dependency, rootConfig, cache: path.join(cwd, ".cache/tsc") };
}
type Fixture = ReturnType<typeof fixture>;

function execute(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  expect(result.signal).toBeNull();
  return {
    status: result.status,
    diagnostics: `${result.stdout}${result.stderr}`.replaceAll(cwd, "<fixture>").split(/\r?\n/).filter(Boolean).sort(),
  };
}

const incremental = (f: Fixture) => execute(f.cwd, [runner]);
function clean(f: Fixture) {
  // The oracle is the original `tsc -b` with no cached build state, rather
  // than another invocation of the fallback's --force implementation.
  fs.rmSync(f.cache, { recursive: true, force: true });
  fs.rmSync(path.join(f.cwd, "tsconfig.tsbuildinfo"), { force: true });
  return execute(f.cwd, [compiler, "-b"]);
}
function seed(f: Fixture) {
  expect(clean(f)).toEqual({ status: 0, diagnostics: [] });
}
function expectCleanParity(f: Fixture) {
  const actual = incremental(f);
  const reference = clean(f);
  // TypeScript's nonzero code also reflects whether build-info was emitted;
  // the CI contract is success/failure plus the full diagnostic set.
  expect(actual.status === 0).toBe(reference.status === 0);
  expect(actual.diagnostics).toEqual(reference.diagnostics);
  return actual;
}

describe("incremental CI typecheck with the installed compiler", () => {
  it("checks a cold and warm tree without loading TypeScript from the fixture", () => {
    const f = fixture();
    expect(incremental(f)).toEqual({ status: 0, diagnostics: [] });
    expect(fs.existsSync(path.join(f.cache, "tsconfig.app.tsbuildinfo"))).toBe(true);
    expect(fs.existsSync(path.join(f.cache, "tsconfig.node.tsbuildinfo"))).toBe(true);
    expectCleanParity(f);
  });

  it("detects a source error with unchanged size and mtime", () => {
    const f = fixture(); seed(f);
    const original = fs.statSync(f.app);
    write(f.app, appSource.replace('"okay"', "123456"));
    fs.utimesSync(f.app, original.atime, original.mtime);
    expect(fs.statSync(f.app).size).toBe(original.size);
    expect(expectCleanParity(f).diagnostics.join("\n")).toContain("TS2322");
  });

  it("invalidates an imported API outside include when the root file is unchanged", () => {
    const f = fixture(); seed(f);
    write(f.dependency, "export const shared: number = 123;\n");
    expect(expectCleanParity(f).diagnostics.join("\n")).toContain("src/app.ts");
  });

  it("rechecks stricter compiler options even when the config mtime is preserved", () => {
    const f = fixture();
    write(f.app, `${appSource}export const indexed: string = ["ok"][0];\n`);
    seed(f);
    const configFile = path.join(f.cwd, "tsconfig.app.json");
    const original = fs.statSync(configFile);
    const config = childConfig("app");
    write(configFile, JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, noUncheckedIndexedAccess: true } }));
    fs.utimesSync(configFile, original.atime, original.mtime);
    expect(expectCleanParity(f).diagnostics.join("\n")).toContain("TS2322");
  });

  it("reports both app and Node errors without duplicating preliminary diagnostics", () => {
    const f = fixture(); seed(f);
    write(f.app, "export const appValue: string = 123;\n");
    write(f.node, 'export const nodeValue: number = "bad";\n');
    const actual = expectCleanParity(f);
    expect(actual.diagnostics).toHaveLength(2);
    expect(actual.diagnostics.some(line => line.startsWith("src/app.ts"))).toBe(true);
    expect(actual.diagnostics.some(line => line.startsWith("node/config.ts"))).toBe(true);
  });

  it.each(["new-root", "deleted-import", "renamed-import"])("handles %s after a successful cached check", scenario => {
    const f = fixture(); seed(f);
    if (scenario === "new-root") write(path.join(f.cwd, "src/new.ts"), "export const added: string = 123;\n");
    else if (scenario === "deleted-import") fs.unlinkSync(f.dependency);
    else fs.renameSync(f.dependency, path.join(f.cwd, "external/renamed.ts"));
    expect(expectCleanParity(f).status).not.toBe(0);
  });

  it.each(["truncated", "malformed", "different-version"])("recovers disposable %s build information", scenario => {
    const f = fixture(); seed(f);
    const info = path.join(f.cache, "tsconfig.app.tsbuildinfo");
    if (scenario === "truncated") write(info, "{not valid json");
    else if (scenario === "malformed") write(info, JSON.stringify({ version: require("typescript").version, fileNames: ["../../../src/app.ts"] }));
    else {
      // Test invalidation only; production never reads this private format.
      const content = JSON.parse(fs.readFileSync(info, "utf8"));
      content.version = "0.0.0";
      write(info, JSON.stringify(content));
    }
    expect(expectCleanParity(f)).toEqual({ status: 0, diagnostics: [] });
  });

  it("keeps errors from a failed cache and clears them after the source is fixed", () => {
    const f = fixture();
    write(f.app, "export const result: string = 123;\n");
    const first = expectCleanParity(f);
    expect(first.status).not.toBe(0);
    const repeated = expectCleanParity(f);
    expect(repeated.diagnostics).toEqual(first.diagnostics);
    const original = fs.statSync(f.app);
    write(f.app, appSource);
    fs.utimesSync(f.app, original.atime, original.mtime);
    expect(expectCleanParity(f)).toEqual({ status: 0, diagnostics: [] });
  });

  const unsupported: [string, (f: Fixture) => void][] = [
    ["invalid root JSON", f => write(path.join(f.cwd, "tsconfig.json"), "{bad json")],
    ["unknown root option", f => write(path.join(f.cwd, "tsconfig.json"), JSON.stringify({ ...f.rootConfig, compilerOptions: { unknownStrictOption: true } }))],
    ["a new root reference", f => {
      write(path.join(f.cwd, "tsconfig.extra.json"), JSON.stringify(childConfig("extra")));
      write(path.join(f.cwd, "extra/new.ts"), "export const extra: string = 123;\n");
      write(path.join(f.cwd, "tsconfig.json"), JSON.stringify({ ...f.rootConfig, references: [...f.rootConfig.references, { path: "./tsconfig.extra.json" }] }));
    }],
    ["a missing root reference", f => write(path.join(f.cwd, "tsconfig.json"), JSON.stringify({ ...f.rootConfig, references: [...f.rootConfig.references, { path: "./missing.json" }] }))],
    ["invalid child JSON", f => write(path.join(f.cwd, "tsconfig.app.json"), "{bad json")],
    ["unknown child option", f => {
      const config = childConfig("app");
      write(path.join(f.cwd, "tsconfig.app.json"), JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, unknownStrictOption: true } }));
    }],
    ["a child reference", f => write(path.join(f.cwd, "tsconfig.app.json"), JSON.stringify({ ...childConfig("app"), references: [{ path: "./tsconfig.node.json" }] }))],
    ["root source files", f => {
      write(path.join(f.cwd, "root.ts"), "export const rootValue: string = 123;\n");
      write(path.join(f.cwd, "tsconfig.json"), JSON.stringify({ ...f.rootConfig, files: ["root.ts"], compilerOptions: { noEmit: true } }));
    }],
  ];
  it.each(unsupported)("retains canonical diagnostics for %s", (_name, mutate) => {
    const f = fixture(); seed(f); mutate(f);
    expect(expectCleanParity(f).status).not.toBe(0);
  });
});

describe("incremental runner process and output contracts", () => {
  it("does not retry a signal or run another project after termination", () => {
    const f = fixture();
    const calls: string[][] = [];
    const spawn: Launch = (_command, args) => { calls.push(args); return { status: null, signal: "SIGTERM" }; };
    expect(() => runTypecheck({ cwd: f.cwd, spawn })).toThrow(/SIGTERM/);
    expect(calls).toHaveLength(1);
  });

  it("does not convert a launch failure into a canonical retry", () => {
    const f = fixture();
    const calls: string[][] = [];
    const spawn: Launch = (_command, args) => { calls.push(args); return { status: null, signal: null, error: new Error("launch unavailable") }; };
    expect(() => runTypecheck({ cwd: f.cwd, spawn })).toThrow("launch unavailable");
    expect(calls).toHaveLength(1);
  });

  it("runs both projects and one canonical fallback after ordinary failures", () => {
    const f = fixture();
    const calls: string[][] = [];
    const spawn: Launch = (_command, args) => {
      calls.push(args);
      return { status: calls.length === 3 ? 7 : 1, signal: null };
    };
    expect(runTypecheck({ cwd: f.cwd, spawn })).toBe(7);
    expect(calls.map(args => args.slice(1))).toEqual([
      ["-p", path.join(f.cwd, "tsconfig.app.json")],
      ["-p", path.join(f.cwd, "tsconfig.node.json")],
      ["-b", "--force"],
    ]);
  });

  it("streams successful child output through file descriptors beyond spawnSync's default buffer", () => {
    const f = fixture();
    const output = path.join(f.cwd, "output.log");
    const outputFd = fs.openSync(output, "w");
    const spawn: Launch = (command, _args, options) => spawnSync(command,
      ["-e", "process.stdout.write(Buffer.alloc(2 * 1024 * 1024, 120))"], options);
    try {
      expect(runTypecheck({ cwd: f.cwd, spawn, outputFd })).toBe(0);
    } finally {
      fs.closeSync(outputFd);
    }
    expect(fs.statSync(output).size).toBe(4 * 1024 * 1024);
    expect(fs.readFileSync(output).every(byte => byte === 120)).toBe(true);
  });
});
