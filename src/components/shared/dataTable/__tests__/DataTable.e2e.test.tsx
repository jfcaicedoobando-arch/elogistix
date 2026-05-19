/**
 * E2E (integración) — DataTable y VirtualDataTable.
 *
 * Simula los flujos reales del ERP: filtrado externo (estilo Supabase/RPC),
 * orden server-side, paginación controlada y montaje del rowModel
 * virtualizado. No probamos lógica interna de TanStack (asumida correcta);
 * validamos los contratos que consumen Embarques, Cotizaciones y Dashboard.
 */
import { describe, it, expect, vi } from "vitest";
import { useState, useMemo } from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { DataTable, defineColumns, type ColumnDef, type SortDir } from "@/components/shared/DataTable";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";

interface EmbarqueRow {
  id: string;
  numero: string;
  cliente: string;
  total: number;
}

const FIXTURE: EmbarqueRow[] = [
  { id: "e1", numero: "EMB-001", cliente: "ACME", total: 1500 },
  { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
  { id: "e3", numero: "EMB-003", cliente: "Initech", total: 900 },
  { id: "e4", numero: "EMB-004", cliente: "ACME", total: 4200 },
  { id: "e5", numero: "EMB-005", cliente: "Umbrella", total: 600 },
];

const cols: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  {
    id: "numero", header: "Número", enableSorting: true,
    accessorFn: (r) => r.numero,
    sortingFn: sortByString<EmbarqueRow>((r) => r.numero),
    cell: ({ row }) => row.original.numero,
  },
  {
    id: "cliente", header: "Cliente", enableSorting: true,
    accessorFn: (r) => r.cliente,
    sortingFn: sortByString<EmbarqueRow>((r) => r.cliente),
    cell: ({ row }) => row.original.cliente,
  },
  {
    id: "total", header: "Total", enableSorting: true,
    accessorFn: (r) => r.total,
    sortingFn: sortByNumber<EmbarqueRow>((r) => r.total),
    cell: ({ row }) => row.original.total,
    meta: { align: "right" },
  },
]) as ColumnDef<EmbarqueRow, unknown>[];

// --- Harness que imita el page-level state real (filtro + sort + paginate) ---
function EmbarquesHarness({
  initial = FIXTURE,
  pageSize = 2,
}: { initial?: EmbarqueRow[]; pageSize?: number }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: "asc" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);

  const filtered = useMemo(
    () => initial.filter((r) =>
      filter ? r.cliente.toLowerCase().includes(filter.toLowerCase()) : true,
    ),
    [initial, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const pageRows = filtered.slice(page * size, page * size + size);

  return (
    <div>
      <input
        aria-label="filtro-cliente"
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setPage(0); }}
      />
      <DataTable
        columns={cols}
        data={pageRows}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={sort}
        onSortChange={(key, dir) => { setSort({ key, dir }); setPage(0); }}
        pagination={{
          page, totalPages,
          onPageChange: setPage,
          pageSize: size,
          onPageSizeChange: (n) => { setSize(n); setPage(0); },
          pageSizeOptions: [2, 5, 10],
        }}
      />
      <output data-testid="sort-state">{`${sort.key ?? "null"}|${sort.dir}`}</output>
      <output data-testid="page-state">{`page=${page};size=${size};total=${totalPages}`}</output>
    </div>
  );
}

