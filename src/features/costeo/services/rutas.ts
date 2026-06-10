/**
 * Servicio: CRUD de rutas de costeo (par puerto origen → puerto destino).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoRuta } from "@/features/costeo/types";

interface RawRuta extends CosteoRuta {
  puerto_origen?: { name: string } | null;
  puerto_destino?: { name: string } | null;
}

export async function fetchCosteoRutas(organizationId: string): Promise<CosteoRuta[]> {
  const { data, error } = await supabase
    .from("costeo_rutas")
    .select(
      "*, puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name), puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name)",
    )
    .eq("organization_id", organizationId);
  if (error) throw error;
  return ((data ?? []) as RawRuta[]).map((r) => ({
    ...r,
    puerto_origen_nombre: r.puerto_origen?.name,
    puerto_destino_nombre: r.puerto_destino?.name,
  }));
}

export interface CosteoRutaInput {
  puerto_origen_id: string;
  puerto_destino_id: string;
  activa?: boolean;
}

export async function insertCosteoRuta(
  organizationId: string,
  input: CosteoRutaInput,
): Promise<CosteoRuta> {
  const { data, error } = await supabase
    .from("costeo_rutas")
    .insert({ ...input, organization_id: organizationId })
    .select("*")
    .single();
  if (error) throw error;
  return data as CosteoRuta;
}

export async function deleteCosteoRuta(id: string): Promise<void> {
  const { error } = await supabase.from("costeo_rutas").delete().eq("id", id);
  if (error) throw error;
}
