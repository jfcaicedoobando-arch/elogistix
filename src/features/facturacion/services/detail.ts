/**
 * fetchFacturaById — lee una factura completa con todas las columnas
 * necesarias para la página de detalle. RLS de `public.facturas` restringe
 * por `organization_id`; si la fila no es visible para el usuario actual,
 * la consulta devuelve `null` (no se considera error).
 */
import { supabase } from "@/integrations/supabase/client";
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
> & {
  proformas: { numero: string } | null;
  sustituida_por_ref: { id: string; numero: string | null; estado: string | null } | null;
};

const COLUMNS = [
  "id",
  "numero",
  "cliente_id",
  "cliente_nombre",
  "expediente",
  "embarque_id",
  "proforma_id",
  "fecha_emision",
  "fecha_vencimiento",
  "subtotal",
  "iva",
  "total",
  "moneda",
  "tipo_cambio",
  "estado",
  "referencia_bl",
  "notas",
  "factura_pdf_url",
  "factura_xml_url",
  "snapshot_emision",
  "organization_id",
  "rfc_cliente",
  "uso_cfdi",
  "forma_pago",
  "metodo_pago",
  "uuid_fiscal",
  "folio_fiscal",
  "serie",
  "facturapi_id",
  "dias_credito",
  "ambiente",
  "acuse_cancelacion_xml",
  "acuse_cancelacion_fecha",
  "acuse_cancelacion_status",
  "cancelacion_motivo",
  "cancelado_en",
  "cancellation_status",
  "cancelacion_solicitada_en",
  "cancelacion_vence_en",
  "sustituye_a",
  "sustituida_por",
  "proformas:proformas!facturas_proforma_id_fkey(numero)",
].join(", ");

export async function fetchFacturaById(id: string): Promise<FacturaDetalle | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as FacturaDetalle | null;
}
