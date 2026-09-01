import { describe, it, expect } from "vitest";
import { verificarHtmlBundle } from "../../../scripts/lib/verifyHtmlBundle";

const HTML_OK = `<!doctype html><html><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index-abc123.js"></script></body></html>`;

function bundle(source: string) {
  return {
    "index.html": { type: "asset", fileName: "index.html", source },
    "assets/index-abc123.js": { type: "chunk", fileName: "assets/index-abc123.js" },
  };
}

describe("verificarHtmlBundle", () => {
  it("acepta un output válido", () => {
    expect(verificarHtmlBundle(bundle(HTML_OK))).toContain("id=\"root\"");
  });

  it("falla si la compilación no emitió index.html", () => {
    expect(() =>
      verificarHtmlBundle({
        "assets/index-abc123.js": { type: "chunk", fileName: "assets/index-abc123.js" },
      }),
    ).toThrow(/no emitió index.html/);
  });

  it("falla si el HTML no tiene <div id=root>", () => {
    expect(() =>
      verificarHtmlBundle(
        bundle(`<html><body><script src="/assets/index-abc123.js"></script></body></html>`),
      ),
    ).toThrow(/div id=root/);
  });

  it("falla si el HTML no referencia un script de /assets/", () => {
    expect(() =>
      verificarHtmlBundle(bundle(`<html><body><div id="root"></div></body></html>`)),
    ).toThrow(/div id=root/);
  });
});
