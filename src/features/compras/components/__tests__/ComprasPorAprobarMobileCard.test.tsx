/** v13.823.25: tarjeta móvil de /compras/por-aprobar muestra folio/vencimiento/total. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComprasPorAprobarMobileCard } from "../ComprasPorAprobarMobileCard";
import type { FacturaCxP } from "@/features/cxp/services";

function factura(overrides: Partial<FacturaCxP> = {}): FacturaCxP {
  return {
    id: "f1", proveedor_id: "p1", proveedor_nombre: "acme sa de cv", proveedor_origen: "Nacional",
    embarque_id: null, embarque_expediente: null, folio_proveedor: "FP-1", folio_interno: "FI-1",
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-02-01", dias_vencido: 0,
    moneda: "MXN", total: 100, pagado: 0, notas_credito: 0, saldo: 100,
    estado: "Vigente", estatus: "Vigente", tipo_cambio_usd: 1,
    estado_aprobacion: "pendiente", motivo_rechazo: null,
    categoria_presupuesto_id: null, categoria_nombre: null,
    subtotal: 100, iva: 0, ieps: 0, retenciones: 0,
    rfc_proveedor: null, uuid_fiscal: null, dias_credito: 30, notas: null,
    archivo_xml_url: null, archivo_pdf_url: null,
    uuid_verificado: false, uuid_verificado_fecha: null, uuid_estatus_sat: null,
    fecha_programada_pago: null, fecha_cancelacion: null, motivo_cancelacion: null,
    cancelada_por: null, created_by: null,
    ...overrides,
  } as FacturaCxP;
}

describe("ComprasPorAprobarMobileCard", () => {
  it("muestra proveedor, folio y total con moneda", () => {
    render(<ComprasPorAprobarMobileCard row={factura()} />);
    expect(screen.getByText("Acme SA de CV")).toBeInTheDocument();
    expect(screen.getByText("FP-1")).toBeInTheDocument();
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });
});
