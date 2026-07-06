/**
 * VirtualDataTable + ColumnDef nativo / meta visual (extraído de
 * DataTable.regression.test.tsx en 13.85.3 para mantener archivos <300 líneas).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { embarques, type EmbarqueRow } from "./_dataTableFixtures";

const embarqueColumns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  { id: "numero", header: "Número", enableSorting: true, accessorFn: (r) => r.numero, sortingFn: sortByString<EmbarqueRow>((r) => r.numero), cell: ({ row }) => row.original.numero },
  { id: "cliente", header: "Cliente", enableSorting: true, accessorFn: (r) => r.cliente, sortingFn: sortByString<EmbarqueRow>((r) => r.cliente), cell: ({ row }) => row.original.cliente },
  { id: "total", header: "Total", enableSorting: true, accessorFn: (r) => r.total, sortingFn: sortByNumber<EmbarqueRow>((r) => r.total), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.total },
]) as ColumnDef<EmbarqueRow, unknown>[];

describe("VirtualDataTable — render vía rowModel de TanStack", () => {
  it("renderiza headers a partir de la instancia de TanStack", () => {
    render(
      <VirtualDataTable columns={embarqueColumns} data={embarques} rowKey={(r) => r.id}
        estimateRowHeight={40} maxHeight={400} />,
    );
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("muestra empty state cuando no hay filas (VirtualDataTable)", () => {
    render(
      <VirtualDataTable columns={embarqueColumns} data={[]} rowKey={(r) => r.id}
        emptyMessage="Sin datos" />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

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
    render(<DataTable columns={nativeColumns} data={embarques} rowKey={(r) => r.id} />);
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-002")).toBeInTheDocument();
    expect(screen.getByText("EMB-003")).toBeInTheDocument();
  });

  it("dispara onSortChange con id de columna nativo", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable columns={nativeColumns} data={embarques} rowKey={(r) => r.id}
        sortMode="server" controlledSort={{ key: null, dir: "asc" }} onSortChange={onSortChange} />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /Cliente/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("cliente", "asc");
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
