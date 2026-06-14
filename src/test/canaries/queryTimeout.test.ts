/**
 * Canary de performance — Phase 4.1 (Auditoría 13.14.0).
 *
 * Asegura que utilidades de cálculo críticas que se ejecutan en cliente
 * permanecen rápidas en CPU CI. Si una optimización regresiona o se introduce
 * un O(n²) accidental en módulos hot, este canary falla en milisegundos.
 *
 * No mide RTT a red — usa puro JS determinista. Umbrales conservadores para
 * evitar flakiness; subir si el runner de CI es persistentemente lento.
 */
import { describe, it, expect } from "vitest";
import { sumarEnMoneda } from "@/lib/financial/costosUSD";

const BUDGET_MS = 50;

function measure(label: string, fn: () => void) {
  const start = performance.now();
  fn();
  const ms = performance.now() - start;
  return { label, ms };
}

describe("canary: query timeout / hot-path performance", () => {
  it("sumarEnMoneda procesa 5 000 conceptos en <50ms", () => {
    const items = Array.from({ length: 5000 }, (_, i) => ({
      monto: 100 + (i % 17),
      moneda: i % 3 === 0 ? "USD" : i % 3 === 1 ? "MXN" : "EUR",
    }));
    const { ms } = measure("sumarEnMoneda x5000", () => {
      sumarEnMoneda(items, "USD", 18.5, 20.1);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("sumarEnMoneda homogéneo procesa 10 000 conceptos en <50ms", () => {
    const items = Array.from({ length: 10000 }, () => ({ monto: 100, moneda: "USD" }));
    const { ms } = measure("sumarEnMoneda x10000 USD", () => {
      sumarEnMoneda(items, "USD", 18.5, 20.1);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("agrupado en Map de 10 000 entradas en <30ms", () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      key: `cliente-${i % 200}`,
      monto: i,
    }));
    const { ms } = measure("Map agrupado x10000", () => {
      const m = new Map<string, number>();
      for (const it of items) m.set(it.key, (m.get(it.key) ?? 0) + it.monto);
      return m;
    });
    expect(ms).toBeLessThan(30);
  });
});
