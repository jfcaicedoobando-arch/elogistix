/**
 * listarSustitutas — devuelve las facturas que sustituyen a la indicada,
 * ordenadas por fecha de creación descendente. Se usa en el diálogo de
 * cancelación motivo 01 para que el usuario elija una sustituta timbrada
 * en vez de pegar un UUID manual (que no le sirve al backend, éste necesita
 * el `facturapi_id` que se resuelve desde el id interno).
 */
import { supabase } from "@/integrations/supabase/client";

export interface SustitutaCandidata {
  id: string;
  numero: string | null;
  serie: string | null;
  folio_fiscal: string | null;
  uuid_fiscal: string | null;
  estado: string | null;
  facturapi_id: string | null;
}

export async function listarSustitutas(facturaId: string): Promise<SustitutaCandidata[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, serie, folio_fiscal, uuid_fiscal, estado, facturapi_id")
    .eq("sustituye_a", facturaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SustitutaCandidata[];
}
