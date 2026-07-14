/**
 * Guardrail del Lote 3B — los componentes de aging (cartera vencida) deben
 * usar los tokens `bg-aging-{1..5}` en lugar de literales emerald/amber/red.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cobranza = readFileSync(
  resolve(__dirname, "../finance/components/CobranzaBlock.tsx"),
  "utf8",
);
const cartera = readFileSync(
  resolve(__dirname, "../direccion/components/CarteraSection.tsx"),
  "utf8",
);

describe("aging — tokens de severidad", () => {
  it("CobranzaBlock usa la escala aging-1..5 (5 buckets)", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(cobranza).toMatch(new RegExp(`bg-aging-${level}/`));
    }
  });

  it("CobranzaBlock no reintroduce literales red/orange", () => {
    expect(cobranza).not.toMatch(/(bg|text|border)-(red|orange|amber|emerald)-\d{2,3}/);
  });

  it("CarteraSection mapea los 4 buckets a aging-1/2/3/5", () => {
    expect(cartera).toMatch(/"Corriente":\s*"bg-aging-1"/);
    expect(cartera).toMatch(/"1-30":\s*"bg-aging-2"/);
    expect(cartera).toMatch(/"31-60":\s*"bg-aging-3"/);
    expect(cartera).toMatch(/"\+60":\s*"bg-aging-5"/);
  });

  it("CarteraSection no reintroduce literales emerald/amber/orange", () => {
    expect(cartera).not.toMatch(/bg-(emerald|amber|orange)-\d{2,3}/);
  });
});
