import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { EstadoCuentaMovimientos } from "@/features/proveedor/domain/movimientosProveedor";

const h = vi.hoisted(() => ({ useProveedorMovimientos: vi.fn() }));
vi.mock("@/features/proveedor/hooks/useProveedorMovimientos", () => ({
  useProveedorMovimientos: h.useProveedorMovimientos,
}));

import { ProveedorEstadoCuentaTab } from "@/features/proveedor/components/ProveedorEstadoCuentaTab";

const datos: EstadoCuentaMovimientos = {
  saldo_apertura: [],
  movimientos: [
    {
      fecha: "2026-01-10",
      tipo: "Factura",
      ref_id: "f1",
      folio: "FP-000001",
      referencia: "NQDEC1",
      expediente: "ELIMP00001",
      embarque_id: null,
      moneda: "USD",
      cargo: 1000,
      abono: 0,
      detalle: "Vigente",
    },
    {
      fecha: "2026-01-20",
      tipo: "Pago",
      ref_id: "p1",
      folio: "FP-000001",
      referencia: "SPEI",
      expediente: "ELIMP00001",
      embarque_id: null,
      moneda: "USD",
      cargo: 0,
      abono: 400,
      detalle: null,
    },
  ],
  aging: [{ moneda: "USD", bucket: "1-30", saldo: 600, conteo: 1 }],
  saldos: [{ moneda: "USD", cargos: 1000, abonos: 400, saldo: 600 }],
  total_movimientos: 2,
  hay_mas: false,
};

const renderTab = () =>
  render(
    <MemoryRouter>
      <ProveedorEstadoCuentaTab proveedorId="p1" proveedorNombre="HK LS Limited" rfc="TE1" />
    </MemoryRouter>,
  );

describe("ProveedorEstadoCuentaTab", () => {
  it("muestra el esqueleto mientras carga", () => {
    h.useProveedorMovimientos.mockReturnValue({ data: undefined, isLoading: true });
    renderTab();
    expect(screen.queryByText("Saldos por moneda")).not.toBeInTheDocument();
  });

  it("pinta antigüedad, resumen y movimientos con saldo corrido", () => {
    h.useProveedorMovimientos.mockReturnValue({ data: datos, isLoading: false });
    renderTab();
    expect(screen.getByText("Antigüedad de saldos por pagar")).toBeInTheDocument();
    expect(screen.getByText("Saldos por moneda")).toBeInTheDocument();
    expect(screen.getAllByText("FP-000001").length).toBe(2);
    expect(screen.getAllByText(/600/).length).toBeGreaterThan(0);
  });

  it("no rompe cuando el proveedor no tiene movimientos", () => {
    h.useProveedorMovimientos.mockReturnValue({
      data: { movimientos: [], aging: [], saldos: [] },
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText("Movimientos")).toBeInTheDocument();
    expect(screen.queryByText("Antigüedad de saldos por pagar")).not.toBeInTheDocument();
  });

  it("consulta el rango de fechas por omisión en el servidor", () => {
    h.useProveedorMovimientos.mockReturnValue({ data: datos, isLoading: false });
    renderTab();
    const [, desde, hasta] = h.useProveedorMovimientos.mock.calls.at(-1)!;
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(desde < hasta).toBe(true);
  });
});
