/**
 * Servicio de configuración: lectura/escritura de las tablas `configuracion`
 * (organización-scope) y `configuracion_global` (sistema). Las claves son JSON arbitrario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";

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
  const { data, error } = await supabase
    .from("configuracion")
    .select("*")
    .eq("organization_id", orgId)
    .order("categoria")
    .order("clave");
  if (error) throw error;
  return fromDb<ConfigItem[]>(data ?? []);
}

export async function updateConfiguracionItems(
  items: { id: string; valor: unknown }[],
): Promise<void> {
  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from("configuracion")
        .update({ valor: item.valor as Json })
        .eq("id", item.id),
    ),
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;
}

// ── Configuración (todas las orgs según RLS — usada por hook useConfiguracion) ─
export async function fetchConfiguracion(): Promise<ConfigItem[]> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("*")
    .order("categoria")
    .order("clave");
  if (error) throw error;
  return fromDb<ConfigItem[]>(data ?? []);
}

export async function updateConfiguracionByCategoriaClave(
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from("configuracion")
        .update({ valor: item.valor as Json })
        .eq("categoria", item.categoria)
        .eq("clave", item.clave),
    ),
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;
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
  const { data, error } = await supabase
    .from("configuracion_global")
    .select("*")
    .order("categoria")
    .order("clave");
  if (error) throw error;
  return fromDb<ConfigGlobalItem[]>(data ?? []);
}

export async function updateConfiguracionGlobalItems(
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from("configuracion_global")
      .update({ valor: JSON.parse(JSON.stringify(item.valor)) })
      .eq("categoria", item.categoria)
      .eq("clave", item.clave);
    if (error) throw error;
  }
}
