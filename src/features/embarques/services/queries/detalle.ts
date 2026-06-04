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

export async function fetchEmbarqueById(id: string): Promise<EmbarqueRow> {
  const { data, error } = await supabase
    .from("embarques")
    .select(EMBARQUE_DETAIL_COLUMNS)
    .eq("id", id)
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
    const { data: row, error: lookupErr } = await supabase
      .from("embarques")
      .select("id")
      .eq("expediente", idOrExpediente)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!row) return null;
    id = row.id;
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
