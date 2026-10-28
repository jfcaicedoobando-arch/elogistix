import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(new URL("../../package.json", import.meta.url));

// Resolve at each actual consumer: a safe hoisted copy must not hide a stale
// nested dependency left by an incremental install.
function dependency(consumer, name) {
  const entry = consumer.resolve(name);
  for (let directory = path.dirname(entry); ; directory = path.dirname(directory)) {
    const file = path.join(directory, "package.json");
    if (existsSync(file)) {
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      if (manifest.name === name) return { manifest, entry, require: createRequire(entry) };
    }
    assert.notEqual(path.dirname(directory), directory, `Missing manifest for ${name}`);
  }
}

const compiler = dependency(require, "eslint-plugin-react-compiler");
const babel = dependency(compiler.require, "@babel/core");
const semver = babel.require("semver");
const queryTools = dependency(require, "@tanstack/react-query-devtools");
const devtools = dependency(queryTools.require, "@tanstack/query-devtools");
const solid = dependency(devtools.require, "solid-js");
const seroval = dependency(solid.require, "seroval");
const eslint = dependency(require, "eslint");
const minimatch = dependency(eslint.require, "minimatch");
const jsdom = dependency(require, "jsdom");
const legacyTailwind = dependency(dependency(require, "lovable-tagger").require, "tailwindcss");
const nested = dependency(legacyTailwind.require, "postcss-nested");

test("security patches resolve through consumers within their declared families", () => {
  const checks = [
    [require, "zod", "4.6.7", "4"],
    [compiler.require, "@babel/core", "7.29.6", "7"],
    [devtools.require, "solid-js", "1.9.16", "1"],
    [solid.require, "seroval", "1.6.11", "1"],
    [solid.require, "seroval-plugins", "1.6.8", "1"],
    [jsdom.require, "undici", "8.12.2", "8"],
    [minimatch.require, "brace-expansion", "5.0.12", "5"],
    [nested.require, "postcss-selector-parser", "6.1.5", "6"],
    [dependency(jsdom.require, "css-tree").require, "source-map-js", "1.2.2", "1"],
    [dependency(require, "magicast").require, "source-map-js", "1.2.2", "1"],
  ];
  for (const [consumer, name, minimum, major] of checks) {
    const version = dependency(consumer, name).manifest.version;
    assert.equal(version.split(".")[0], major, `${name}: preserve consumer major`);
    assert.ok(semver.gte(version, minimum), `${name}: ${version} must be >= ${minimum}`);
  }
  assert.ok(semver.satisfies(solid.manifest.version, devtools.manifest.dependencies["solid-js"]));
  assert.ok(semver.satisfies(seroval.manifest.version, solid.manifest.dependencies.seroval));
  // This compatibility check does not claim to fix GHSA-3pfx-gxff-vg76:
  // its 1.7.2 patch is outside the published Solid ~1.6.x contract.
  assert.ok(semver.satisfies(seroval.manifest.version, "~1.6.8"));
});

test("Zod 4 application validation and the compiler's Zod 3 remain independent", () => {
  const { z } = require("zod");
  const invoice = z.object({
    currency: z.enum(["MXN", "USD"]),
    lines: z.array(z.object({ amount: z.number().nonnegative() })).min(1).max(3),
  });
  assert.deepEqual(invoice.parse({ currency: "MXN", lines: [{ amount: 42 }] }),
    { currency: "MXN", lines: [{ amount: 42 }] });
  assert.equal(invoice.safeParse({ currency: "EUR", lines: [{ amount: -1 }] }).success, false);
  assert.equal(invoice.safeParse({ currency: "MXN", lines: Array(4).fill({ amount: 1 }) }).success, false);
  const compilerZod = dependency(compiler.require, "zod");
  assert.equal(compilerZod.manifest.version.split(".")[0], "3");
  assert.ok(semver.satisfies(compilerZod.manifest.version, compiler.manifest.dependencies.zod));
  assert.equal(compiler.require("zod").z.string().parse("compiler"), "compiler");
});

test("bounded Zod collections reject size before preprocessing their elements", () => {
  // GHSA-mrhx-c7xc-m3w5: an oversized collection must not pay the cost of
  // visiting every element before its maximum-size validation rejects it.
  const { z } = require("zod");
  for (const kind of ["array", "set", "map"]) {
    let visits = 0;
    const value = z.preprocess((input) => { visits += 1; return input; }, z.string());
    const schema = kind === "array" ? z.array(value).max(2)
      : kind === "set" ? z.set(value).max(2) : z.map(value, value).max(2);
    const input = kind === "array" ? ["a", "b", "c"]
      : kind === "set" ? new Set(["a", "b", "c"])
      : new Map([["a", "1"], ["b", "2"], ["c", "3"]]);
    const result = schema.safeParse(input);
    assert.equal(result.success, false, kind);
    assert.deepEqual(result.error.issues.map((issue) => issue.code), ["too_big"], kind);
    assert.equal(visits, 0, `${kind}: do not preprocess oversized input`);
  }
  let validVisits = 0;
  const valid = z.array(z.preprocess((input) => { validVisits += 1; return input; }, z.string())).max(2);
  assert.deepEqual(valid.parse(["a", "b"]), ["a", "b"]);
  assert.equal(validVisits, 2);
});

