import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

export async function inspectPdf(name: string, document: Parameters<typeof renderToBuffer>[0]) {
  const buffer = await renderToBuffer(document);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  expect(buffer.length).toBeGreaterThan(2000);
  mkdirSync("reports/pdf-smoke", { recursive: true });
  const path = resolve("reports/pdf-smoke", name + ".pdf");
  writeFileSync(path, buffer);
  // CI uses Poppler. Local bundled pypdf is an explicit alternative, not a silent skip.
  if (process.env.PDF_PYTHON) {
    const result = JSON.parse(execFileSync(process.env.PDF_PYTHON, ["scripts/testing/inspect-pdf.py", path], { encoding: "utf8" })) as { pages: number; text: string };
    return { ...result, text: normalizeText(result.text) };
  }
  const info = execFileSync(process.env.PDFINFO_BINARY ?? "pdfinfo", [path], { encoding: "utf8" });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  expect(pages).toBeGreaterThan(0);
  const text = execFileSync(process.env.PDFTOTEXT_BINARY ?? "pdftotext", ["-layout", path, "-"], { encoding: "utf8" });
  return { pages, text: normalizeText(text) };
}

// PDF layout inserts whitespace/hyphenation, not changes to fiscal labels.
function normalizeText(text: string) {
  return text.replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ");
}
