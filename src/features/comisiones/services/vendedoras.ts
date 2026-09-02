/**
 * Servicio para vendedoras: config de % y catálogo de usuarios con rol vendedor.
 * Nombres/emails vía edge function `user-management` action `list` (no hay tabla profiles).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrapOr, run } from "@/lib/supabase/response";
import { fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import { registrarActividad } from "@/services/bitacora/registrar";

export type VendedoraConfigRow = Tables<"vendedora_config">;

export interface VendedoraConfig extends VendedoraConfigRow {
  nombre: string | null;
  email: string | null;
}

export interface UsuarioVendedor { id: string; nombre: string; email: string }

/** Mapa id → nombre (no hay email disponible desde `list-nombres`). */
async function buildNombreMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const users = await fetchNombresUsuarios();
    const map: Record<string, string> = {};
    for (const u of users) {
      if (ids.includes(u.id) && u.full_name) map[u.id] = u.full_name;
    }
    return map;
  } catch {
    return {};
  }
}

// v13.56.1 — Columnas explícitas (evita SELECT * en tablas financieras).
const VENDEDORA_CONFIG_COLUMNS =
  "id, organization_id, user_id, porcentaje_default, activa, fecha_alta, created_at, updated_at";

export async function fetchVendedorasConfig(): Promise<VendedoraConfig[]> {
  const configs = (await unwrapOr(
    supabase
      .from("vendedora_config")
      .select(VENDEDORA_CONFIG_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200),
    [],
  )) as VendedoraConfigRow[];
  const map = await buildNombreMap(configs.map((c) => c.user_id));
  return configs.map((c) => ({
    ...c,
    nombre: map[c.user_id] ?? UNRESOLVED_EMAIL,
    email: map[c.user_id] ?? UNRESOLVED_EMAIL,
  }));
}

// Decisión: la config de % de comisión de la vendedora es un dato de
// usuarios/roles, no un movimiento financiero en sí, así que se audita en el
// módulo `usuarios`.
export async function upsertVendedoraConfig(
  config: TablesInsert<"vendedora_config">,
): Promise<void> {
  await run(
    supabase
      .from("vendedora_config")
      .upsert(config, { onConflict: "organization_id,user_id" }),
  );
  await registrarActividad({
    modulo: "usuarios",
    accion: "configurar_vendedora",
    entidadId: config.user_id,
    detalles: { porcentaje_default: config.porcentaje_default, activa: config.activa },
  });
}

export async function updateVendedoraConfig(
  id: string,
  changes: TablesUpdate<"vendedora_config">,
): Promise<void> {
  await run(supabase.from("vendedora_config").update(changes).eq("id", id));
  await registrarActividad({
    modulo: "usuarios",
    accion: "actualizar_configuracion_vendedora",
    entidadId: id,
    detalles: { ...changes },
  });
}

/** Usuarios de la org con rol vendedor o admin (candidatos a vendedora). */
export async function fetchUsuariosVendedores(): Promise<UsuarioVendedor[]> {
  const data = await unwrapOr(
    supabase.from("organization_members").select("user_id, role"),
    [],
  );
  const rows = (data as Array<{ user_id: string; role: string }>)
    .filter((r) => r.role === "vendedor" || r.role === "admin");
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const map = await buildNombreMap(ids);
  return ids.map((id) => ({
    id,
    nombre: map[id] ?? UNRESOLVED_EMAIL,
    email: map[id] ?? UNRESOLVED_EMAIL,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export interface EmbarqueSinVendedora {
  id: string;
  expediente: string;
  cliente_nombre: string;
  fecha_creacion: string;
}

export async function fetchEmbarquesSinVendedora(): Promise<EmbarqueSinVendedora[]> {
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, expediente, cliente_nombre, created_at, sin_comision, clientes(sin_comision)")
      .is("vendedora_id", null)
      // v13.386.0 — Excluidos explícitos no son "pendientes por asignar".
      .or("sin_comision.is.null,sin_comision.eq.false")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    [],
  );
  const rows = data as Array<{
    id: string; expediente: string; cliente_nombre: string; created_at: string;
    sin_comision: boolean | null;
    clientes?: { sin_comision: boolean | null } | null;
  }>;
  return rows
    // Herencia del cliente: si el cliente es cuenta directa y el embarque no
    // fuerza "sí genera", tampoco es un pendiente.
    .filter((e) => e.sin_comision === false || !e.clientes?.sin_comision)
    .map((e) => ({
      id: e.id,
      expediente: e.expediente,
      cliente_nombre: e.cliente_nombre,
      fecha_creacion: e.created_at,
    }));
}

// Decisión: reasignar la vendedora de un embarque es una mutación del
// embarque en sí, así que se audita en el módulo `embarques`.
export async function asignarVendedoraEmbarque(
  embarqueId: string,
  vendedoraId: string,
): Promise<void> {
  await run(
    supabase.from("embarques").update({ vendedora_id: vendedoraId }).eq("id", embarqueId),
  );
  await registrarActividad({
    modulo: "embarques",
    accion: "asignar_vendedora_embarque",
    entidadId: embarqueId,
    detalles: { vendedora_id: vendedoraId },
  });
}
