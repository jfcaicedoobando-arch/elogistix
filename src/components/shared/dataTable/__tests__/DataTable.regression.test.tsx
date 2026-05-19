/**
 * Pruebas de regresión para DataTable y VirtualDataTable tras el refactor 9.1.0
 * a `@tanstack/react-table`.
 *
 * Cubre los dos patrones de consumo reales del ERP:
 *   1. Embarques  → server-side sort (sortMode="server" + controlledSort + onSortChange)
 *   2. Cotizaciones → mismo patrón, validando que el indicador visual respeta
 *      el estado externo (RPC) y que el click dispara el callback con el id de
 *      la columna y la dirección correcta.
 *
 * No probamos getSortedRowModel client porque ambos call-sites usan server.
 * No medimos virtualización real (jsdom no calcula layout); validamos que
 * VirtualDataTable renderiza filas vía el rowModel de TanStack, no del array.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber, sortByDate, esCollator } from "@/components/shared/dataTable/sortingFns";

// ---------- Fixtures que imitan el shape de Embarques/Cotizaciones --------

interface EmbarqueRow {
  id: string;
  numero: string;
  cliente: string;
  total: number;
}

interface CotizacionRow {
  id: string;
  folio: string;
  cliente: string;
  monto: number;
}

const embarques: EmbarqueRow[] = [
  { id: "e1", numero: "EMB-001", cliente: "ACME", total: 1500 },
  { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
  { id: "e3", numero: "EMB-003", cliente: "Initech", total: 900 },
];

const cotizaciones: CotizacionRow[] = [
  { id: "c1", folio: "COT-100", cliente: "ACME", monto: 500 },
  { id: "c2", folio: "COT-101", cliente: "Globex", monto: 800 },
];

const embarqueColumns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  { id: "numero", header: "Número", enableSorting: true, accessorFn: (r) => r.numero, sortingFn: sortByString<EmbarqueRow>("numero"), cell: ({ row }) => row.original.numero },
  { id: "cliente", header: "Cliente", enableSorting: true, accessorFn: (r) => r.cliente, sortingFn: sortByString<EmbarqueRow>("cliente"), cell: ({ row }) => row.original.cliente },
  { id: "total", header: "Total", enableSorting: true, accessorFn: (r) => r.total, sortingFn: sortByNumber<EmbarqueRow>("total"), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.total },
]) as ColumnDef<EmbarqueRow, unknown>[];

const cotizacionColumns: ColumnDef<CotizacionRow, unknown>[] = defineColumns<CotizacionRow>([
  { id: "folio", header: "Folio", enableSorting: true, accessorFn: (r) => r.folio, sortingFn: sortByString<CotizacionRow>("folio"), cell: ({ row }) => row.original.folio },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente },
  { id: "monto", header: "Monto", enableSorting: true, accessorFn: (r) => r.monto, sortingFn: sortByNumber<CotizacionRow>("monto"), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.monto },
]) as ColumnDef<CotizacionRow, unknown>[];


// ---------- DataTable: render + server sort ----------

describe("DataTable — render", () => {
  it("renderiza headers y filas en el orden recibido (server ya pre-ordenado)", () => {
    render(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-002")).toBeInTheDocument();
    expect(screen.getByText("EMB-003")).toBeInTheDocument();
  });

  it("muestra empty state cuando data está vacía", () => {
    render(
      <DataTable
        columns={embarqueColumns}
        data={[]}
        rowKey={(r) => r.id}
        emptyMessage="Sin embarques"
      />,
    );
    expect(screen.getByText("Sin embarques")).toBeInTheDocument();
  });

  it("dispara onRowClick con la fila correcta", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("EMB-002"));
    expect(onRowClick).toHaveBeenCalledWith(embarques[1]);
  });
});

describe("DataTable — server-side sort (patrón Embarques/Cotizaciones)", () => {
  it("Embarques: ciclo completo asc → desc → null vía onSortChange (columna string)", () => {
    const onSortChange = vi.fn();
    const clienteHeader = () => screen.getByRole("columnheader", { name: /Cliente/ });

    const { rerender } = render(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: null, dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );

    // 1er click: null → asc
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "asc");

    rerender(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "cliente", dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );

    // 2do click: asc → desc
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "desc");

    rerender(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "cliente", dir: "desc" }}
        onSortChange={onSortChange}
      />,
    );

    // 3er click: desc → null (TanStack cicla a unsorted y devolvemos key=null)
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith(null, "asc");
  });

  it("Embarques: columna numérica usa sortDescFirst (primer click → desc)", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: null, dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /Total/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("total", "desc");
  });

  it("Cotizaciones: header no sortable NO dispara onSortChange", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={cotizacionColumns}
        data={cotizaciones}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: null, dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByText("Cliente"));
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("NO reordena el array `data` en cliente cuando sortMode='server'", () => {
    // El servidor ya devolvió desc por total; el componente debe respetarlo
    // sin re-ordenar internamente aunque controlledSort diga otra cosa.
    const serverOrdered: EmbarqueRow[] = [
      { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
      { id: "e1", numero: "EMB-001", cliente: "ACME", total: 1500 },
      { id: "e3", numero: "EMB-003", cliente: "Initech", total: 900 },
    ];
    render(
      <DataTable
        columns={embarqueColumns}
        data={serverOrdered}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "total", dir: "desc" }}
        onSortChange={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("row");
    // rows[0] es el header
    expect(within(rows[1]).getByText("EMB-002")).toBeInTheDocument();
    expect(within(rows[2]).getByText("EMB-001")).toBeInTheDocument();
    expect(within(rows[3]).getByText("EMB-003")).toBeInTheDocument();
  });
});

// ---------- VirtualDataTable ----------

describe("VirtualDataTable — render vía rowModel de TanStack", () => {
  it("renderiza headers a partir de la instancia de TanStack", () => {
    render(
      <VirtualDataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        estimateRowHeight={40}
        maxHeight={400}
      />,
    );
    // jsdom no calcula layout, así que @tanstack/react-virtual reporta 0
    // virtualItems y no monta filas. Lo que sí debe quedar montado es el
    // header proveniente de table.getHeaderGroups(), confirmando que el
    // motor TanStack está activo.
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("muestra empty state cuando no hay filas", () => {
    render(
      <VirtualDataTable
        columns={embarqueColumns}
        data={[]}
        rowKey={(r) => r.id}
        emptyMessage="Sin datos"
      />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

// ---------- Fase 2: ColumnDef nativo + sortingFns ----------

describe("DataTable — ColumnDef nativo (Fase 2)", () => {
  const nativeColumns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
    {
      id: "numero", header: "Número",
      accessorFn: (r) => r.numero, enableSorting: true,
      sortingFn: sortByString<EmbarqueRow>((r) => r.numero),
      meta: { width: "w-[120px]", sticky: true, className: "font-medium" },
      cell: ({ row }) => row.original.numero,
    },
    {
      id: "cliente", header: "Cliente",
      accessorFn: (r) => r.cliente, enableSorting: true,
      sortingFn: sortByString<EmbarqueRow>((r) => r.cliente),
      meta: { align: "left" },
      cell: ({ row }) => row.original.cliente,
    },
    {
      id: "total", header: "Total",
      accessorFn: (r) => r.total, enableSorting: true,
      sortingFn: sortByNumber<EmbarqueRow>((r) => r.total),
      meta: { align: "right", width: "w-[100px]" },
      cell: ({ row }) => row.original.total,
    },
  ]);

  it("renderiza ColumnDef<T>[] nativo sin pasar por adapter", () => {
    render(
      <DataTable
        columns={nativeColumns}
        data={embarques}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-002")).toBeInTheDocument();
    expect(screen.getByText("EMB-003")).toBeInTheDocument();
  });

  it("dispara onSortChange con id de columna nativo", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={nativeColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: null, dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /Cliente/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "asc");
  });
});

describe("sortingFns — colación es-MX y nulls al final", () => {
  interface SR { v: string | null }
  interface NR { n: number | null }
  interface DR { d: string | null }
  // Stub mínimo del Row<T> de TanStack — sólo usamos .original.
  const mkS = (v: string | null) =>
    ({ original: { v } } as unknown as import("@tanstack/react-table").Row<SR>);
  const mkN = (n: number | null) =>
    ({ original: { n } } as unknown as import("@tanstack/react-table").Row<NR>);
  const mkD = (d: string | null) =>
    ({ original: { d } } as unknown as import("@tanstack/react-table").Row<DR>);

  it("colación es-MX (acentos y mayúsculas insensibles)", () => {
    expect(esCollator.compare("árbol", "banana")).toBeLessThan(0);
    expect(esCollator.compare("ARBOL", "arbol")).toBe(0);

    const fn = sortByString<SR>((r) => r.v);
    expect(fn(mkS("árbol"), mkS("banana"), "v")).toBeLessThan(0);
    expect(fn(mkS("ARBOL"), mkS("arbol"), "v")).toBe(0);
  });

  it("sortByString manda null/undefined al final", () => {
    const fn = sortByString<SR>((r) => r.v);
    expect(fn(mkS(null), mkS("a"), "v")).toBeGreaterThan(0);
    expect(fn(mkS("a"), mkS(null), "v")).toBeLessThan(0);
    expect(fn(mkS(null), mkS(null), "v")).toBe(0);
  });

  it("sortByNumber respeta nulls al final", () => {
    const fn = sortByNumber<NR>((r) => r.n);
    expect(fn(mkN(10), mkN(null), "n")).toBeLessThan(0);
    expect(fn(mkN(null), mkN(10), "n")).toBeGreaterThan(0);
    expect(fn(mkN(1), mkN(2), "n")).toBeLessThan(0);
  });

  it("sortByDate compara timestamps y trata strings inválidos como nulls", () => {
    const fn = sortByDate<DR>((r) => r.d);
    expect(fn(mkD("2024-01-01"), mkD("2025-01-01"), "d")).toBeLessThan(0);
    expect(fn(mkD("no-es-fecha"), mkD("2024-01-01"), "d")).toBeGreaterThan(0);
  });
});

describe("DataTable — meta visual aplicado al header", () => {
  it("meta.width / meta.align / meta.sticky se proyectan a la columna", () => {
    const cols: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
      {
        id: "numero", header: "Número",
        meta: { width: "w-[120px]", align: "right", sticky: true, className: "tabular-nums" },
        cell: ({ row }) => row.original.numero,
      },
    ]);
    render(<DataTable columns={cols} data={embarques} rowKey={(r) => r.id} />);
    const header = screen.getByRole("columnheader", { name: /Número/ });
    const cls = header.className;
    expect(cls).toContain("w-[120px]");
    expect(cls).toMatch(/text-right|justify-end/);
    expect(cls).toMatch(/sticky/);
  });
});
