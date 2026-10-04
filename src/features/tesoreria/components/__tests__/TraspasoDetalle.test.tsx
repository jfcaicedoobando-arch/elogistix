import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EstadoConciliado } from "../PanelConciliacionEstados";
import { TraspasoDetalleContent } from "../TraspasoDetalleContent";
import { refPagoDeMovimiento } from "../../domain/pagoDetalle";
import type { TraspasoDetalle } from "../../domain/traspasoDetalle";
const detalle: TraspasoDetalle = {
  traspaso: { id: "t1", folio: "TR-001", fecha: "2026-10-03", cuenta_origen_id: "mxn", cuenta_destino_id: "usd", moneda_origen: "MXN", moneda_destino: "USD", monto_origen: 100, monto_destino: 5, comision: 2, tipo_cambio: 0.05, concepto: "Entre cuentas", referencia: "R-41", estado: "Aplicado" },
  origen: { id: "mxn", alias: "Banorte operativa", banco: "Banorte", moneda: "MXN" }, destino: { id: "usd", alias: "BBVA dólares", banco: "BBVA", moneda: "USD" },
  movimientos: [
    { id: "m1", fecha: "2026-10-03", cuenta_bancaria_id: "mxn", cargo: 100, abono: 0, hash_dedupe: "traspaso-t1-origen", estado_conciliacion: "Conciliado" },
    { id: "m2", fecha: "2026-10-03", cuenta_bancaria_id: "usd", cargo: 0, abono: 5, hash_dedupe: "traspaso-t1-destino", estado_conciliacion: "Conciliado" },
    { id: "m3", fecha: "2026-10-03", cuenta_bancaria_id: "mxn", cargo: 2, abono: 0, hash_dedupe: "traspaso-t1-comision", estado_conciliacion: "Conciliado" },
  ],
};
describe("Origen traspaso: tres patas sin pago de factura", () => {
  it.each(["m1", "m2", "m3"])("abre el mismo traspaso desde %s y preserva la pata seleccionada", (id) => {
    expect(refPagoDeMovimiento({ id, traspaso_id: "t1" })).toEqual({ tipo: "traspaso", id: "t1", movimientoId: id });
  });
  it("muestra cuentas, importes, comisión, conversión y los tres movimientos", () => {
    render(<MemoryRouter><TraspasoDetalleContent detalle={detalle} movimientoId="m3" /></MemoryRouter>);
    expect(screen.getByText(/Banorte operativa/)).toBeVisible();
    expect(screen.getByText(/BBVA dólares/)).toBeVisible();
    expect(screen.getByText(/Conversión registrada/)).toHaveTextContent("1 MXN = 0.05 USD");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Comisión").closest("li")).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/tesoreria/estado-cuenta?cuenta=mxn", "/tesoreria/estado-cuenta?cuenta=usd", "/tesoreria/estado-cuenta?cuenta=mxn"]);
  });
  it("mantiene conciliado y muestra traspaso sin ofrecer desvincular un pago", () => {
    const ver = vi.fn();
    render(<EstadoConciliado tipo="traspaso" tienePago onVerPago={ver} onDesconciliar={vi.fn()} />);
    expect(screen.queryByText(/no guarda el pago/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desconciliar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle del traspaso" }));
    expect(ver).toHaveBeenCalledTimes(1);
  });
  it("conserva la acción anterior para un cobro normal", () => {
    const desconciliar = vi.fn();
    render(<EstadoConciliado tipo="cobro" tienePago onVerPago={vi.fn()} onDesconciliar={desconciliar} />);
    fireEvent.click(screen.getByRole("button", { name: "Desconciliar" }));
    expect(desconciliar).toHaveBeenCalledTimes(1);
  });
});
