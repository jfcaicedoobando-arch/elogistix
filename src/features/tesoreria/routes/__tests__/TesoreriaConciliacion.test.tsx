/**
 * Cubre el reemplazo de la tabla plana por VirtualDataTable (P3 perf plan,
 * TesoreriaConciliacion.tsx). Referencia de aserciones de virtualización:
 * DataTable.virtual.test.tsx (en jsdom el virtualizer no mide altura real
 * del contenedor, por lo que sólo se comprueban headers/empty/skeleton,
 * igual que en esa referencia — no el contenido de filas virtualizadas).
 *
 * El Select de cuenta (Radix) se mockea por un <select> nativo sólo en este
 * test, para poder disparar `onValueChange` con fireEvent sin userEvent
 * (patrón ya usado en otros tests de la suite ante el mismo limitante, ver
 * CerrarFacturaSinPagoDialog.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

const mockUseCuentasBancarias = vi.fn();
const mockUseMovimientos = vi.fn();
const mockUseImportarMovimientos = vi.fn();
const mockUseConciliarPago = vi.fn();

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => mockUseCuentasBancarias(),
  useSaldosCuentas: () => ({ data: [], isLoading: false }),
  useMovimientos: () => mockUseMovimientos(),
  useImportarMovimientos: () => mockUseImportarMovimientos(),
  useConciliarPago: () => mockUseConciliarPago(),
  useRegistrarMovimientoManual: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useConciliacionResumen: () => ({
    data: {
      total_movimientos: 2, pendientes: 1, conciliados: 1, ignorados: 0,
      cargos_pendientes: 0, abonos_pendientes: 0,
    },
    isLoading: false,
  }),
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
  // v13.777.7 — la página lee el filtro `estado` de la URL con nuqs
  // (`useFiltroUrl`), así que necesita el adapter de pruebas además del router.
  return render(
    <NuqsTestingAdapter>
      <MemoryRouter>
        <TesoreriaConciliacion />
      </MemoryRouter>
    </NuqsTestingAdapter>,
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

  it("con cuenta seleccionada renderiza los headers de VirtualDataTable y el contador", () => {
    renderPage();
    seleccionarCuenta();

    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.getByText("Concepto")).toBeInTheDocument();
    expect(screen.getByText("Cargo")).toBeInTheDocument();
    expect(screen.getByText("Abono")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText(/2 movimientos · Principal/)).toBeInTheDocument();
  });

  it("el panel de conciliación arranca sin selección (setSel sigue disponible como onRowClick)", () => {
    renderPage();
    seleccionarCuenta();
    expect(screen.getByTestId("panel-conciliacion")).toHaveTextContent("sin-seleccion");
  });

  it("muestra empty state de VirtualDataTable cuando no hay movimientos", () => {
    mockUseMovimientos.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    seleccionarCuenta();
    expect(screen.getByText("No hay movimientos.")).toBeInTheDocument();
  });

  it("no rompe con isLoading=true (skeleton de VirtualDataTable)", () => {
    mockUseMovimientos.mockReturnValue({ data: [], isLoading: true });
    renderPage();
    seleccionarCuenta();
    expect(screen.queryByText("No hay movimientos.")).not.toBeInTheDocument();
    expect(screen.getByText("Fecha")).toBeInTheDocument();
  });

  it("el botón 'Conciliar exactos' sigue disponible y deshabilitado sin pendientes", () => {
    mockUseMovimientos.mockReturnValue({
      data: [{ ...movimientos[1] }],
      isLoading: false,
    });
    renderPage();
    seleccionarCuenta();
    expect(screen.getByRole("button", { name: /Conciliar exactos/ })).toBeDisabled();
  });
});
