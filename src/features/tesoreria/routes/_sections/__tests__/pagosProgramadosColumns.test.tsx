/**
 * MNY-04 — sin fecha programada la RPC responde LC_PAGO_SIN_PROGRAMACION, así
 * que la bandeja debe ofrecer "Programar pago" y no "Ejecutar pago".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildPagosProgramadosColumns } from "../pagosProgramadosColumns";
import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";

function factura(over: Partial<FacturaProgramable> = {}): FacturaProgramable {
  return {
    id: "pf-1",
    proveedor_nombre: "Naviera SA",
    folio_proveedor: "A-1",
    fecha_vencimiento: "2026-09-01",
    fecha_programada_pago: null,
    moneda: "MXN",
    total: 1000,
    saldo: 1000,
    ...over,
  };
}

function renderAcciones(f: FacturaProgramable) {
  const columnas = buildPagosProgramadosColumns(vi.fn());
  // SAFE-CAST: sólo se ejercita la celda de acciones con su fila.
  const columna = columnas.find((c) => c.id === "acciones") as unknown as {
    cell: (ctx: { row: { original: FacturaProgramable } }) => React.ReactNode;
  };
  return render(<MemoryRouter>{columna.cell({ row: { original: f } })}</MemoryRouter>);
}

describe("columna de acciones de pagos programados (MNY-04)", () => {
  it("sin fecha programada ofrece programar el pago", () => {
    renderAcciones(factura());
    expect(screen.getByRole("link", { name: /Programar pago/i })).toHaveAttribute(
      "href",
      "/compras/facturas/pf-1",
    );
    expect(screen.queryByRole("button", { name: /Ejecutar pago/i })).toBeNull();
  });

  it("con fecha programada ofrece ejecutar el pago", () => {
    renderAcciones(factura({ fecha_programada_pago: "2026-09-05" }));
    expect(screen.getByRole("button", { name: /Ejecutar pago/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Programar pago/i })).toBeNull();
  });
});
