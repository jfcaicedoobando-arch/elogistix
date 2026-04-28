/**
 * Hook unificado: trae en UNA sola llamada al backend (RPC `get_embarque_full`)
 * todo lo necesario para la página de detalle de un embarque:
 *   - embarque (datos generales)
 *   - conceptosVenta, conceptosCosto
 *   - documentos, notas, facturas
 *
 * Reemplaza 6 useQuery individuales por 1, reduciendo round-trips a Lovable Cloud.
 * Los hooks individuales (`useEmbarqueConceptosVenta`, etc.) siguen disponibles para
 * lugares que invalidan/mutan una sola sub-entidad.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";
import type { Tables } from "@/integrations/supabase/types";

type EmbarqueRow = Tables<"embarques">;
type ConceptoVentaRow = Tables<"conceptos_venta">;
type ConceptoCostoRow = Tables<"conceptos_costo">;
type DocumentoEmbarqueRow = Tables<"documentos_embarque">;
type NotaEmbarqueRow = Tables<"notas_embarque">;
type FacturaRow = Tables<"facturas">;

export interface EmbarqueFullData {
  embarque: EmbarqueRow | null;
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  documentos: DocumentoEmbarqueRow[];
  notas: NotaEmbarqueRow[];
  facturas: FacturaRow[];
}

async function fetchEmbarqueFull(id: string): Promise<EmbarqueFullData | null> {
  const { data, error } = await supabase.rpc("get_embarque_full", { p_embarque_id: id });
  if (error) throw error;
  if (!data) return null;
  const payload = data as {
    embarque: EmbarqueRow | null;
    conceptosVenta: ConceptoVentaRow[] | null;
    conceptosCosto: ConceptoCostoRow[] | null;
    documentos: DocumentoEmbarqueRow[] | null;
    notas: NotaEmbarqueRow[] | null;
    facturas: FacturaRow[] | null;
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

export function useEmbarqueFull(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, "full", id],
    queryFn: () => fetchEmbarqueFull(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}
