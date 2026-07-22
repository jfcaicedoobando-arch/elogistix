/**
 * Smoke test: garantiza que los estados de NC estén mapeados a los tonos
 * semánticos correctos vía la config NC_TONES que consume ToneBadge.
 * v13.308.4: post-unificación (v13.307.19) los literales de badge ya no
 * viven inline en la sección — se derivan de badgeTone.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../NotasCreditoSection.tsx"),
  "utf8",
);

describe("NotasCreditoSection — badges tokenizados", () => {
  it('badge "Aplicada" está mapeado al tono success', () => {
    expect(src).toMatch(/Aplicada:\s*\{\s*tone:\s*"success"/);
  });

  it('badge "Aprobada" está mapeado al tono info', () => {
    expect(src).toMatch(/Aprobada:\s*\{\s*tone:\s*"info"/);
  });

  it("no reintroduce literales sky/green/emerald de Tailwind", () => {
    expect(src).not.toMatch(/(bg|text|border)-(sky|green|emerald)-\d{2,3}/);
  });
});
