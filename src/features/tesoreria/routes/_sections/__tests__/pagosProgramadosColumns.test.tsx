/**
 * MNY-04 — sin fecha programada la RPC responde LC_PAGO_SIN_PROGRAMACION, así
 * que la bandeja debe ofrecer "Programar pago" y no "Ejecutar pago".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    estado_aprobacion: "aprobada",
    ...over,
  };
}

function renderAcciones(f: FacturaProgramable, onProgramarPago = vi.fn()) {
  const columnas = buildPagosProgramadosColumns(vi.fn(), onProgramarPago);
  // SAFE-CAST: sólo se ejercita la celda de acciones con su fila.
  const columna = columnas.find((c) => c.id === "acciones") as unknown as {
    cell: (ctx: { row: { original: FacturaProgramable } }) => React.ReactNode;
  };
  render(<>{columna.cell({ row: { original: f } })}</>);
  return { onProgramarPago };
}

describe("columna de acciones de pagos programados (MNY-04)", () => {
  // CI-02: sin <Link> inline; la celda dispara el callback de navegación.
  it("sin fecha programada ofrece programar el pago", () => {
    const f = factura();
    const { onProgramarPago } = renderAcciones(f);
    fireEvent.click(screen.getByRole("button", { name: /Programar pago/i }));
    expect(onProgramarPago).toHaveBeenCalledWith(f);
    expect(screen.queryByRole("button", { name: /Ejecutar pago/i })).toBeNull();
  });

  it("con fecha programada ofrece ejecutar el pago", () => {
    renderAcciones(factura({ fecha_programada_pago: "2026-09-05" }));
    expect(screen.getByRole("button", { name: /Ejecutar pago/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Programar pago/i })).toBeNull();
  });

  // MNY-P2.5: el trigger `pagos_proveedor_requiere_aprobacion` rechaza pagar una
  // factura sin aprobar; la bandeja no puede ofrecer una acción que siempre falla.
  it("sin aprobación lleva a revisar la aprobación, no a pagar", () => {
    const f = factura({ fecha_programada_pago: "2026-09-05", estado_aprobacion: "pendiente" });
    const { onProgramarPago } = renderAcciones(f);
    expect(screen.queryByRole("button", { name: /Ejecutar pago/i })).toBeNull();
    expect(screen.getByText(/Por aprobar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Revisar aprobación/i }));
    expect(onProgramarPago).toHaveBeenCalledWith(f);
  });

  it("una factura rechazada se marca como tal", () => {
    renderAcciones(factura({ fecha_programada_pago: "2026-09-05", estado_aprobacion: "rechazada" }));
    expect(screen.getByText(/Rechazada/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ejecutar pago/i })).toBeNull();
  });
});
