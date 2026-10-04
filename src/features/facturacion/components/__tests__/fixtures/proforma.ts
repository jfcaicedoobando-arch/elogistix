import type { ProformaConFactura } from "@/features/embarques/hooks";

const BASE_PROFORMA: ProformaConFactura = {
  id: "p1", numero: "P-0001", expediente: "EXP-1", cliente_nombre: "cliente dos",
  organization_id: "org-sintetica", cliente_id: "cliente-sintetico", embarque_id: "e1",
  operador: null, fecha_emision: "2024-01-05", estado_proforma: "pendiente",
  estado_cliente: "pendiente", estado_aprobacion: "pendiente", estado_revision: "pendiente",
  aceptada_at: null, aceptada_por: null, bl_master: null, consolidada_en: null,
  created_at: "2024-01-05", created_by: null, deleted_at: null, deleted_by: null,
  dias_credito: null, embarques_ids: null, enviada_at: null, enviada_por: null,
  es_consolidada: false, factura_id: null, factura_secundaria_id: null,
  fecha_facturacion: null, folio_factura_externa: null, motivo_rechazo: null,
  notas: null, origen: null, proformas_origen: null, rechazada_at: null,
  snapshot_emision: null, tasa_iva_aplicada: 0.16, token_expira_at: null,
  token_publico: null, ultimo_envio_email: null, updated_at: "2024-01-05",
  facturas: null, subtotal_mxn: 0, subtotal_usd: 0, iva_mxn: 0, iva_usd: 0,
  total_mxn: 0, total_usd: 0,
};

export function proformaFixture(overrides: Partial<ProformaConFactura> = {}): ProformaConFactura {
  return { ...BASE_PROFORMA, ...overrides };
}
