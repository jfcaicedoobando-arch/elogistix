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
  "facturapi_claim_at",

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
  // P1-2 (R5): el embed `proformas!facturas_proforma_id_fkey` rompía TODA la
  // query cuando el schema cache de PostgREST no tenía la FK cargada (el
  // detalle moría con un error crudo). Se resuelve con una segunda query.
].join(", ");

export async function fetchFacturaById(id: string): Promise<FacturaDetalle | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Self-referencing FK embeds en PostgREST son frágiles ante recargas del
  // schema cache; consultamos la sustituta con una segunda query explícita.
  // SAFE-CAST: la columna `sustituida_por` existe en la tabla pero los tipos generados
  // por Supabase no incluyen todavía el self-referencing FK; se accede tipado a mano.
  const sustituidaPorId = (data as unknown as { sustituida_por: string | null }).sustituida_por;
  let sustituida_por_ref: FacturaDetalle["sustituida_por_ref"] = null;
  if (sustituidaPorId) {
    const { data: ref, error: refError } = await supabase
      .from("facturas")
      .select("id, numero, estado")
      .eq("id", sustituidaPorId)
      .maybeSingle();
    if (refError) throw refError;
    sustituida_por_ref = ref ?? null;
  }
  const proformaId = (data as unknown as { proforma_id: string | null }).proforma_id;
  let proformas: FacturaDetalle["proformas"] = null;
  if (proformaId) {
    const { data: pf, error: pfError } = await supabase
      .from("proformas")
      .select("numero")
      .eq("id", proformaId)
      .maybeSingle();
    if (pfError) throw pfError;
    proformas = pf ? { numero: pf.numero } : null;
  }
  return { ...(data as object), sustituida_por_ref, proformas } as FacturaDetalle;
}
