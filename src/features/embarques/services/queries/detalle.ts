/**
 * Queries del detalle de un embarque: lectura por id y RPC `get_embarque_full`
 * que agrega conceptos, documentos, notas y facturas en una sola llamada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { LC_CODE_MESSAGES } from "@/lib/errors/lcCodeMessages";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
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
export async function fetchEmbarqueById(id: string): Promise<EmbarqueRow | null> {
  // maybeSingle: un embarque inexistente/eliminado o de otra org no es un
  // "error de carga" — devuelve null para que la pantalla muestre su estado
  // de "no encontrado" en lugar del ErrorState genérico (Sentry 6W/6V).
  const { data, error } = await supabase
    .from("embarques")
    .select(EMBARQUE_DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as EmbarqueRow | null) ?? null;
}

export interface EmbarqueFullData {
  embarque: EmbarqueRow | null;
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  documentos: DocumentoEmbarqueRow[];
  notas: NotaEmbarqueRow[];
  facturas: Tables<"facturas">[];
}

export const EMBARQUE_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resuelve los enlaces históricos por folio conservando el caso ambiguo. */
export async function fetchEmbarqueIdPorExpediente(expediente: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("embarques")
    .select("id")
    .eq("expediente", expediente)
    .is("deleted_at", null)
    .limit(2);
  if (error) throw error;
  const vivos = data ?? [];
  if (vivos.length > 1) throw new ReglaNegocioError(LC_CODE_MESSAGES.LC_EXPEDIENTE_AMBIGUO);
  return vivos[0]?.id ?? null;
}

export async function fetchEmbarqueFull(idOrExpediente: string): Promise<EmbarqueFullData | null> {
  const id = EMBARQUE_ID_UUID.test(idOrExpediente)
    ? idOrExpediente
    : await fetchEmbarqueIdPorExpediente(idOrExpediente);
  if (!id) return null;
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
