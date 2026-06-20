/**
 * Render y server-side sort de DataTable (extraído de DataTable.regression.test.tsx
 * en 13.85.3 para mantener archivos <300 líneas).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { embarques, cotizaciones, type EmbarqueRow, type CotizacionRow } from "./_dataTableFixtures";

const embarqueColumns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  { id: "numero", header: "Número", enableSorting: true, accessorFn: (r) => r.numero, sortingFn: sortByString<EmbarqueRow>((r) => r.numero), cell: ({ row }) => row.original.numero },
  { id: "cliente", header: "Cliente", enableSorting: true, accessorFn: (r) => r.cliente, sortingFn: sortByString<EmbarqueRow>((r) => r.cliente), cell: ({ row }) => row.original.cliente },
  { id: "total", header: "Total", enableSorting: true, accessorFn: (r) => r.total, sortingFn: sortByNumber<EmbarqueRow>((r) => r.total), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.total },
]) as ColumnDef<EmbarqueRow, unknown>[];

const cotizacionColumns: ColumnDef<CotizacionRow, unknown>[] = defineColumns<CotizacionRow>([
  { id: "folio", header: "Folio", enableSorting: true, accessorFn: (r) => r.folio, sortingFn: sortByString<CotizacionRow>((r) => r.folio), cell: ({ row }) => row.original.folio },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente },
  { id: "monto", header: "Monto", enableSorting: true, accessorFn: (r) => r.monto, sortingFn: sortByNumber<CotizacionRow>((r) => r.monto), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.monto },
]) as ColumnDef<CotizacionRow, unknown>[];

describe("DataTable — render", () => {
  it("renderiza headers y filas en el orden recibido (server ya pre-ordenado)", () => {
    render(<DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id} />);
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-002")).toBeInTheDocument();
    expect(screen.getByText("EMB-003")).toBeInTheDocument();
  });

  it("muestra empty state cuando data está vacía", () => {
    render(<DataTable columns={embarqueColumns} data={[]} rowKey={(r) => r.id} emptyMessage="Sin embarques" />);
    expect(screen.getByText("Sin embarques")).toBeInTheDocument();
  });

  it("dispara onRowClick con la fila correcta", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("EMB-002"));
    expect(onRowClick).toHaveBeenCalledWith(embarques[1]);
  });
});

describe("DataTable — server-side sort (patrón Embarques/Cotizaciones)", () => {
  it("Embarques: ciclo completo asc → desc → null vía onSortChange (columna string)", () => {
    const onSortChange = vi.fn();
    const clienteHeader = () => screen.getByRole("columnheader", { name: /Cliente/ });

    const { rerender } = render(
      <DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: null, dir: "asc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "asc");

    rerender(
      <DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: "cliente", dir: "asc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "desc");

    rerender(
      <DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: "cliente", dir: "desc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(clienteHeader());
    expect(onSortChange).toHaveBeenLastCalledWith(null, "asc");
  });

  it("Embarques: columna numérica usa sortDescFirst (primer click → desc)", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: null, dir: "asc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /Total/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("total", "desc");
  });

  it("Cotizaciones: header no sortable NO dispara onSortChange", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable columns={cotizacionColumns} data={cotizaciones} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: null, dir: "asc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(screen.getByText("Cliente"));
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("NO reordena el array `data` en cliente cuando sortMode='server'", () => {
    const serverOrdered: EmbarqueRow[] = [
      { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
      { id: "e1", numero: "EMB-001", cliente: "ACME", total: 1500 },
      { id: "e3", numero: "EMB-003", cliente: "Initech", total: 900 },
    ];
    render(
      <DataTable columns={embarqueColumns} data={serverOrdered} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: "total", dir: "desc" }} onSortChange={vi.fn()} />,
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("EMB-002")).toBeInTheDocument();
    expect(within(rows[2]).getByText("EMB-001")).toBeInTheDocument();
    expect(within(rows[3]).getByText("EMB-003")).toBeInTheDocument();
  });
});
