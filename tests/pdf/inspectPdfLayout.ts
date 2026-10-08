import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Inspect visible word geometry as well as extraction: clipped glyphs can still extract. */
export function pdfWordBounds(name: string) {
  const xml = execFileSync(process.env.PDFTOTEXT_BINARY ?? "pdftotext", [
    "-bbox-layout", resolve("reports/pdf-smoke", name + ".pdf"), "-",
  ], { encoding: "utf8" });
  return Array.from(xml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)).flatMap(([, pageXml], page) =>
    Array.from(pageXml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g),
      ([, xMin, yMin, xMax, yMax, text]) => ({ page, xMin: Number(xMin), yMin: Number(yMin), xMax: Number(xMax), yMax: Number(yMax), text })));
}
