/**
 * Servicio para vendedoras: config de % y catálogo de usuarios con rol vendedor.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type VendedoraConfigRow = Tables<"vendedora_config">;

export interface VendedoraConfig extends VendedoraConfigRow {
  nombre: string | null;
  email: string | null;
}

export async function fetchVendedorasConfig(): Promise<VendedoraConfig[]> {
  const { data, error } = await supabase
    .from("vendedora_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const configs = (data ?? []) as VendedoraConfigRow[];
  const ids = configs.map((c) => c.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  type ProfileLite = { id: string; full_name: string | null; email: string | null };
  const map = new Map<string, ProfileLite>(
    ((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]),
  );
  return configs.map((c) => ({
    ...c,
    nombre: map.get(c.user_id)?.full_name ?? null,
    email: map.get(c.user_id)?.email ?? null,
  }));
}

export async function upsertVendedoraConfig(
  config: TablesInsert<"vendedora_config">,
): Promise<void> {
  const { error } = await supabase
    .from("vendedora_config")
    .upsert(config, { onConflict: "organization_id,user_id" });
  if (error) throw error;
}

export async function updateVendedoraConfig(
  id: string,
  changes: TablesUpdate<"vendedora_config">,
): Promise<void> {
  const { error } = await supabase.from("vendedora_config").update(changes).eq("id", id);
  if (error) throw error;
}

/** Lista usuarios miembros de la organización actual con rol `vendedor` o `admin`. */
export interface UsuarioVendedor { id: string; full_name: string | null; email: string | null }

export async function fetchUsuariosVendedores(): Promise<UsuarioVendedor[]> {
  // user_roles + profiles join. Filtramos por rol vendedor.
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["vendedor", "admin"]);
  if (error) throw error;
  const ids = Array.from(new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)));
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  return ((profiles ?? []) as UsuarioVendedor[]).sort((a, b) =>
    (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""),
  );
}

export interface EmbarqueSinVendedora {
  id: string;
  expediente: string;
  cliente_nombre: string;
  fecha_creacion: string;
}

export async function fetchEmbarquesSinVendedora(): Promise<EmbarqueSinVendedora[]> {
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, created_at")
    .is("vendedora_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string; expediente: string; cliente_nombre: string; created_at: string;
  }>).map((e) => ({
    id: e.id,
    expediente: e.expediente,
    cliente_nombre: e.cliente_nombre,
    fecha_creacion: e.created_at,
  }));
}

export async function asignarVendedoraEmbarque(
  embarqueId: string,
  vendedoraId: string,
): Promise<void> {
  const { error } = await supabase
    .from("embarques")
    .update({ vendedora_id: vendedoraId })
    .eq("id", embarqueId);
  if (error) throw error;
}
