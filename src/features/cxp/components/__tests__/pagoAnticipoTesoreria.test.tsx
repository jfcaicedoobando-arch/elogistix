import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { PagoFila, type PagoRow } from "../DialogDetallePagosProveedor.fila";
import { ConciliacionIncidencias } from "../ConciliacionTesoreriaSection.incidencias";
const { controller, regenerar } = vi.hoisted(() => ({ controller: vi.fn(), regenerar: vi.fn() }));
vi.mock("@/features/cxp/hooks/useConciliacionPagoCellController", () => ({ useConciliacionPagoCellController: controller }));
vi.mock("@/features/cxp/hooks/useRegenerarMovimientoPago", () => ({ useRegenerarMovimientoPago: () => ({ mutate: regenerar, isPending: false }) }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));

const pago = (): PagoRow => ({
  id: "pago-aplicacion-fixture", fecha_pago: "2026-10-03", metodo_pago: "Transferencia", monto: 25, moneda: "MXN",
  cuenta_bancaria_id: "cuenta-fixture", es_anticipo_aplicado: true, bbva_movimientos: [],
  anticipos_aplicaciones: [{
    id: "aplicacion-fixture", anticipo_id: "anticipo-fixture", deleted_at: null,
    anticipos_proveedor: {
      id: "anticipo-fixture", estado: "disponible", moneda: "MXN", deleted_at: null, metodo_pago: "Transferencia", cuenta_bancaria_id: "cuenta-fixture",
      bbva_movimientos: [{ id: "cargo-original-fixture", fecha: "2026-10-03", cargo: 25, abono: 0, referencia: "prueba-23", deleted_at: null }],
    },
  }],
});
describe("Aplicar un anticipo no ofrece una segunda salida bancaria", () => {
  it("explica el cargo original y el reverso, oculta edición y conciliación genéricas", () => {
    const revertir = vi.fn();
    render(<table><tbody><PagoFila pago={pago()} canEdit onEliminar={revertir} onEditar={vi.fn()} /></tbody></table>);
    expect(screen.getByText("Aplicación de anticipo")).toBeInTheDocument();
    expect(screen.getByText(/Cargo original del anticipo/)).toHaveTextContent(/25/);
    expect(screen.getByText(/revierte la aplicación/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar pago" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vincular banco|Desvincular movimiento/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revertir aplicación de anticipo" }));
    expect(revertir).toHaveBeenCalledWith("pago-aplicacion-fixture");
    expect(controller).not.toHaveBeenCalled();
  });
  it("origen inconsistente tampoco habilita edición, vincular ni un cargo nuevo", () => {
    const p = pago(); p.anticipos_aplicaciones = [];
    render(<table><tbody><PagoFila pago={p} canEdit onEliminar={vi.fn()} onEditar={vi.fn()} /></tbody></table>);
    expect(screen.getByText("Anticipo por revisar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar pago" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vincular banco/ })).not.toBeInTheDocument();
    expect(controller).not.toHaveBeenCalled();
  });
  it("incidencia de anticipo conserva motivo y no ofrece Regenerar", () => {
    render(<ConciliacionIncidencias monedaFactura="MXN" incidencias={[{
      pagoId: "pago-fixture", facturaId: "f-fixture", folio: "FP-fixture", fechaPago: "2026-10-03", monto: 25,
      moneda: "MXN", montoEsperadoMxn: 25, cargoMxn: 0, tipo: "anticipo_inconsistente", motivo: "El cargo original está duplicado.",
    }]} />);
    expect(screen.getByText("Aplicación de anticipo por revisar")).toBeInTheDocument();
    expect(screen.getByText(/cargo original está duplicado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerar movimiento" })).not.toBeInTheDocument();
    expect(regenerar).not.toHaveBeenCalled();
  });
  it("muestra el cargo original en USD de la cuenta del anticipo y conserva una devolución legítima", () => {
    const p = pago();
    p.moneda = "USD"; p.monto = 10;
    const anticipo = p.anticipos_aplicaciones![0].anticipos_proveedor!;
    anticipo.moneda = "USD"; anticipo.estado = "devuelto";
    anticipo.bbva_movimientos!.push({ id: "devolucion-fixture", fecha: "2026-10-03", cargo: 0, abono: 15, referencia: null, deleted_at: null });
    render(<table><tbody><PagoFila pago={p} canEdit onEliminar={vi.fn()} onEditar={vi.fn()} /></tbody></table>);
    const cargo = screen.getByText(/Cargo original del anticipo/);
    expect(cargo).toHaveTextContent(/USD/);
    expect(cargo).not.toHaveTextContent(/MXN/);
    expect(cargo).toHaveTextContent(/25/);
    expect(screen.queryByText("Anticipo por revisar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar pago" })).not.toBeInTheDocument();
  });
});
