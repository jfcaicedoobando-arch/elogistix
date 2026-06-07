/**
 * Regresión de fuga de memoria en renderizado repetido de PDFs.
 *
 * Contexto: el shard 3/4 de Vitest sufría OOM acumulativo. Se sospechaba que
 * @react-pdf/renderer + QueryClients no liberados entre suites inflaban el
 * heap sin retorno. Este test renderiza múltiples PDFs en bucle dentro de
 * un mismo proceso y verifica que el heap no crece de forma descontrolada.
 *
 * Estrategia:
 *  - Mockear @react-pdf/renderer con primitives ligeros (igual que otros tests
 *    de Document) para no depender de fontkit/canvas pesados.
 *  - Renderizar N veces el Document, desmontando entre iteraciones.
 *  - Medir heapUsed antes y después; ejecutar global.gc() si está expuesto.
 *  - Tolerancia generosa: < 50 MB de crecimiento neto tras 200 renders.
 *    El objetivo es detectar fugas catastróficas (> cientos de MB), no
 *    micro-fluctuaciones del runtime.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { RentabilidadDocument } from "@/pdf/documents/RentabilidadDocument";

const KPIS = {
  total_venta_usd: 1_000_000,
  total_costo_usd: 600_000,
  total_profit_usd: 400_000,
  margen_promedio: 40,
};

const buildClientes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    cliente_nombre: `Cliente ${i}`,
    total_embarques: i,
    venta_usd: i * 100,
    costo_usd: i * 60,
    profit_usd: i * 40,
    margen: 40,
  }));

const ITERATIONS = 200;
const HEAP_GROWTH_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

const maybeGc = () => {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") g.gc();
};

describe("PDF render — regresión de fuga de memoria", () => {
  it(`renderiza ${ITERATIONS} veces sin acumular heap > 50 MB`, () => {
    const clientes = buildClientes(50);

    // Warm-up: estabiliza módulos cargados antes de medir.
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(
        <RentabilidadDocument
          fechaDesde="2024-01-01"
          fechaHasta="2024-03-31"
          kpis={KPIS}
          clientes={clientes}
        />,
      );
      unmount();
    }
    maybeGc();

    const heapBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < ITERATIONS; i++) {
      const { unmount } = render(
        <RentabilidadDocument
          fechaDesde="2024-01-01"
          fechaHasta="2024-03-31"
          kpis={KPIS}
          clientes={clientes}
        />,
      );
      unmount();
    }

    maybeGc();
    const heapAfter = process.memoryUsage().heapUsed;
    const delta = heapAfter - heapBefore;

    // Log informativo (visible en --reporter=verbose).
    // eslint-disable-next-line no-console
    console.info(
      `[pdf-leak-regression] heap delta tras ${ITERATIONS} renders: ` +
        `${(delta / 1024 / 1024).toFixed(2)} MB`,
    );

    expect(delta).toBeLessThan(HEAP_GROWTH_LIMIT_BYTES);
  });
});
