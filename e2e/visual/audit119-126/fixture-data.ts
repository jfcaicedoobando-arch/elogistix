import type { FacturaCxP } from "@/features/cxp/services";

// Synthetic records only. No copied customer details, fiscal documents or IDs.
export const factura: FacturaCxP = {
  id: "fixture-factura", proveedor_id: "fixture-proveedor",
  proveedor_nombre: "Proveedor de prueba", proveedor_origen: "Nacional",
  embarque_id: null, embarque_expediente: null,
  folio_proveedor: "FAC-LOCAL-001", folio_interno: "FI-LOCAL-001",
  fecha_emision: "2026-10-05", fecha_vencimiento: null, dias_vencido: 0,
  moneda: "MXN", total: 1234.56, pagado: 0, notas_credito: 0, saldo: 1234.56,
  estado: "Vigente", estatus: "Vigente", tipo_cambio_usd: 1,
  estado_aprobacion: "aprobada", motivo_rechazo: null,
  categoria_presupuesto_id: null, categoria_nombre: null,
  subtotal: 1234.56, iva: 0, ieps: 0, retenciones: 0,
  rfc_proveedor: null, uuid_fiscal: null, dias_credito: null, notas: null,
  archivo_xml_url: null, archivo_pdf_url: null,
  uuid_verificado: false, uuid_verificado_fecha: null, uuid_estatus_sat: null,
  fecha_programada_pago: null, fecha_cancelacion: null,
  motivo_cancelacion: null, cancelada_por: null, created_by: null,
  flags: { parcial: false, parcialPct: 0, ncAplicada: false, satVerificada: false, canceladaPor: null },
};

export const pagos = [
  { id: "fixture-pago-1", estado_rep: "NoAplica", referencia: "Transferencia de prueba" },
  { id: "fixture-pago-2", estado_rep: "Cancelado", referencia: "Transferencia anulada de prueba" },
].map(pago => ({
  ...pago, fecha_pago: "2026-10-05", monto: 20, monto_aplicado_factura: 1,
  moneda: "MXN", forma_pago: "03",
}));
