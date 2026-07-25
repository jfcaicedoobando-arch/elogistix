/**
 * Cubre el reemplazo de la tabla plana por VirtualDataTable (P3 perf plan,
 * TesoreriaConciliacion.tsx). Referencia de aserciones de virtualización:
 * DataTable.virtual.test.tsx.
 *
 * El Select de cuenta (Radix) se mockea por un <select> nativo sólo en este
 * test, para poder disparar `onValueChange` con fireEvent sin userEvent
 * (patrón ya usado en otros tests de la suite ante el mismo limitante).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockUseCuentasBancarias = vi.fn();
const mockUseMovimientos = vi.fn();
const mockUseImportarMovimientos = vi.fn();
const mockUseConciliarPago = vi.fn();

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => mockUseCuentasBancarias(),
  useMovimientos: () => mockUseMovimientos(),
  useImportarMovimientos: () => mockUseImportarMovimientos(),
  useConciliarPago: () => mockUseConciliarPago(),
}));

vi.mock("@/features/tesoreria/components/PanelConciliacionMovimiento", () => ({
  PanelConciliacionMovimiento: ({ movimiento }: { movimiento: { id: string } | null }) => (
    <div data-testid="panel-conciliacion">{movimiento ? movimiento.id : "sin-seleccion"}</div>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

import TesoreriaConciliacion from "../TesoreriaConciliacion";

const cuenta = { id: "cta-1", banco: "BBVA", alias: "Principal", moneda: "MXN" };

const movimientos = [
  { id: "m-1", fecha: "2026-01-01", concepto: "Pago cliente A", cargo: 0, abono: 1000, estado_conciliacion: "Pendiente" },
  { id: "m-2", fecha: "2026-01-02", concepto: "Comisión bancaria", cargo: 50, abono: 0, estado_conciliacion: "Conciliado" },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <TesoreriaConciliacion />
    </MemoryRouter>,
  );
}

function seleccionarCuenta() {
  const [selectCuenta] = screen.getAllByTestId("mock-select");
  fireEvent.change(selectCuenta, { target: { value: "cta-1" } });
}

describe("TesoreriaConciliacion — VirtualDataTable (P3)", () => {
  beforeEach(() => {
    mockUseCuentasBancarias.mockReturnValue({ data: [cuenta] });
    mockUseMovimientos.mockReturnValue({ data: movimientos, isLoading: false });
    mockUseImportarMovimientos.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseConciliarPago.mockReturnValue({ mutateAsync: vi.fn() });
  });

  it("sin cuenta seleccionada no monta la tabla virtualizada", () => {
    renderPage();
    expect(screen.getByText(/Selecciona una cuenta para empezar a conciliar/)).toBeInTheDocument();
    expect(screen.queryByText("Concepto")).not.toBeInTheDocument();
  });

  it("con cuenta seleccionada renderiza headers y filas vía VirtualDataTable", () => {
    renderPage();
    seleccionarCuenta();

    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.getByText("Concepto")).toBeInTheDocument();
    expect(screen.getByText("Cargo")).toBeInTheDocument();
    expect(screen.getByText("Abono")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Pago cliente A")).toBeInTheDocument();
    expect(screen.getByText("Comisión bancaria")).toBeInTheDocument();
  });

  it("hace click en una fila y propaga la selección al panel (setSel)", () => {
    renderPage();
    seleccionarCuenta();

    fireEvent.click(screen.getByText("Pago cliente A"));
    expect(screen.getByTestId("panel-conciliacion")).toHaveTextContent("m-1");
  });

  it("muestra empty state cuando no hay movimientos", () => {
    mockUseMovimientos.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    seleccionarCuenta();
    expect(screen.getByText("No hay movimientos.")).toBeInTheDocument();
  });

  it("muestra skeleton mientras isLoading es true (sin romper VirtualDataTable)", () => {
    mockUseMovimientos.mockReturnValue({ data: [], isLoading: true });
    renderPage();
    seleccionarCuenta();
    expect(screen.queryByText("No hay movimientos.")).not.toBeInTheDocument();
  });
});
