import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { invokeUserManagement } from "@/services/userManagement";

export interface CoordinadorOption { id: string; nombre: string }

/** Coordinadores logísticos (y gerentes de operaciones) de la empresa activa. */
export async function fetchCoordinadores(organizationId: string): Promise<{ opciones: CoordinadorOption[]; nombres: Map<string, string> }> {
  const members = await unwrapOr(
    supabase.from("organization_members").select("user_id, role")
      .eq("organization_id", organizationId)
      .in("role", ["coordinador_logistico", "gerente_operaciones"]),
    [],
  );
  const nombres = await fetchNombres();
  const map = new Map(nombres.map((n) => [n.id, n.full_name ?? "Usuario sin nombre"]));
  const vistos = new Set<string>();
  const opciones = members
    .filter((m) => (vistos.has(m.user_id) ? false : (vistos.add(m.user_id), true)))
    .map((m) => ({ id: m.user_id, nombre: map.get(m.user_id) ?? "Usuario sin nombre" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX"));
  return { opciones, nombres: map };
}

export async function fetchCoordinadorCliente(clienteId: string, organizationId: string) {
  const row = await unwrap(
    supabase.from("clientes").select("coordinador_logistico_id")
      .eq("id", clienteId).eq("organization_id", organizationId).maybeSingle(),
  );
  return row?.coordinador_logistico_id ?? null;
}

export async function asignarCoordinadorCliente(clienteId: string, coordinadorId: string | null) {
  const { error } = await supabase.rpc("asignar_coordinador_cliente", {
    p_cliente_id: clienteId, p_coordinador_id: coordinadorId as string,
  });
  if (error) throw error;
}

export async function reasignarCoordinadorHandover(cotizacionId: string, coordinadorId: string) {
  const { error } = await supabase.rpc("reasignar_coordinador_handover", {
    p_cotizacion_id: cotizacionId, p_coordinador_id: coordinadorId,
  });
  if (error) throw error;
}

interface NombreUsuario { id: string; full_name?: string | null }
/** Sólo nombres (sin email); si falla se muestran sin nombre en lugar de romper la ficha. */
async function fetchNombres(): Promise<NombreUsuario[]> {
  const { data, error } = await invokeUserManagement({ action: "list-nombres" });
  return !error && Array.isArray(data) ? (data as NombreUsuario[]) : [];
}
