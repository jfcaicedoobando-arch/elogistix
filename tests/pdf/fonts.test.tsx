import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { build } from "vite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Font } from "@react-pdf/renderer";
import { registerPdfFonts } from "../../src/pdf/theme/fonts";
import { FONTS } from "../../src/pdf/theme/tokens";

const sourceUrl = new URL("../../src/pdf/theme/fonts.ts", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");
const filenames = ["Inter-Regular.ttf", "Inter-SemiBold.ttf", "Inter-Italic.ttf"];

// Execute the actual module with an explicit import.meta.url and runtime globals.
// Only registration is captured; URL decoding always uses Node's native converter.
function evaluate(code: string, moduleUrl: string, globals: Record<string, unknown> = {}) {
  const register = vi.fn();
  const exports = {} as { registerPdfFonts: () => void };
  const compiled = ts.transpileModule(code.replaceAll("import.meta.url", "__moduleUrl"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    URL, exports, __moduleUrl: moduleUrl, ...globals,
    require(id: string) {
      if (id === "@react-pdf/renderer") return { Font: { register } };
      if (id === "./tokens") return { FONTS };
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  exports.registerPdfFonts();
  exports.registerPdfFonts();
  return register.mock.calls.map(([registration]) => registration);
}

function expectedRegistrations(resolve: (filename: string) => string) {
  const [regular, semibold, italic] = filenames.map(resolve);
  return [
    { family: FONTS.regular, fonts: [
      { src: regular, fontWeight: 400 },
      { src: semibold, fontWeight: 600 },
      { src: semibold, fontWeight: 700 },
      { src: italic, fontStyle: "italic" },
    ] },
    { family: FONTS.bold, fonts: [
      { src: semibold }, { src: semibold, fontWeight: 700 },
      { src: italic, fontStyle: "italic" },
    ] },
    { family: FONTS.oblique, src: italic },
  ];
}

function nodeRuntime(windows: boolean) {
  return { process: { getBuiltinModule(id: string) {
    expect(id).toBe("node:url");
    return { fileURLToPath: (url: URL) => fileURLToPath(url, { windows }) };
  } } };
}

const fileCases = [
  { name: "POSIX plain", base: "file:///home/qa/src/pdf/theme/fonts.ts", windows: false },
  { name: "POSIX spaces and Unicode", base: "file:///home/QA%20M%C3%A9xico/src/pdf/theme/fonts.ts", windows: false },
  { name: "POSIX literal percent and hash", base: "file:///home/QA%25%23/src/pdf/theme/fonts.ts", windows: false },
  { name: "Windows drive", base: "file:///C:/qa/src/pdf/theme/fonts.ts", windows: true },
  { name: "Windows spaces and Unicode", base: "file:///C:/QA%20M%C3%A9xico/src/pdf/theme/fonts.ts", windows: true },
  { name: "Windows literal percent and hash", base: "file:///C:/QA%25%23/src/pdf/theme/fonts.ts", windows: true },
  { name: "Windows UNC", base: "file://server/share/QA%20PDF/src/pdf/theme/fonts.ts", windows: true },
];

describe("PDF font URL contracts", () => {
  // windows:true tests the native conversion contract, not a Windows filesystem.
  it.each(fileCases)("decodes $name and preserves all eight mappings idempotently", ({ base, windows }) => {
    expect(evaluate(source, base, nodeRuntime(windows))).toEqual(expectedRegistrations(
      (filename) => fileURLToPath(new URL(`../assets/${filename}`, base), { windows }),
    ));
  });

  it("uses the real builtin supplied by supported Node runtimes", () => {
    expect(typeof process.getBuiltinModule).toBe("function");
    expect(evaluate(source, sourceUrl.href, { process })).toEqual(expectedRegistrations(
      (filename) => fileURLToPath(new URL(`../assets/${filename}`, sourceUrl)),
    ));
  });

  it.each([
    "https://example.test/assets/fonts.js",
    "https://example.test/QA%20M%C3%A9xico/assets/fonts.js",
    "http://localhost:5173/src/pdf/theme/fonts.ts",
  ])("preserves browser URLs without a process global: %s", (base) => {
    expect(evaluate(source, base)).toEqual(expectedRegistrations(
      (filename) => new URL(`../assets/${filename}`, base).href,
    ));
  });

  it("ignores a browser process shim without getBuiltinModule", () => {
    const base = "https://example.test/assets/fonts.js";
    expect(evaluate(source, base, { process: {} })).toEqual(expectedRegistrations(
      (filename) => new URL(`../assets/${filename}`, base).href,
    ));
  });

  it("propagates native invalid-path errors instead of returning a broken fallback", () => {
    expect(() => evaluate(source, "file:///home/bad%2Fdir/src/pdf/theme/fonts.ts", nodeRuntime(false)))
      .toThrow(/encoded/i);
    expect(() => evaluate(source, "file://server/share/src/pdf/theme/fonts.ts", nodeRuntime(false)))
      .toThrow(/host/i);
  });

  it("keeps the three original TTF assets in a process-free Vite browser bundle", async () => {
    const result = await build({
      root: fileURLToPath(new URL("../..", import.meta.url)),
      configFile: false, logLevel: "silent",
      build: {
        write: false, assetsInlineLimit: 0, minify: false,
        rollupOptions: {
          input: fileURLToPath(sourceUrl),
          external: ["@react-pdf/renderer"], preserveEntrySignatures: "strict",
        },
      },
    });
    if ("on" in result) throw new Error("Unexpected Vite watch build");
    const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
    const chunks = output.filter((item) => item.type === "chunk");
    const assets = output.filter((item) => item.type === "asset");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].imports).toEqual(["@react-pdf/renderer"]);
    expect(assets).toHaveLength(3);
    const assetUrls = new Map<string, string>();
    for (const asset of assets) {
      const bytes = Buffer.from(asset.source);
      const original = filenames.find((filename) => bytes.equals(
        readFileSync(new URL(`../../src/pdf/assets/${filename}`, import.meta.url)),
      ));
      expect(original).toBeDefined();
      assetUrls.set(original!, new URL(`/${asset.fileName}`, "https://example.test").href);
    }
    expect(assetUrls.size).toBe(3);
    expect(evaluate(chunks[0].code, `https://example.test/${chunks[0].fileName}`))
      .toEqual(expectedRegistrations((filename) => assetUrls.get(filename)!));
  });
});

describe("real local Inter source loading", () => {
  beforeAll(() => { registerPdfFonts(); registerPdfFonts(); });
  it.each([
    { fontFamily: FONTS.regular, fontWeight: 400, fontStyle: "normal" },
    { fontFamily: FONTS.regular, fontWeight: 600, fontStyle: "normal" },
    { fontFamily: FONTS.regular, fontWeight: 700, fontStyle: "normal" },
    { fontFamily: FONTS.regular, fontWeight: 400, fontStyle: "italic" },
    { fontFamily: FONTS.bold, fontWeight: 400, fontStyle: "normal" },
    { fontFamily: FONTS.bold, fontWeight: 700, fontStyle: "normal" },
    { fontFamily: FONTS.bold, fontWeight: 400, fontStyle: "italic" },
    { fontFamily: FONTS.oblique, fontWeight: 400, fontStyle: "normal" },
  ] as const)("loads $fontFamily $fontWeight $fontStyle through fontkit", async (descriptor) => {
    await Font.load(descriptor);
    expect(Font.getFont(descriptor).data).not.toBeNull();
  });
});
