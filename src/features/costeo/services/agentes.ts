/**
 * Servicio: CRUD de agentes de costeo (proveedores chinos vinculados).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoAgente } from "@/features/costeo/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function fetchCosteoAgentes(organizationId: string): Promise<CosteoAgente[]> {
  return unwrapOr(
    supabase
      .from("costeo_agentes")
      .select("*")
      .eq("organization_id", organizationId)
      .order("nombre", { ascending: true }),
    [],
  ) as Promise<CosteoAgente[]>;
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
  const agente = (await unwrap(
    supabase
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
      .single(),
  )) as CosteoAgente;
  await registrarActividad({
    modulo: "costeo",
    accion: "crear_agente_costeo",
    entidadId: agente.id,
    entidadNombre: agente.nombre,
  });
  return agente;
}

export async function updateCosteoAgente(
  id: string,
  patch: Partial<CosteoAgenteInput>,
): Promise<CosteoAgente> {
  const agente = (await unwrap(
    supabase.from("costeo_agentes").update(patch).eq("id", id).select("*").single(),
  )) as CosteoAgente;
  await registrarActividad({
    modulo: "costeo",
    accion: "editar_agente_costeo",
    entidadId: agente.id,
    entidadNombre: agente.nombre,
  });
  return agente;
}

export async function deleteCosteoAgente(id: string): Promise<void> {
  await run(supabase.from("costeo_agentes").delete().eq("id", id));
  await registrarActividad({
    modulo: "costeo",
    accion: "eliminar_agente_costeo",
    entidadId: id,
  });
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
  return unwrapOr(
    supabase
      .from("proveedores")
      .select("id, nombre, pais")
      .eq("tipo", tipo)
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(500),
    [],
  ) as Promise<ProveedorOpcion[]>;
}
