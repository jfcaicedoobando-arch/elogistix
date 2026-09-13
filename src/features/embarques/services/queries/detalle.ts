/**
 * Queries del detalle de un embarque: lectura por id y RPC `get_embarque_full`
 * que agrega conceptos, documentos, notas y facturas en una sola llamada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { EMBARQUE_DETAIL_COLUMNS } from "../columns";

type EmbarqueRow = Tables<"embarques">;
type ConceptoVentaRow = Tables<"conceptos_venta">;
type ConceptoCostoRow = Tables<"conceptos_costo">;
type DocumentoEmbarqueRow = Tables<"documentos_embarque">;
type NotaEmbarqueRow = Tables<"notas_embarque">;

/**
 * R221: un expediente en la papelera (`deleted_at`) no debe abrirse por enlace
 * directo. Antes devolvía la ficha completa (ELIMP00293).
 */
export async function fetchEmbarqueById(id: string): Promise<EmbarqueRow> {
  const { data, error } = await supabase
    .from("embarques")
    .select(EMBARQUE_DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as EmbarqueRow;
}

export interface EmbarqueFullData {
  embarque: EmbarqueRow | null;
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  documentos: DocumentoEmbarqueRow[];
  notas: NotaEmbarqueRow[];
  facturas: Tables<"facturas">[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchEmbarqueFull(idOrExpediente: string): Promise<EmbarqueFullData | null> {
  let id = idOrExpediente;
  // Si no es UUID, asumimos que es expediente (folio human-readable). Resolvemos a id.
  if (!UUID_RE.test(idOrExpediente)) {
    // R221: se ignoran los eliminados y, si aún quedan varios folios vivos
    // (ELIMP00006 duplicado), se avisa en lugar de fallar con error genérico.
    const { data: rows, error: lookupErr } = await supabase
      .from("embarques")
      .select("id")
      .eq("expediente", idOrExpediente)
      .is("deleted_at", null)
      .limit(2);
    if (lookupErr) throw lookupErr;
    const vivos = rows ?? [];
    if (vivos.length === 0) return null;
    if (vivos.length > 1) throw new ReglaNegocioError(LC_CODE_MESSAGES.LC_EXPEDIENTE_AMBIGUO);
    id = vivos[0].id;
  }
  const { data, error } = await supabase.rpc("get_embarque_full", { p_embarque_id: id });
  if (error) throw error;
  if (!data) return null;
  const payload = data as {
    embarque: EmbarqueRow | null;
    conceptosVenta: ConceptoVentaRow[] | null;
    conceptosCosto: ConceptoCostoRow[] | null;
    documentos: DocumentoEmbarqueRow[] | null;
    notas: NotaEmbarqueRow[] | null;
    facturas: Tables<"facturas">[] | null;
  };
  return {
    embarque: payload.embarque ?? null,
    conceptosVenta: payload.conceptosVenta ?? [],
    conceptosCosto: payload.conceptosCosto ?? [],
    documentos: payload.documentos ?? [],
    notas: payload.notas ?? [],
    facturas: payload.facturas ?? [],
  };
}
