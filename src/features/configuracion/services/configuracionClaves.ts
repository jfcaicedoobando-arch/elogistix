/**
 * Lectura/escritura de las tablas `configuracion` (organización-scope) y
 * `configuracion_global` (sistema). Las claves guardan JSON arbitrario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { ConfigGlobalItem, ConfigItem, ConfigTable } from "./configuracionTypes";

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

// ── Configuración de la organización activa (hook useConfiguracion) ─────────
export async function fetchConfiguracion(orgId: string): Promise<ConfigItem[]> {
  // Ola 4 · N11 (fail-closed): `configuracion` es org-scope; sin filtro, el
  // .find() de getVal leía la fila de CUALQUIER tenant que la RLS devolviera
  // primero (super_admin).
  if (!orgId) {
    throw new Error("fetchConfiguracion requiere organizationId (fail-closed N11).");
  }
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

/**
 * Helper privado: aplica una lista de updates `{ valor }` sobre cualquiera de
 * las dos tablas de configuración. Encapsula el `Promise.all` y la
 * propagación del primer error.
 */
async function updateConfigItems(
  table: ConfigTable,
  items: { categoria: string; clave: string; valor: unknown }[],
  orgId?: string,
): Promise<void> {
  // Ola 4 · N11: el UPDATE por (categoria, clave) sin organization_id pisaba
  // la clave en TODAS las organizaciones cuando guardaba un super_admin (la
  // RLS "Tenant admin configuracion" le permite escribir en cualquier tenant).
  // `configuracion_global` SÍ es global: no lleva filtro a propósito.
  if (table === "configuracion" && !orgId) {
    throw new Error("updateConfigItems(configuracion) requiere organizationId (fail-closed N11).");
  }
  const results = await Promise.all(
    items.map((item) => {
      if (table === "configuracion") {
        // Ronda YAGNI · defecto 5: en organizaciones nuevas la fila de la clave
        // no existe, así que el UPDATE afectaba 0 filas y la UI decía "guardado"
        // sin persistir nada. Con upsert se crea la fila del tenant, y el
        // `select` permite detectar el caso de 0 filas afectadas.
        return supabase
          .from("configuracion")
          .upsert(
            {
              organization_id: orgId as string,
              categoria: item.categoria,
              clave: item.clave,
              valor: item.valor as Json,
            },
            { onConflict: "organization_id,categoria,clave" },
          )
          .select("id");
      }
      return supabase
        .from("configuracion_global")
        .update({ valor: item.valor as Json })
        .eq("categoria", item.categoria)
        .eq("clave", item.clave)
        .select("id");
    }),
  );

  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;
  // Fail-closed: si la RLS o una clave inexistente dejan 0 filas escritas, no
  // reportamos éxito.
  const vacio = results.findIndex((r) => (r.data ?? []).length === 0);
  if (vacio >= 0) {
    const it = items[vacio];
    throw new Error(
      `No se pudo guardar la configuración "${it.categoria}.${it.clave}": no se escribió ningún registro (revisa tus permisos).`,
    );
  }
  await registrarActividad({
    modulo: "configuracion",
    accion: table === "configuracion_global" ? "editar_configuracion_global" : "editar_configuracion",
    detalles: { claves: items.map((i) => `${i.categoria}.${i.clave}`) },
  });
}

export async function updateConfiguracionByCategoriaClave(
  orgId: string,
  items: { categoria: string; clave: string; valor: unknown }[],
): Promise<void> {
  return updateConfigItems("configuracion", items, orgId);
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

// ── Cierre de periodo contable (RPC dedicada, con motivo + bitácora) ───────
export async function actualizarCierrePeriodo(
  orgId: string,
  fecha: string | null,
  motivo?: string,
): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { run } = await import("@/lib/supabase/response");
  // SAFE-CAST: RPC nueva, types.ts pendiente de regenerar.
  await run(
    supabase.rpc("actualizar_cierre_periodo" as never, {
      p_org: orgId,
      p_fecha: fecha,
      p_motivo: motivo ?? null,
    } as never),
  );
}
