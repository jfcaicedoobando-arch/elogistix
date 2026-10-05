import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProveedorAgingCard } from "../ProveedorAgingCard";
import { ProveedorMovimientosTable } from "../ProveedorMovimientosTable";
import {
  agingPorMoneda,
  conSaldoCorrido,
  type MovimientoProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";
import { estadoCuentaMovimientosSchema } from "@/features/proveedor/services/readSchemas";

const movimiento = (cambios: Partial<MovimientoProveedor>): MovimientoProveedor => ({
  fecha: "2026-10-01", tipo: "Factura", ref_id: "factura", folio: "AUD70-USD",
  referencia: null, expediente: "", embarque_id: null, moneda: "USD",
  cargo: 0, abono: 0, detalle: null, ...cambios,
});

describe("Auditoría70–71: movimientos y aging de proveedor", () => {
  it("presenta la NC convertida en USD y mantiene USD16 en saldo y antigüedad", () => {
    const data = estadoCuentaMovimientosSchema.parse({
      movimientos: [
        movimiento({ cargo: 116 }),
        movimiento({ ref_id: "nc", tipo: "Nota de crédito", folio: "AUD70-NC", abono: 100,
          detalle: "NC en MXN 2000 convertida a USD" }),
      ],
      saldo_apertura: [],
      aging: [{ moneda: "USD", bucket: "1-30", saldo: "16", conteo: "1" }],
      saldos: [{ moneda: "USD", cargos: "116", abonos: "100", saldo: "16" }],
    })!;
    const movimientos = conSaldoCorrido(data.movimientos ?? []);
    expect(movimientos.at(-1)).toMatchObject({ moneda: "USD", abono: 100, saldo: 16 });
    render(<MemoryRouter>
      <ProveedorAgingCard aging={agingPorMoneda(data.aging ?? [])} />
      <ProveedorMovimientosTable movimientos={movimientos} />
    </MemoryRouter>);
    const nota = screen.getByText("Nota de crédito");
    expect(nota).toHaveAccessibleName("Nota de crédito: NC en MXN 2000 convertida a USD");
    expect(nota).toHaveAttribute("tabindex", "0");
    const fila = screen.getAllByRole("row").find((r) => r.textContent?.includes("AUD70-NC"))!;
    expect(within(fila).getByText(/16\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/16\.00/).length).toBeGreaterThan(1);
  });

  it("acepta la contrapartida de devolución y muestra el neto sin duplicar aplicaciones", () => {
    const data = estadoCuentaMovimientosSchema.parse({
      movimientos: [
        movimiento({ moneda: "MXN", cargo: 100 }),
        movimiento({ moneda: "MXN", tipo: "Anticipo", ref_id: "anticipo", folio: "Anticipo", abono: 25 }),
        movimiento({ moneda: "MXN", tipo: "Anticipo aplicado", ref_id: "aplicacion", folio: "Aplicación", abono: 0 }),
        // numeric llega como string en algunos clientes PostgreSQL.
        { ...movimiento({ moneda: "MXN", tipo: "Devolución de anticipo", ref_id: "anticipo", folio: "Devolución" }), cargo: "15" },
      ], saldo_apertura: [], aging: [], saldos: [],
    })!;
    const movimientos = conSaldoCorrido(data.movimientos ?? []);
    expect(movimientos.map((m) => m.saldo)).toEqual([100, 75, 75, 90]);
    render(<MemoryRouter><ProveedorMovimientosTable movimientos={movimientos} /></MemoryRouter>);
    expect(screen.getByText("Devolución de anticipo")).toBeInTheDocument();
    const fila = screen.getAllByRole("row").find((r) => r.textContent?.includes("Devolución de anticipo"))!;
    expect(within(fila).getByText(/15\.00/)).toBeInTheDocument();
    expect(within(fila).getByText(/90\.00/)).toBeInTheDocument();
  });

  it("conserva apertura y explica la fecha de referencia en devoluciones legacy", () => {
    const movimientos = conSaldoCorrido([
      movimiento({ moneda: "MXN", tipo: "Devolución de anticipo", folio: "Devolución", cargo: 10,
        detalle: "Sin fecha bancaria de devolución; fecha de registro como referencia" }),
    ], [{ moneda: "MXN", saldo: -50 }]);
    expect(movimientos[0].saldo).toBe(-40);
    render(<MemoryRouter><ProveedorMovimientosTable movimientos={movimientos} /></MemoryRouter>);
    const devolucion = screen.getByText("Devolución de anticipo");
    expect(devolucion).toHaveAccessibleName(
      "Devolución de anticipo: Sin fecha bancaria de devolución; fecha de registro como referencia");
    expect(devolucion).toHaveAttribute("tabindex", "0");
  });
});
