/**
 * Smoke tests para `<EstadoFacturaCxPCell />` — verifica que se pintan
 * los chips secundarios correctos según los `flags` de la factura.
 */
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EstadoFacturaCxPCell } from "../EstadoFacturaCxPCell";
import type { FacturaCxP } from "@/features/cxp/services";

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const base: FacturaCxP = {
  id: "f1",
  proveedor_id: "p1",
  proveedor_nombre: "Naviera Demo",
  proveedor_origen: "Nacional",
 embarque_id: null,
 embarque_expediente: null,
  folio_proveedor: "A-1",
  folio_interno: "FP-000001",
  fecha_emision: "2026-07-01",
  fecha_vencimiento: "2026-07-10",
  dias_vencido: 12,
  moneda: "MXN",
  total: 1000,
  pagado: 400,
  notas_credito: 100,
  saldo: 500,
  estado: "Vigente",
  estatus: "Vencida",
  tipo_cambio_usd: 1,
  estado_aprobacion: "aprobada",
  motivo_rechazo: null,
  categoria_presupuesto_id: null,
  categoria_nombre: null,
  subtotal: 862,
  iva: 138,
  ieps: 0,
  retenciones: 0,
  rfc_proveedor: "XAXX010101000",
  uuid_fiscal: null,
  dias_credito: 0,
  notas: null,
  archivo_xml_url: null,
  archivo_pdf_url: null,
  uuid_verificado: true,
  uuid_verificado_fecha: "2026-07-05T00:00:00Z",
  uuid_estatus_sat: "Vigente",
  fecha_programada_pago: "2026-07-25",
  fecha_cancelacion: null,
  motivo_cancelacion: null,
  cancelada_por: null,
  flags: {
    parcial: true,
    parcialPct: 50,
    ncAplicada: true,
    satVerificada: true,
    canceladaPor: null,
  },
};

describe("EstadoFacturaCxPCell", () => {
  it("pinta los chips Parcial · +N d · NC · SAT ✓ · Prog.", () => {
    render(<EstadoFacturaCxPCell factura={base} />);
    expect(screen.getByText(/Parcial · 50%/)).toBeInTheDocument();
    expect(screen.getByText("+12 d")).toBeInTheDocument();
    expect(screen.getByText("NC")).toBeInTheDocument();
    expect(screen.getByText("SAT ✓")).toBeInTheDocument();
    expect(screen.getByText(/Prog\./)).toBeInTheDocument();
  });

  it("no muestra chip 'Prog.' cuando la factura ya está Pagada", () => {
    const pagada: FacturaCxP = {
      ...base,
      estatus: "Pagada",
      saldo: 0,
      flags: { ...base.flags, parcial: false, parcialPct: 100 },
    };
    render(<EstadoFacturaCxPCell factura={pagada} />);
    expect(screen.queryByText(/Prog\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parcial/)).not.toBeInTheDocument();
  });
});
