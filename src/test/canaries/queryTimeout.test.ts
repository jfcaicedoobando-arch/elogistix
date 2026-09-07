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

// Ola 13 · R4TC-02: 50 → 80 ms. El canario y `costosUSD.ts` son byte-idénticos
// a v13.570.2 (no hay regresión de código): en runners de 2 vCPU bajo carga de
// la suite completa el primer test paga el JIT/warm-up del módulo y midió
// 53.27/56.74 ms. 80 ms da ~40% de colchón y sigue siendo canario útil: una
// regresión O(n²) real costaría >10x, no +13%.
const BUDGET_MS = 80;

/**
 * Mide el MEJOR de varias corridas tras un warm-up.
 *
 * Analogía: es como cronometrar a un corredor sólo después de que calentó, y
 * quedarse con su mejor vuelta. Así el canario mide el costo real del
 * algoritmo y no el arranque del motor JS ni el CPU compartido cuando la
 * suite completa corre en paralelo (causa de los flakes previos).
 * Una regresión O(n²) real degrada TODAS las vueltas, así que se sigue viendo.
 */
function measure(label: string, fn: () => void, corridas = 5) {
  fn(); // warm-up: paga JIT y primera carga del módulo.
  let ms = Number.POSITIVE_INFINITY;
  for (let i = 0; i < corridas; i++) {
    const start = performance.now();
    fn();
    ms = Math.min(ms, performance.now() - start);
  }
  return { label, ms };
}


describe("canary: query timeout / hot-path performance", () => {
  it("sumarEnMoneda procesa 5 000 conceptos en <80ms", () => {
    const items = Array.from({ length: 5000 }, (_, i) => ({
      monto: 100 + (i % 17),
      moneda: i % 3 === 0 ? "USD" : i % 3 === 1 ? "MXN" : "EUR",
    }));
    const { ms } = measure("sumarEnMoneda x5000", () => {
      sumarEnMoneda(items, "USD", 18.5, 20.1);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("sumarEnMoneda homogéneo procesa 10 000 conceptos en <80ms", () => {
    const items = Array.from({ length: 10000 }, () => ({ monto: 100, moneda: "USD" }));
    const { ms } = measure("sumarEnMoneda x10000 USD", () => {
      sumarEnMoneda(items, "USD", 18.5, 20.1);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("agrupado en Map de 10 000 entradas en <60ms", () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      key: `cliente-${i % 200}`,
      monto: i,
    }));
    const { ms } = measure("Map agrupado x10000", () => {
      const m = new Map<string, number>();
      for (const it of items) m.set(it.key, (m.get(it.key) ?? 0) + it.monto);
      return m;
    });
    // Ola 14 · R5TC-01: 30 → 60 ms. Misma clase de flake ambiental que
    // R4TC-02 (runner 2 vCPU bajo carga de la suite): midió 38.29 ms en la
    // re-auditoría 5 con código byte-idéntico. Aislado corre en 3-6 ms, así
    // que 60 ms sigue detectando una degradación x2 real; colchón coherente
    // con el 50→80 de los otros dos budgets de este archivo.
    expect(ms).toBeLessThan(60);

  });
});
