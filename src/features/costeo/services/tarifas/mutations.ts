/**
 * Mutaciones de tarifas marítimas + recargos hijos. Divisa siempre USD (Fase 3).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoTarifa } from "@/features/costeo/types";
import { run } from "@/lib/supabase/response";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface TarifaRecargoInput {
  concepto: string;
  lado?: "origen" | "destino";
  monto: number;
  moneda?: string;
  incluido_en_total?: boolean;
}

export interface TarifaInput {
  agente_id: string;
  naviera_id: string;
  ruta_id: string;
  tipo_contenedor_id: string;
  flete_base: number;
  dias_libres_demoras: number;
  vigente_desde: string;
  vigente_hasta: string;
  transit_time_dias?: number | null;
  notas?: string | null;
  recargos: TarifaRecargoInput[];
}

/**
 * Normaliza campos `date` opcionales antes de mandarlos a Postgres: un `""`
 * genera `22007 invalid input syntax for type date` (Sentry JAVASCRIPT-REACT-1V).
 */
function sanitizeTarifaDates<T extends { vigente_desde: string; vigente_hasta: string }>(
  t: T,
): T & { vigente_desde: string | null; vigente_hasta: string | null } {
  return {
    ...t,
    vigente_desde: t.vigente_desde?.length ? t.vigente_desde : null,
    vigente_hasta: t.vigente_hasta?.length ? t.vigente_hasta : null,
  };
}

/** Etiqueta legible de una tarifa para bitácora (sin joins extra). */
function nombreTarifa(input: Pick<TarifaInput, "ruta_id" | "vigente_desde" | "vigente_hasta">): string {
  return `Ruta ${input.ruta_id} (${input.vigente_desde} → ${input.vigente_hasta})`;
}

/**
 * v13.823.159 — «Duplicar como nueva» fallaba en silencio: `costeo_tarifas` tiene
 * UNIQUE (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
 * vigente_desde), así que duplicar con la MISMA fecha de inicio de vigencia
 * devolvía 23505 con un texto de base de datos que no explicaba nada. No se
 * relaja la restricción (evita dos tarifas activas idénticas): se traduce.
 */
export const MSG_TARIFA_DUPLICADA =
  "Ya existe una tarifa para esa misma ruta, naviera y tipo de contenedor con la misma fecha de inicio de vigencia. " +
  "Cambia «Vigente desde» (o el tipo de contenedor / la ruta) para registrar una nueva versión.";

function traducirErrorTarifa(e: unknown): unknown {
  const code = (e as { code?: string } | null)?.code;
  const msg = (e as { message?: string } | null)?.message ?? "";
  if (code === "23505" || msg.includes("costeo_tarifas_organization_id_agente_id")) {
    // Sentry JAVASCRIPT-REACT-64: es una validación esperada que la UI ya
    // explica en un toast accionable, no un bug. `ReglaNegocioError` evita que
    // se abra un issue (ver `dropFiltersNegocio.ts`).
    return new ReglaNegocioError(MSG_TARIFA_DUPLICADA);
  }
  return e;
}

/** Recargos válidos para las RPC (concepto no vacío y monto > 0). */
function recargosParaRpc(recargos: TarifaRecargoInput[]) {
  return recargos
    .filter((r) => r.concepto.trim() && Number(r.monto) > 0)
    .map((r) => ({
      concepto: r.concepto.trim(),
      lado: r.lado ?? "origen",
      monto: Number(r.monto) || 0,
      incluido_en_total: r.incluido_en_total ?? true,
    }));
}

/**
 * P1-6: tarifa + recargos en UNA transacción (mismo patrón que la edición).
 * Si los recargos fallan no queda una tarifa incompleta, así que reintentar no
 * duplica: la UNIQUE de vigencia sigue protegiendo contra dobles altas.
 */
export async function insertTarifaConRecargos(
  organizationId: string,
  input: TarifaInput,
): Promise<CosteoTarifa> {
  const { recargos, ...rest } = input;
  const { data, error } = await supabase.rpc("crear_tarifa_con_recargos_rpc", {
    p_organization_id: organizationId,
    p_tarifa: sanitizeTarifaDates(rest),
    p_recargos: recargosParaRpc(recargos),
  });
  if (error) throw traducirErrorTarifa(error);
  const tarifa = data as unknown as CosteoTarifa; // SAFE-CAST: RPC devuelve la fila completa de costeo_tarifas.
  await registrarActividad({
    modulo: "costeo",
    accion: "crear_tarifa",
    entidadId: tarifa.id,
    entidadNombre: nombreTarifa(input),
  });
  return tarifa;
}

export async function updateTarifaConRecargos(
  id: string,
  input: TarifaInput,
): Promise<void> {
  const { recargos, ...rest } = input;
  const tarifa = sanitizeTarifaDates(rest);
  // Ola 6 · M7: update de la tarifa + reemplazo de recargos en UNA transacción.
  // Antes, si el insert de recargos fallaba, la tarifa quedaba sin recargos.
  const { error } = await supabase.rpc("actualizar_tarifa_con_recargos_rpc", {
    p_id: id,
    p_tarifa: tarifa,
    p_recargos: recargosParaRpc(recargos),
  });
  if (error) throw traducirErrorTarifa(error);
  await registrarActividad({
    modulo: "costeo",
    accion: "editar_tarifa",
    entidadId: id,
    entidadNombre: nombreTarifa(input),
  });
}

export async function marcarTarifaReemplazada(id: string): Promise<void> {
  await run(supabase.from("costeo_tarifas").update({ estado: "reemplazada" }).eq("id", id));
  await registrarActividad({
    modulo: "costeo",
    accion: "reemplazar_tarifa",
    entidadId: id,
  });
}

export async function deleteTarifa(id: string): Promise<void> {
  await run(supabase.from("costeo_tarifas").delete().eq("id", id));
  await registrarActividad({
    modulo: "costeo",
    accion: "eliminar_tarifa",
    entidadId: id,
  });
}
