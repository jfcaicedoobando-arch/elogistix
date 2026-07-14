/**
 * Smoke test: garantiza que los badges de estado de nota de crédito usen
 * tokens semánticos (success/info) y no literales de paleta Tailwind.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../NotasCreditoSection.tsx"),
  "utf8",
);

describe("NotasCreditoSection — badges tokenizados", () => {
  it('badge "Aplicada" usa token success', () => {
    expect(src).toMatch(/bg-success\/15 text-success border-success\/30/);
  });

  it('badge "Aprobada" usa token info', () => {
    expect(src).toMatch(/bg-info\/15 text-info border-info\/30/);
  });

  it("no reintroduce literales sky/green de Tailwind", () => {
    expect(src).not.toMatch(/(bg|text|border)-(sky|green|emerald)-\d{2,3}/);
  });
});
