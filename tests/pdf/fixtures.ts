import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import { makeEmbarque, makeProforma } from "@/test/fixtures";
import type { ConceptoVenta } from "@/pdf/documents/proformaConceptosColumns";
import { TASA_IVA } from "@/lib/financial/financialUtils";

export const emisor = {
  razonSocial: "Logística Regiomontana QA", subtitulo: "Documento de prueba sin valor fiscal",
  direccion: "Monterrey, Nuevo León", contacto: "operaciones@example.test",
};
export const cotizacion = makeCotizacionRow({
  folio: "COT-QA-2026-001", cliente_nombre: "Refacciones Industriales Regiomontanas",
  origen: "Ningbo, China", destino: "Manzanillo, México", estado: "Enviada",
  created_at: "2026-10-03T16:00:00Z", descripcion_mercancia: "Refacciones industriales, 1 contenedor 40HC",
  conceptos_venta: [
    { descripcion: "Flete marítimo Ningbo-Manzanillo", cantidad: 1, unidad_medida: "Servicio",
      precio_unitario: 1800, total: 1800, moneda: "USD", aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto" },
    { descripcion: "Maniobras en Manzanillo", cantidad: 1, unidad_medida: "Servicio",
      precio_unitario: 1000, total: 1000, moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: TASA_IVA, tipo_iva: "tasa_16" },
  ],
});
export const embarque = makeEmbarque({
  expediente: "EXP-QA-2026-001", cliente_nombre: cotizacion.cliente_nombre,
  puerto_origen: "Ningbo", puerto_destino: "Manzanillo", descripcion_mercancia: cotizacion.descripcion_mercancia,
});
export function concepto(index: number, overrides: Partial<ConceptoVenta> = {}): ConceptoVenta {
  return {
    id: "qa-concepto-" + index, organization_id: "org-qa", embarque_id: embarque.id,
    descripcion: "Maniobras en Manzanillo", cantidad: 1, precio_unitario: 1000, total: 1000,
    moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: TASA_IVA, tipo_iva: "tasa_16",
    origen: "manual", estado_facturacion: "Pendiente", proforma_id: "prof-qa",
    contenedor_id: null, deleted_at: null, deleted_by: null, updated_at: null,
    created_at: "2026-10-03T16:00:00Z", ...overrides,
  };
}
export const proforma = makeProforma({
  numero: "PRO-QA-2026-001", cliente_nombre: cotizacion.cliente_nombre,
  fecha_emision: "2026-10-03", subtotal_usd: 1800, iva_usd: 0, total_usd: 1800,
  subtotal_mxn: 1000, iva_mxn: 160, total_mxn: 1160,
});
