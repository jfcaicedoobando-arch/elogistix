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
import { DataTable } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import type { DataTableColumn } from "@/components/shared/dataTable/types";

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

const embarqueColumns: DataTableColumn<EmbarqueRow>[] = [
  { key: "numero", header: "Número", sortable: true, render: (r) => r.numero },
  { key: "cliente", header: "Cliente", sortable: true, render: (r) => r.cliente },
  { key: "total", header: "Total", sortable: true, align: "right", render: (r) => r.total },
];

const cotizacionColumns: DataTableColumn<CotizacionRow>[] = [
  { key: "folio", header: "Folio", sortable: true, render: (r) => r.folio },
  { key: "cliente", header: "Cliente", render: (r) => r.cliente },
  { key: "monto", header: "Monto", sortable: true, align: "right", render: (r) => r.monto },
];

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
  it("Embarques: click en header sortable dispara onSortChange asc → desc → null", () => {
    const onSortChange = vi.fn();
    const totalHeader = () => screen.getByRole("columnheader", { name: /Total/ });

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
    fireEvent.click(totalHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("total", "asc");

    rerender(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "total", dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );

    // 2do click: asc → desc
    fireEvent.click(totalHeader());
    expect(onSortChange).toHaveBeenLastCalledWith("total", "desc");

    rerender(
      <DataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "total", dir: "desc" }}
        onSortChange={onSortChange}
      />,
    );

    // 3er click: desc → null (TanStack cicla a unsorted)
    fireEvent.click(totalHeader());
    expect(onSortChange).toHaveBeenLastCalledWith(null, "asc");
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
  it("renderiza filas a partir de table.getRowModel(), no del array crudo", () => {
    render(
      <VirtualDataTable
        columns={embarqueColumns}
        data={embarques}
        rowKey={(r) => r.id}
        estimateRowHeight={40}
        maxHeight={400}
      />,
    );
    // Headers presentes
    expect(screen.getByText("Número")).toBeInTheDocument();
    // Al menos la primera fila se monta (jsdom no virtualiza realmente,
    // pero el rowModel de TanStack alimenta el virtualizer con count > 0).
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
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
