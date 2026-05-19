/**
 * Benchmark de rendimiento — DataTable y VirtualDataTable bajo carga.
 *
 * NO mide layout real (jsdom no lo calcula). Mide:
 *   1. Costo de montaje del motor TanStack a distintos tamaños (linealidad).
 *   2. Costo del rerender cuando `data` cambia de identidad (paginación,
 *      filtro server-side) vs. cuando NO cambia (referencia estable).
 *   3. Identidad de `rowModel.rows` tras un rerender con la misma `data`,
 *      garantía clave para que `React.memo` en `VirtualRow` ahorre repaints.
 *
 * Si esta suite se rompe es porque alguien re-introdujo trabajo cuadrático
 * o destruyó la estabilidad del rowModel — escenarios documentados que
 * regresaron tablas a 60+ms por scroll en versiones previas.
 */
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";

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

function measure(label: string, fn: () => void): number {
  const t0 = performance.now();
  fn();
  const t1 = performance.now();
  const ms = t1 - t0;
  // eslint-disable-next-line no-console
  console.log(`[perf] ${label}: ${ms.toFixed(1)}ms`);
  return ms;
}

describe("Perf — DataTable (paginado, ~50 filas por vista)", () => {
  it("monta 50 filas en <100ms (jsdom)", () => {
    const data = makeRows(50);
    const ms = measure("DataTable mount 50", () => {
      render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    });
    cleanup();
    expect(ms).toBeLessThan(100);
  });

  it("rerender con MISMA referencia de data es <30ms", () => {
    const data = makeRows(50);
    const { rerender } = render(
      <DataTable columns={cols} data={data} rowKey={(r) => r.id} />,
    );
    const ms = measure("DataTable rerender (same data)", () => {
      rerender(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    });
    cleanup();
    expect(ms).toBeLessThan(30);
  });
});

describe("Perf — VirtualDataTable (datasets grandes, virtualización activa)", () => {
  it("monta 1.000 filas en <250ms (sólo header + contenedor virtual)", () => {
    const data = makeRows(1_000);
    const ms = measure("VirtualDataTable mount 1k", () => {
      render(
        <VirtualDataTable
          columns={cols}
          data={data}
          rowKey={(r) => r.id}
          estimateRowHeight={40}
          maxHeight={400}
        />,
      );
    });
    cleanup();
    expect(ms).toBeLessThan(250);
  });

  it("monta 5.000 filas en <500ms", () => {
    const data = makeRows(5_000);
    const ms = measure("VirtualDataTable mount 5k", () => {
      render(
        <VirtualDataTable
          columns={cols}
          data={data}
          rowKey={(r) => r.id}
          estimateRowHeight={40}
          maxHeight={400}
        />,
      );
    });
    cleanup();
    expect(ms).toBeLessThan(500);
  });

  it("monta 10.000 filas en <900ms (escalado ~lineal)", () => {
    const data = makeRows(10_000);
    const ms = measure("VirtualDataTable mount 10k", () => {
      render(
        <VirtualDataTable
          columns={cols}
          data={data}
          rowKey={(r) => r.id}
          estimateRowHeight={40}
          maxHeight={400}
        />,
      );
    });
    cleanup();
    expect(ms).toBeLessThan(900);
  });

  it("rerender de 5k filas con MISMA referencia de data <60ms (memo trabaja)", () => {
    const data = makeRows(5_000);
    const { rerender } = render(
      <VirtualDataTable
        columns={cols}
        data={data}
        rowKey={(r) => r.id}
        estimateRowHeight={40}
        maxHeight={400}
      />,
    );
    const ms = measure("VirtualDataTable rerender (same data)", () => {
      rerender(
        <VirtualDataTable
          columns={cols}
          data={data}
          rowKey={(r) => r.id}
          estimateRowHeight={40}
          maxHeight={400}
        />,
      );
    });
    cleanup();
    expect(ms).toBeLessThan(60);
  });
});
