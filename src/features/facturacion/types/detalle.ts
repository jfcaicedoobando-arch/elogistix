/** Contrato de detalle de factura, sin dependencia de consultas o UI. */
import type { Tables } from "@/integrations/supabase/types";

export type FacturaDetalle = Pick<
  Tables<"facturas">,
  | "id"
  | "numero"
  | "cliente_id"
  | "cliente_nombre"
  | "expediente"
  | "embarque_id"
  | "proforma_id"
  | "fecha_emision"
  | "fecha_vencimiento"
  | "subtotal"
  | "iva"
  | "total"
  | "moneda"
  | "tipo_cambio"
  | "estado"
  | "referencia_bl"
  | "notas"
  | "factura_pdf_url"
  | "factura_xml_url"
  | "snapshot_emision"
  | "organization_id"
  | "rfc_cliente"
  | "uso_cfdi"
  | "forma_pago"
  | "metodo_pago"
  | "uuid_fiscal"
  | "folio_fiscal"
  | "serie"
  | "facturapi_id"
  | "facturapi_claim_at"

  | "dias_credito"
  | "ambiente"
  | "acuse_cancelacion_xml"
  | "acuse_cancelacion_fecha"
  | "acuse_cancelacion_status"
  | "cancelacion_motivo"
  | "cancelado_en"
  | "cancellation_status"
  | "cancelacion_solicitada_en"
  | "cancelacion_vence_en"
  | "sustituye_a"
  | "sustituida_por"
> & Partial<Pick<Tables<"facturas">, "ret_isr" | "ret_iva">> & {
  proformas: { numero: string } | null;
  sustituida_por_ref: { id: string; numero: string | null; estado: string | null } | null;
};