describe("DataTable E2E — filtro + orden + paginación", () => {
  it("filtro externo reduce filas visibles y resetea a página 0", () => {
    render(<EmbarquesHarness />);
    // Página inicial: 2 filas (EMB-001, EMB-002)
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-002")).toBeInTheDocument();
    expect(screen.queryByText("EMB-003")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("filtro-cliente"), { target: { value: "ACME" } });

    // ACME aparece en EMB-001 y EMB-004 → 2 filas, ambas en página 0
    expect(screen.getByText("EMB-001")).toBeInTheDocument();
    expect(screen.getByText("EMB-004")).toBeInTheDocument();
    expect(screen.queryByText("EMB-002")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-state").textContent).toBe("page=0;size=2;total=1");
  });

  it("paginación: Siguiente avanza la página y muestra la siguiente franja de datos", () => {
    render(<EmbarquesHarness />);
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByTestId("page-state").textContent).toMatch(/page=1/);
    expect(screen.getByText("EMB-003")).toBeInTheDocument();
    expect(screen.getByText("EMB-004")).toBeInTheDocument();
    expect(screen.queryByText("EMB-001")).not.toBeInTheDocument();
  });

  it("click en header de columna dispara onSortChange y reinicia la página", () => {
    render(<EmbarquesHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByTestId("page-state").textContent).toMatch(/page=1/);

    fireEvent.click(screen.getByRole("columnheader", { name: /Cliente/ }));
    expect(screen.getByTestId("sort-state").textContent).toBe("cliente|asc");
    expect(screen.getByTestId("page-state").textContent).toMatch(/page=0/);
  });

  it("ciclo de orden asc → desc → null se refleja en el estado", () => {
    render(<EmbarquesHarness />);
    const header = () => screen.getByRole("columnheader", { name: /Cliente/ });
    fireEvent.click(header());
    expect(screen.getByTestId("sort-state").textContent).toBe("cliente|asc");
    fireEvent.click(header());
    expect(screen.getByTestId("sort-state").textContent).toBe("cliente|desc");
    fireEvent.click(header());
    expect(screen.getByTestId("sort-state").textContent).toBe("null|asc");
  });

  it("respeta el orden del servidor: no re-ordena `data` en cliente", () => {
    // Server devuelve por total desc; sólo damos la página relevante.
    const serverPage: EmbarqueRow[] = [
      { id: "e4", numero: "EMB-004", cliente: "ACME", total: 4200 },
      { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
    ];
    render(
      <DataTable
        columns={cols}
        data={serverPage}
        rowKey={(r) => r.id}
        sortMode="server"
        controlledSort={{ key: "total", dir: "desc" }}
        onSortChange={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("EMB-004")).toBeInTheDocument();
    expect(within(rows[2]).getByText("EMB-002")).toBeInTheDocument();
  });
});

describe("DataTable E2E — empty / loading", () => {
  it("filtro sin coincidencias muestra empty state", () => {
    render(<EmbarquesHarness />);
    fireEvent.change(screen.getByLabelText("filtro-cliente"), { target: { value: "ZZZ" } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("isLoading muestra skeletons y oculta cuerpo real", () => {
    render(
      <DataTable
        columns={cols}
        data={FIXTURE}
        rowKey={(r) => r.id}
        isLoading
        skeletonRows={3}
      />,
    );
    expect(screen.queryByText("EMB-001")).not.toBeInTheDocument();
  });
});

describe("VirtualDataTable E2E — virtualización + paginación", () => {
  it("renderiza header y monta el contenedor virtual con paginación controlada", () => {
    const onPageChange = vi.fn();
    render(
      <VirtualDataTable
        columns={cols}
        data={FIXTURE}
        rowKey={(r) => r.id}
        estimateRowHeight={40}
        maxHeight={200}
        pagination={{ page: 0, totalPages: 3, onPageChange }}
      />,
    );
    // Header siempre montado (no virtualizado)
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    // Paginación controlada
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
  });

  it("data vacía muestra empty state", () => {
    render(
      <VirtualDataTable
        columns={cols}
        data={[]}
        rowKey={(r) => r.id}
        emptyMessage="Sin embarques"
      />,
    );
    expect(screen.getByText("Sin embarques")).toBeInTheDocument();
  });

  it("no rompe ante un cambio de `data` (filtro externo aplicado fuera)", () => {
    const { rerender } = render(
      <VirtualDataTable
        columns={cols}
        data={FIXTURE}
        rowKey={(r) => r.id}
      />,
    );
    act(() => {
      rerender(
        <VirtualDataTable
          columns={cols}
          data={FIXTURE.filter((r) => r.cliente === "ACME")}
          rowKey={(r) => r.id}
        />,
      );
    });
    // El header sigue ahí; jsdom no calcula layout virtual, basta con que no truene.
    expect(screen.getByText("Número")).toBeInTheDocument();
  });
});
