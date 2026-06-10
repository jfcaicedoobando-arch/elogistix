/**
 * Servicio: CRUD de agentes de costeo (proveedores chinos vinculados).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoAgente } from "@/features/costeo/types";

export async function fetchCosteoAgentes(organizationId: string): Promise<CosteoAgente[]> {
  const { data, error } = await supabase
    .from("costeo_agentes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CosteoAgente[];
}

export interface CosteoAgenteInput {
  nombre: string;
  proveedor_id: string;
  pais?: string;
  dias_credito: number;
  contacto_tarifario?: string | null;
  email?: string | null;
  activo?: boolean;
  notas?: string | null;
}

export async function insertCosteoAgente(
  organizationId: string,
  input: CosteoAgenteInput,
): Promise<CosteoAgente> {
  const { data, error } = await supabase
    .from("costeo_agentes")
    .insert({
      nombre: input.nombre,
      proveedor_id: input.proveedor_id,
      pais: input.pais ?? "CN",
      dias_credito: input.dias_credito,
      contacto_tarifario: input.contacto_tarifario ?? null,
      email: input.email ?? null,
      activo: input.activo ?? true,
      notas: input.notas ?? null,
      organization_id: organizationId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CosteoAgente;
}

export async function updateCosteoAgente(
  id: string,
  patch: Partial<CosteoAgenteInput>,
): Promise<CosteoAgente> {
  const { data, error } = await supabase
    .from("costeo_agentes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CosteoAgente;
}

export async function deleteCosteoAgente(id: string): Promise<void> {
  const { error } = await supabase.from("costeo_agentes").delete().eq("id", id);
  if (error) throw error;
}

/** Lite fetcher de proveedores por tipo, usado en selects del módulo Costeo. */
export interface ProveedorOpcion {
  id: string;
  nombre: string;
  pais: string | null;
}

export async function fetchProveedoresPorTipo(
  tipo: "Agente de Carga" | "Naviera",
): Promise<ProveedorOpcion[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre, pais")
    .eq("tipo", tipo)
    .order("nombre", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ProveedorOpcion[];
}
