/**
 * Benchmark de rendimiento — DataTable y VirtualDataTable bajo carga.
 *
 * NO mide layout real (jsdom no lo calcula). Mide:
 *   1. Costo de montaje del motor TanStack a distintos tamaños (linealidad).
 *   2. Costo del rerender cuando `data` cambia de identidad (paginación,
 *      filtro server-side) vs. cuando NO cambia (referencia estable).
 *
 * Estabilidad en CI: cada medición es la **mediana** de N corridas con
 * warmup descartado y `cleanup()` entre corridas. Umbrales mixtos:
 *   - Ceiling absoluto generoso (catch regresiones catastróficas).
 *   - Linealidad relativa al baseline 1k del mismo runner (catch O(n²)).
 *   - Rerenders comparados contra su propio mount (catch pérdida de memo).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { render as rtlRender, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

interface Row {
  id: string;
  numero: string;
  cliente: string;
  total: number;
  etd: string;
}

function makeRows(n: number): Row[] {
  const clientes = ["ACME", "Globex", "Initech", "Umbrella", "Stark", "Wayne"];
  const out: Row[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      id: `r-${i}`,
      numero: `EMB-${String(i).padStart(6, "0")}`,
      cliente: clientes[i % clientes.length],
      total: ((i * 9301 + 49297) % 100000) / 100,
      etd: new Date(2024, 0, 1 + (i % 365)).toISOString(),
    };
  }
  return out;
}

const cols: ColumnDef<Row, unknown>[] = defineColumns<Row>([
  { id: "numero", header: "Número", accessorFn: (r) => r.numero, enableSorting: true,
    sortingFn: sortByString<Row>((r) => r.numero), cell: ({ row }) => row.original.numero,
    meta: { width: "180px" } },
  { id: "cliente", header: "Cliente", accessorFn: (r) => r.cliente, enableSorting: true,
    sortingFn: sortByString<Row>((r) => r.cliente), cell: ({ row }) => row.original.cliente,
    meta: { width: "160px" } },
  { id: "total", header: "Total", accessorFn: (r) => r.total, enableSorting: true,
    sortingFn: sortByNumber<Row>((r) => r.total), cell: ({ row }) => row.original.total,
    meta: { width: "120px", align: "right" } },
  { id: "etd", header: "ETD", accessorFn: (r) => r.etd,
    cell: ({ row }) => row.original.etd, meta: { width: "140px" } },
]) as ColumnDef<Row, unknown>[];

/** Intenta forzar GC si Node corre con --expose-gc. No-op en otro caso. */
function tryGc(): void {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") g.gc();
}

/** Mide N corridas con 1 warmup descartado. Retorna {min, median, max}. */
function measureMedian(
  label: string,
  fn: () => void,
  runs = 5,
): { min: number; median: number; max: number } {
  // Warmup descartado (amortiza JIT y caches de TanStack).
  fn();
  cleanup();
  tryGc();

  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    tryGc();
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
    cleanup();
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(runs / 2)];
  const min = samples[0];
  const max = samples[runs - 1];

  console.log(
    `[perf] ${label}: median=${median.toFixed(1)}ms min=${min.toFixed(1)} max=${max.toFixed(1)} (n=${runs})`,
  );
  return { min, median, max };
}

describe("Perf — DataTable (paginado, ~50 filas por vista)", () => {
  it("monta 50 filas dentro del ceiling de sanidad", () => {
    const data = makeRows(50);
    const { median } = measureMedian("DataTable mount 50", () => {
      render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    });
    // Ceiling generoso ajustado para runners de 1 núcleo (CI shards).
    expect(median).toBeLessThan(500);
  });

  it("rerender con MISMA referencia de data es sustancialmente más barato que el mount", () => {
    const data = makeRows(50);

    const mount = measureMedian("DataTable mount 50 (baseline rerender)", () => {
      render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    });

    // Para rerender necesitamos un árbol vivo durante toda la medición.
    const rerenderSamples: number[] = [];
    const warmup = render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    warmup.rerender(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    cleanup();
    for (let i = 0; i < 5; i++) {
      tryGc();
      const { rerender } = render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
      const t0 = performance.now();
      rerender(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
      const t1 = performance.now();
      rerenderSamples.push(t1 - t0);
      cleanup();
    }
    rerenderSamples.sort((a, b) => a - b);
    const medianRerender = rerenderSamples[2];
    console.log(`[perf] DataTable rerender same-data: median=${medianRerender.toFixed(1)}ms`);

    // Lo importante: rerender ≤ 50% del mount. Si TanStack pierde memoización,
    // el rerender se acerca al mount y este test falla.
    expect(medianRerender).toBeLessThan(Math.max(30, mount.median * 0.6));
  });
});

describe("Perf — VirtualDataTable (datasets grandes, escalado lineal)", () => {
  let baseline1k = 0;

  beforeAll(() => {
    const data = makeRows(1_000);
    const { median } = measureMedian("VirtualDataTable mount 1k (baseline)", () => {
      render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
    });
    baseline1k = Math.max(median, 1); // Evita división por 0 en runners ultra-rápidos.
  });

  it("monta 1.000 filas dentro del ceiling de sanidad", () => {
    const data = makeRows(1_000);
    const { median } = measureMedian("VirtualDataTable mount 1k", () => {
      render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
    });
    expect(median).toBeLessThan(1200);
  });

  it("monta 5.000 filas con escalado ~lineal vs 1k baseline", () => {
    const data = makeRows(5_000);
    const { median } = measureMedian("VirtualDataTable mount 5k", () => {
      render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
    });
    // Lineal sería ×5; toleramos ×8 (overhead constante + jitter de runner).
    expect(median).toBeLessThan(Math.max(1200, baseline1k * 8));
  });

  it("monta 10.000 filas con escalado ~lineal vs 1k baseline", () => {
    const data = makeRows(10_000);
    const { median } = measureMedian("VirtualDataTable mount 10k", () => {
      render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
    }, 3); // n=3 para no alargar la suite.
    // Lineal sería ×10; toleramos ×15.
    expect(median).toBeLessThan(Math.max(2200, baseline1k * 15));
  });

  it("rerender de 5k filas con MISMA referencia es sustancialmente más barato que el mount", () => {
    const data = makeRows(5_000);

    const mount = measureMedian("VirtualDataTable mount 5k (baseline rerender)", () => {
      render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
    }, 3);

    const rerenderSamples: number[] = [];
    const warmup = render(
      <VirtualDataTable
        columns={cols} data={data} rowKey={(r) => r.id}
        estimateRowHeight={40} maxHeight={400}
      />,
    );
    warmup.rerender(
      <VirtualDataTable
        columns={cols} data={data} rowKey={(r) => r.id}
        estimateRowHeight={40} maxHeight={400}
      />,
    );
    cleanup();
    for (let i = 0; i < 5; i++) {
      tryGc();
      const { rerender } = render(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
      const t0 = performance.now();
      rerender(
        <VirtualDataTable
          columns={cols} data={data} rowKey={(r) => r.id}
          estimateRowHeight={40} maxHeight={400}
        />,
      );
      const t1 = performance.now();
      rerenderSamples.push(t1 - t0);
      cleanup();
    }
    rerenderSamples.sort((a, b) => a - b);
    const medianRerender = rerenderSamples[2];
    console.log(`[perf] VirtualDataTable rerender 5k same-data: median=${medianRerender.toFixed(1)}ms`);

    // ≤40% del mount: si memo se rompe, el rerender se acerca al mount.
    expect(medianRerender).toBeLessThan(Math.max(80, mount.median * 0.5));
  });
});
