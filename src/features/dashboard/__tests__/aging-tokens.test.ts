/**
 * Guardrail del Lote 3B, actualizado en v13.682.0 (UI-2).
 *
 * Los componentes de aging ya no escriben `bg-aging-N` a mano: consumen la
 * escala única de `@/lib/aging/buckets`. Este test verifica que sigan usando
 * los 5 niveles del catálogo y que no reaparezcan literales de color.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGING_FILL_CLASS, AGING_SOFT_CLASS } from "@/lib/aging/buckets";

const cobranza = readFileSync(
  resolve(__dirname, "../finance/components/CobranzaBlock.tsx"),
  "utf8",
);
const cartera = readFileSync(
  resolve(__dirname, "../direccion/components/CarteraSection.tsx"),
  "utf8",
);

describe("aging — tokens de severidad", () => {
  it("la escala central sigue apuntando a los tokens aging-1..5", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(AGING_FILL_CLASS[level]).toBe(`bg-aging-${level}`);
      expect(AGING_SOFT_CLASS[level]).toContain(`bg-aging-${level}/`);
    }
  });

  it("CobranzaBlock usa los 5 niveles de la escala compartida", () => {
    expect(cobranza).toContain('from "@/lib/aging/buckets"');
    for (const level of [1, 2, 3, 4, 5]) {
      expect(cobranza).toContain(`AGING_SOFT_CLASS[${level}]`);
    }
  });

  it("CobranzaBlock no reintroduce literales red/orange", () => {
    expect(cobranza).not.toMatch(/(bg|text|border)-(red|orange|amber|emerald)-\d{2,3}/);
  });

  it("CarteraSection mapea los 4 buckets a los niveles 1/2/3/5", () => {
    expect(cartera).toContain('from "@/lib/aging/buckets"');
    expect(cartera).toMatch(/"Corriente":\s*AGING_FILL_CLASS\[1\]/);
    expect(cartera).toMatch(/"1-30":\s*AGING_FILL_CLASS\[2\]/);
    expect(cartera).toMatch(/"31-60":\s*AGING_FILL_CLASS\[3\]/);
    expect(cartera).toMatch(/"\+60":\s*AGING_FILL_CLASS\[5\]/);
  });

  it("CarteraSection no reintroduce literales emerald/amber/orange", () => {
    expect(cartera).not.toMatch(/bg-(emerald|amber|orange)-\d{2,3}/);
  });
});
