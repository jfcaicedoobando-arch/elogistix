/**
 * VirtualDataTable + ColumnDef nativo / meta visual (extraído de
 * DataTable.regression.test.tsx en 13.85.3 para mantener archivos <300 líneas).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { useColumnVisibility } from "@/hooks/shared/useColumnVisibility";
import { embarques, type EmbarqueRow } from "./_dataTableFixtures";

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const embarqueColumns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  { id: "numero", header: "Número", enableSorting: true, accessorFn: (r) => r.numero, sortFn: sortByString<EmbarqueRow>((r) => r.numero), cell: ({ row }) => row.original.numero },
  { id: "cliente", header: "Cliente", enableSorting: true, accessorFn: (r) => r.cliente, sortFn: sortByString<EmbarqueRow>((r) => r.cliente), cell: ({ row }) => row.original.cliente },
  { id: "total", header: "Total", enableSorting: true, accessorFn: (r) => r.total, sortFn: sortByNumber<EmbarqueRow>((r) => r.total), meta: { className: "text-right", headerClassName: "text-right" }, cell: ({ row }) => row.original.total },
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
      sortFn: sortByString<EmbarqueRow>((r) => r.numero),
      meta: { width: "w-[120px]", sticky: true, className: "font-medium" },
      cell: ({ row }) => row.original.numero,
    },
    {
      id: "cliente", header: "Cliente",
      accessorFn: (r) => r.cliente, enableSorting: true,
      sortFn: sortByString<EmbarqueRow>((r) => r.cliente),
      meta: { align: "left" },
      cell: ({ row }) => row.original.cliente,
    },
    {
      id: "total", header: "Total",
      accessorFn: (r) => r.total, enableSorting: true,
      sortFn: sortByNumber<EmbarqueRow>((r) => r.total),
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
    fireEvent.click(screen.getByRole("button", { name: /Cliente/ }));
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
    const stickyCell = screen.getAllByRole("cell")[0];
    expect(stickyCell.className).toContain("bg-background");
    expect(stickyCell.className).not.toContain("bg-inherit");
  });
});

type AutoSortRow = EmbarqueRow & { fecha: Date };
const autoSortRows: AutoSortRow[] = [
  { ...embarques[1], numero: "EMB-10", cliente: "banana", fecha: new Date("2026-03-20") },
  { ...embarques[2], numero: "EMB-2", cliente: "Zebra", fecha: new Date("2026-01-20") },
  { ...embarques[0], numero: "EMB-1", cliente: "apple", fecha: new Date("2026-02-20") },
  { ...embarques[0], id: "e4", numero: "EMB-3", cliente: "citrus", total: 1700, fecha: new Date("2026-02-20") },
];

function renderedIds() {
  return screen.getAllByRole("row").slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

describe("DataTable - orden cliente real con sortFn auto", () => {
  const cases: { key: "cliente" | "numero" | "total" | "fecha"; firstDesc: boolean; asc: string[]; desc: string[] }[] = [
    { key: "cliente", firstDesc: false, asc: ["e1", "e2", "e4", "e3"], desc: ["e3", "e4", "e2", "e1"] },
    { key: "numero", firstDesc: false, asc: ["e1", "e3", "e4", "e2"], desc: ["e2", "e4", "e3", "e1"] },
    { key: "total", firstDesc: true, asc: ["e3", "e1", "e4", "e2"], desc: ["e2", "e4", "e1", "e3"] },
    { key: "fecha", firstDesc: true, asc: ["e3", "e1", "e4", "e2"], desc: ["e2", "e1", "e4", "e3"] },
  ];

  it.each(cases)("ordena $key asc/desc en DOM y restaura el orden recibido", ({ key, firstDesc, asc, desc }) => {
    const columns = defineColumns<AutoSortRow>([
      { id: "id", header: "ID", enableSorting: false, cell: ({ row }) => row.original.id },
      {
        id: key, header: key, accessorFn: (row) => row[key], enableSorting: true,
        cell: ({ row }) => {
          const value = row.original[key];
          return value instanceof Date ? value.toISOString() : value;
        },
      },
    ]);
    render(<DataTable columns={columns} data={autoSortRows} rowKey={(row) => row.id} />);
    const header = screen.getByRole("columnheader", { name: key });
    expect(renderedIds()).toEqual(["e2", "e3", "e1", "e4"]);
    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", firstDesc ? "descending" : "ascending");
    expect(renderedIds()).toEqual(firstDesc ? desc : asc);
    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", firstDesc ? "ascending" : "descending");
    expect(renderedIds()).toEqual(firstDesc ? asc : desc);
    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(renderedIds()).toEqual(["e2", "e3", "e1", "e4"]);
  });
});

const visibilityStorageKey = "lc:col-vis:datatable-v9-integration";

function PersistedColumnsTable({ highlight = false }: { highlight?: boolean }) {
  const { visibility, setVisibility, toggle } = useColumnVisibility(
    "datatable-v9-integration", { numero: true, cliente: true, total: true },
  );
  const columns = embarqueColumns.map((column) => column.id === "cliente" ? {
    ...column,
    meta: {
      width: "w-[120px]", align: "right" as const, sticky: true,
      className: highlight ? "font-semibold" : "font-medium",
      headerClassName: highlight ? "font-semibold" : "font-medium",
    },
  } : column);
  return <>
    <button onClick={() => toggle("cliente")}>Alternar Cliente</button>
    <DataTable columns={columns} data={embarques} rowKey={(row) => row.id}
      columnVisibility={visibility} onColumnVisibilityChange={setVisibility} />
  </>;
}

describe("DataTable - integración con visibilidad persistida", () => {
  afterEach(() => window.localStorage.removeItem(visibilityStorageKey));

  it("oculta headers/celdas, persiste tras rerender/remount y conserva meta al mostrar", () => {
    window.localStorage.removeItem(visibilityStorageKey);
    const first = render(<PersistedColumnsTable />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByRole("columnheader", { name: "Cliente" })).toHaveClass("font-medium");
    expect(screen.getByText("ACME")).toHaveClass("font-medium", "text-right", "sticky");
    fireEvent.click(screen.getByRole("button", { name: "Alternar Cliente" }));
    expect(screen.queryByRole("columnheader", { name: "Cliente" })).not.toBeInTheDocument();
    expect(screen.queryByText("ACME")).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(6);
    expect(JSON.parse(window.localStorage.getItem(visibilityStorageKey) ?? "null"))
      .toEqual({ numero: true, cliente: false, total: true });
    first.rerender(<PersistedColumnsTable highlight />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(renderedIds()).toEqual(["EMB-001", "EMB-002", "EMB-003"]);
    first.unmount();
    render(<PersistedColumnsTable highlight />);
    expect(screen.queryByRole("columnheader", { name: "Cliente" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Alternar Cliente" }));
    expect(screen.getByRole("columnheader", { name: "Cliente" }))
      .toHaveClass("w-[120px]", "text-right", "sticky", "font-semibold");
    expect(screen.getByText("ACME")).toHaveClass("text-right", "sticky", "font-semibold");
    expect(screen.getAllByRole("cell")).toHaveLength(9);
    expect(JSON.parse(window.localStorage.getItem(visibilityStorageKey) ?? "null"))
      .toEqual({ numero: true, cliente: true, total: true });
  });
});

