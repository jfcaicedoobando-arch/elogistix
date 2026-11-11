import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useState } from "react";

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [
    { id: "mxn", banco: "Banco", alias: "Pesos", moneda: "MXN" },
    { id: "usd", banco: "Banco", alias: "Dólares", moneda: "USD" },
  ] }),
  useSaldosCuentas: () => ({ data: [] }),
  useMovimientos: ({ cuenta_bancaria_id }: { cuenta_bancaria_id: string }) => ({
    data: [1, 2].map(n => ({ id: `${cuenta_bancaria_id}-${n}`, cuenta_bancaria_id,
      fecha: "2026-11-11", concepto: `Movimiento ${n}`, abono: 58, cargo: 0,
      estado_conciliacion: "Conciliado" })), isLoading: false,
  }),
  useConciliacionResumen: () => ({ data: undefined, isLoading: false }),
  useConciliarPago: () => ({ mutateAsync: vi.fn() }),
  useRegistrarMovimientoManual: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canCapturarMovimientoBancario: true }) }));
vi.mock("@/features/tesoreria/hooks/useImportarEstadoCuenta", () => ({
  useImportarEstadoCuenta: () => ({ fileRef: { current: null }, revision: null }),
}));
vi.mock("@/features/tesoreria/components/ResumenConciliacionCards", () => ({ ResumenConciliacionCards: () => null }));
vi.mock("@/features/tesoreria/components/ImportacionRevisionDialog", () => ({ ImportacionRevisionDialog: () => null }));
vi.mock("../_sections/MovimientoManualDialog", () => ({ MovimientoManualDialog: () => null }));
vi.mock("../_sections/ConciliacionToolbar", () => ({
  ConciliacionToolbar: ({ onCuentaChange }: { onCuentaChange: (id: string) => void }) =>
    <button onClick={() => onCuentaChange("usd")}>Cambiar a USD</button>,
}));
vi.mock("@/components/shared/VirtualDataTable", () => ({
  VirtualDataTable: ({ data, onRowClick }: { data: { id: string }[]; onRowClick: (row: { id: string }) => void }) =>
    <>{data.map(row => <button key={row.id} onClick={() => onRowClick(row)}>{row.id}</button>)}</>,
}));
vi.mock("@/features/tesoreria/components/PanelConciliacionMovimiento", () => ({
  PanelConciliacionMovimiento: function Panel({ movimiento, moneda }: { movimiento: { id: string } | null; moneda: string }) {
    const [abierto, setAbierto] = useState(false);
    if (!movimiento) return <p>Sin selección</p>;
    return <section><p>{movimiento.id} · {moneda}</p>
      <button onClick={() => setAbierto(true)}>Ver pago</button>
      {abierto && <p>Detalle abierto</p>}
    </section>;
  },
}));

import TesoreriaConciliacion from "../TesoreriaConciliacion";

function renderPage() {
  return render(<NuqsTestingAdapter><MemoryRouter initialEntries={["/?cuenta=mxn"]}>
    <Link to="/?cuenta=mxn">Volver a MXN</Link>
    <Link to="/?cuenta=usd">Cuenta USD por URL</Link>
    <TesoreriaConciliacion />
  </MemoryRouter></NuqsTestingAdapter>);
}

describe("Conciliación: selección delimitada por cuenta", () => {
  it.each(["Cambiar a USD", "Cuenta USD por URL"])("%s limpia movimiento y detalle sin relabelar el importe", (accion) => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "mxn-1" }));
    expect(screen.getByText("mxn-1 · MXN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver pago" }));
    fireEvent.click(screen.getByText(accion));
    expect(screen.getByText("Sin selección")).toBeInTheDocument();
    expect(screen.queryByText("Detalle abierto")).not.toBeInTheDocument();
    expect(screen.queryByText("mxn-1 · USD")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "usd-1" }));
    expect(screen.getByText("usd-1 · USD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Volver a MXN" }));
    expect(screen.getByText("Sin selección")).toBeInTheDocument();
  });

  it("cambiar de movimiento cierra el detalle del pago anterior", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "mxn-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver pago" }));
    fireEvent.click(screen.getByRole("button", { name: "mxn-2" }));
    expect(screen.getByText("mxn-2 · MXN")).toBeInTheDocument();
    expect(screen.queryByText("Detalle abierto")).not.toBeInTheDocument();
  });
});