test("Solid's compatible Seroval family round-trips trusted built-in values and references", () => {
  const { toJSON, fromJSON } = solid.require("seroval");
  const shared = { amount: 42n };
  const original = {
    first: shared,
    again: shared,
    date: new Date("2026-10-28T00:00:00.000Z"),
    pattern: /^invoice-\d+$/iu,
    map: new Map([["line", shared]]),
    set: new Set(["MXN", "USD"]),
  };
  const result = fromJSON(toJSON(original));
  assert.deepEqual(result, original);
  assert.equal(result.first, result.again);
  assert.equal(result.map.get("line"), result.first);
  assert.equal(result.pattern.test("INVOICE-42"), true);
});

test("the compiler's Babel preserves private methods and source-map provenance", () => {
  const source = "class Invoice { #amount() { return 42; } total() { return this.#amount(); } } module.exports = new Invoice().total();";
  const output = compiler.require("@babel/core").transformSync(source, {
    filename: "dependency-invoice.js",
    configFile: false,
    babelrc: false,
    sourceMaps: true,
    plugins: [compiler.require.resolve("@babel/plugin-proposal-private-methods")],
  });
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module }, { timeout: 1000 });
  assert.equal(module.exports, 42);
  assert.deepEqual(output.map.sourcesContent, [source]);
  assert.ok(output.map.sources.includes("dependency-invoice.js"));
});

test("minimatch keeps nested alternatives, numeric sequences and escaped literals", () => {
  const { expand } = minimatch.require("brace-expansion");
  assert.deepEqual(expand("invoice-{01..03}.{pdf,csv}"), [
    "invoice-01.pdf", "invoice-01.csv", "invoice-02.pdf", "invoice-02.csv", "invoice-03.pdf", "invoice-03.csv",
  ]);
  assert.deepEqual(expand("{invoice,{credit,receipt}}-42"), ["invoice-42", "credit-42", "receipt-42"]);
  assert.deepEqual(expand("invoice-\\{draft\\}"), ["invoice-{draft}"]);
  const { minimatch: match } = eslint.require("minimatch");
  assert.equal(match("src/invoice.test.tsx", "src/**/*.{ts,tsx}"), true);
  assert.equal(match("src/invoice.sql", "src/**/*.{ts,tsx}"), false);
});

test("legacy Tailwind's PostCSS consumer preserves nested selectors and escapes", async () => {
  const postcss = legacyTailwind.require("postcss");
  const result = await postcss([legacyTailwind.require("postcss-nested")])
    .process(".invoice { & > .line { color: red; } }", { from: undefined });
  assert.equal(result.root.first.selector, ".invoice > .line");
  assert.equal(result.root.first.first.prop, "color");
  const parse = nested.require("postcss-selector-parser");
  const selector = ".invoice\\:pending:is(.draft,.approved)::before";
  const ast = parse().astSync(selector);
  assert.equal(ast.toString(), selector);
  assert.equal(ast.first.first.value, "invoice:pending");
  assert.equal(ast.first.nodes.filter((node) => node.type === "pseudo").length, 2);
});

test("css-tree and magicast consume patched synchronous source maps", () => {
  for (const consumer of [dependency(jsdom.require, "css-tree"), dependency(require, "magicast")]) {
    const { SourceMapGenerator, SourceMapConsumer } = consumer.require("source-map-js");
    const map = new SourceMapGenerator({ file: "invoice.js" });
    map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 7, column: 2 }, source: "invoice.ts", name: "total" });
    map.setSourceContent("invoice.ts", "const total: number = 42;");
    const decoded = new SourceMapConsumer(map.toJSON());
    assert.deepEqual(decoded.originalPositionFor({ line: 1, column: 0 }),
      { source: "invoice.ts", line: 7, column: 2, name: "total" });
    assert.equal(decoded.sourceContentFor("invoice.ts"), "const total: number = 42;");
  }
});

test("jsdom's Undici rejects excessive encodings without a later process crash", { timeout: 10000 }, () => {
  // GHSA-xjj6-f33q-929c: isolate the malformed-response case so an old copy
  // cannot terminate the surrounding runner. Only a loopback TCP server is used.
  const undiciEntry = dependency(jsdom.require, "undici").entry;
  const script = `
    import assert from "node:assert/strict";
    import { createRequire } from "node:module";
    import { createServer } from "node:net";
    import { setTimeout as wait } from "node:timers/promises";
    const require = createRequire(${JSON.stringify(undiciEntry)});
    const { fetch, Agent } = require(${JSON.stringify(undiciEntry)});
    const server = createServer(socket => socket.once("data", () => socket.end(
      "HTTP/1.1 200 OK\\r\\nContent-Length: 100\\r\\nContent-Encoding: gzip,gzip,gzip,gzip,gzip,gzip\\r\\nConnection: close\\r\\n\\r\\n")));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const dispatcher = new Agent();
    try {
      await assert.rejects(() => fetch("http://127.0.0.1:" + server.address().port,
        { dispatcher, signal: AbortSignal.timeout(2000) }));
      await wait(200);
      process.stdout.write("survived-malformed-response\\n");
    } finally {
      await dispatcher.close();
      await new Promise(resolve => server.close(resolve));
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 7000,
    windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP },
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /survived-malformed-response/);
});
