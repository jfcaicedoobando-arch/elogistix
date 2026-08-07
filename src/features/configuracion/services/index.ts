/**
 * Servicio de configuración: lectura/escritura de las tablas `configuracion`
 * (organización-scope) y `configuracion_global` (sistema). Las claves son JSON arbitrario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr } from "@/lib/supabase/response";

export interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
  organization_id?: string;
}

// ── Configuración por organización (usada por panel de admin de ORG) ───────
export async function fetchConfiguracionByOrg(orgId: string): Promise<ConfigItem[]> {
  return fromDb<ConfigItem[]>(
    await unwrapOr(
      supabase
        .from("configuracion")
        .select("*")
        .eq("organization_id", orgId)
        .order("categoria")
        .order("clave"),
      [],
    ),
  );
}

// ── Configuración (todas las orgs según RLS — usada por hook useConfiguracion) ─
export async function fetchConfiguracion(): Promise<ConfigItem[]> {
  return fromDb<ConfigItem[]>(
    await unwrapOr(
      supabase.from("configuracion").select("*").order("categoria").order("clave"),
      [],
    ),
  );
}

type ConfigTable = "configuracion" | "configuracion_global";

/**
 * Helper privado: aplica una lista de updates `{ valor }` sobre cualquiera de
 * las dos tablas de configuración. Encapsula el `Promise.all` y la
 * propagación del primer error.
 */
async function updateConfigItems(
  table: ConfigTable,
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from(table)
        .update({ valor: item.valor as Json })
        .eq("categoria", item.categoria)
        .eq("clave", item.clave),
    ),
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;
  await registrarActividad({
    modulo: "configuracion",
    accion: table === "configuracion_global" ? "editar_configuracion_global" : "editar_configuracion",
    detalles: { claves: items.map((i) => `${i.categoria}.${i.clave}`) },
  });
}

export async function updateConfiguracionByCategoriaClave(
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  return updateConfigItems("configuracion", items);
}

// ── Configuración global (sistema, super-admin) ────────────────────────────
export interface ConfigGlobalItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
}

export async function fetchConfiguracionGlobal(): Promise<ConfigGlobalItem[]> {
  return fromDb<ConfigGlobalItem[]>(
    await unwrapOr(
      supabase
        .from("configuracion_global")
        .select("*")
        .order("categoria")
        .order("clave"),
      [],
    ),
  );
}

export async function updateConfiguracionGlobalItems(
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  return updateConfigItems("configuracion_global", items);
}
export * from "./emisor";
