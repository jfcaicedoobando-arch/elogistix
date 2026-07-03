import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  statusColumn,
  clientColumn,
  moneyColumn,
  dateColumn,
  actionsColumn,
} from "@/components/shared/dataTable/columnBuilders";

interface Row {
  id: string;
  estado: string;
  cliente: string;
  monto: number;
  moneda: string;
  fecha: string;
}

const ROW: Row = {
  id: "1",
  estado: "Emitida",
  cliente: "acme corp",
  monto: 1234.5,
  moneda: "MXN",
  fecha: "2026-03-15",
};

/** Render de la celda de un ColumnDef con un row mockeado. */
function renderCell(colDef: ReturnType<typeof statusColumn<Row>>, row: Row) {
  const cell = colDef.cell as (ctx: {
    row: { original: Row };
  }) => JSX.Element;
  return render(<>{cell({ row: { original: row } })}</>);
}

describe("columnBuilders", () => {
  it("statusColumn renderiza StatusBadge con el estado", () => {
    const col = statusColumn<Row>({
      domain: "factura",
      accessor: (r) => r.estado,
    });
    renderCell(col, ROW);
    expect(screen.getByText("Emitida")).toBeInTheDocument();
  });

  it("clientColumn aplica title-case", () => {
    const col = clientColumn<Row>({ accessor: (r) => r.cliente });
    renderCell(col, ROW);
    expect(screen.getByText(/acme/i)).toBeInTheDocument();
    // toTitleCase debe capitalizar
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it("moneyColumn muestra monto con moneda por accessor", () => {
    const col = moneyColumn<Row>({
      accessor: (r) => r.monto,
      currencyAccessor: (r) => r.moneda,
    });
    renderCell(col, ROW);
    // formatCurrency produce "$1,234.50" (con separador de miles)
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });

  it("dateColumn muestra guión cuando la fecha es null", () => {
    const col = dateColumn<Row>({ accessor: () => null });
    renderCell(col, ROW);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("actionsColumn no renderiza nada si no hay items", () => {
    const col = actionsColumn<Row>({ items: () => [] });
    const cell = col.cell as (ctx: {
      row: { original: Row };
    }) => JSX.Element | null;
    const { container } = render(<>{cell({ row: { original: ROW } })}</>);
    expect(container.textContent).toBe("");
  });

  it("actionsColumn renderiza el trigger de acciones cuando hay items", () => {
    const onSelect = vi.fn();
    const col = actionsColumn<Row>({
      items: () => [{ label: "Editar", onSelect }],
    });
    renderCell(col, ROW);
    // Radix DropdownMenu no abre bien en jsdom; validamos que el trigger
    // exista con el aria-label correcto.
    expect(screen.getByRole("button", { name: /acciones/i })).toBeInTheDocument();
  });
});
