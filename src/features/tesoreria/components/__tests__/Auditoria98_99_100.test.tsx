import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BloqueAplicaciones } from "../DetallePagoAplicaciones";
import { MovimientoAusente } from "../DetallePagoSheet.movimiento";
import { BloquePago } from "../DetallePagoSheet.parts";
import { libroPagosColumns } from "../../routes/_sections/libroPagosColumns";
import { LibroPagosKpis } from "../../routes/_sections/LibroPagosKpis";
import type { PagoDetalleEncabezado } from "../../domain/pagoDetalle";
import type { PagoLibro } from "../../domain/libroPagos";

function celdaConciliacion(metodo_pago: string) {
  const col = libroPagosColumns().find((c) => c.id === "conciliado");
  if (typeof col?.cell !== "function") throw new Error("falta celda conciliación");
  const row: Pick<PagoLibro, "conciliado" | "metodo_pago" | "cuenta_bancaria_id" | "movimiento_id"> = {
    conciliado: false, metodo_pago, cuenta_bancaria_id: null, movimiento_id: null,
  };
  // SAFE-CAST: la celda sólo necesita las cuatro propiedades de conciliación.
  return col.cell({ row: { original: row } } as never) as React.ReactElement;
}
const devolucion: PagoDetalleEncabezado = {
  id: "a", tipo: "devolucion_anticipo", fecha: "2026-10-03", contraparte: "Proveedor",
  contraparte_id: "p", moneda: "MXN", monto: 0.03, tipo_cambio: 1, monto_mxn: 0.03,
  metodo_pago: "Transferencia", referencia: "Retorno reserva", cuenta_bancaria_id: "b", cuenta_alias: "Banco",
  cuenta_banco: "Banco", notas: null, embarque_id: null, diferencia_cambiaria_mxn: 0, estado_rep: null,
  folio_rep: null, es_ajuste: false, lote_id: null, estado: null, saldo_disponible: null,
  created_by: null, created_at: null,
};

describe("Tesorería AUD98/99/100 visible", () => {
  it("FP11 expresa saldo actual0 y preserva el destino del enlace", () => {
    render(<MemoryRouter><BloqueAplicaciones aplicaciones={[{
      documento_id: "fp11", documento_tipo: "proveedor", folio: "FP-000011", folio_proveedor: null,
      embarque_id: null, moneda: "USD", monto_aplicado: 0.5, total: 1, pagado: 0.5,
      notas_credito_aplicadas: 0.5, fecha_aplicacion: null, pago_id: "p",
    }]} /></MemoryRouter>);
    expect(screen.getByText("Saldo actual")).toBeInTheDocument();
    expect(screen.getByText("USD 0.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FP-000011" })).toHaveAttribute("href", "/compras/facturas/fp11");
  });
  it.each(["Efectivo", "01"])("%s figura No aplica y la explicación coincide", (metodo) => {
    render(<MemoryRouter>{celdaConciliacion(metodo)}<MovimientoAusente metodoPago={metodo} /></MemoryRouter>);
    expect(screen.getByText("No aplica")).toBeInTheDocument();
    expect(screen.getByText(/no requiere conciliación/)).toBeInTheDocument();
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
  });
  it("devolución se etiqueta como entrada del proveedor y los KPIs conservan el bruto", () => {
    render(<MemoryRouter><BloquePago pago={devolucion} /></MemoryRouter>);
    expect(screen.getByText("Devolución de anticipo")).toBeInTheDocument();
    render(<LibroPagosKpis isLoading={false} totales={{
      cobradoMxn: 0, pagadoMxn: 0.03, devueltoMxn: 0.03, netoMxn: 0, conteo: 2, sinTcCount: 0,
    }} />);
    expect(screen.getByText("Dinero recibido")).toBeInTheDocument();
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Pagado a proveedores")).toBeInTheDocument();
    expect(screen.getByText(/Devoluciones de anticipos: MXN 0.03/)).toBeInTheDocument();
    expect(screen.getByText("Neto del periodo")).toBeInTheDocument();
  });
});
