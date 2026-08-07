/**
 * Mutaciones de tarifas marítimas + recargos hijos. Divisa siempre USD (Fase 3).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoTarifa } from "@/features/costeo/types";
import { run, unwrap } from "@/lib/supabase/response";
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

function buildRecargoRows(
  tarifaId: string,
  organizationId: string,
  recargos: TarifaRecargoInput[],
) {
  return recargos
    .filter((r) => r.concepto.trim() && Number(r.monto) > 0)
    .map((r) => ({
      tarifa_id: tarifaId,
      // M7: la org viaja explícita; el trigger de BD la re-deriva del padre.
      organization_id: organizationId,
      concepto: r.concepto.trim(),
      lado: r.lado ?? "origen",
      monto: Number(r.monto) || 0,
      moneda: "USD",
      incluido_en_total: r.incluido_en_total ?? true,
    }));
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

export async function insertTarifaConRecargos(
  organizationId: string,
  input: TarifaInput,
): Promise<CosteoTarifa> {
  const { recargos, ...rest } = input;
  const tarifa = sanitizeTarifaDates(rest);
  const data = await unwrap(
    supabase
      .from("costeo_tarifas")
      .insert({
        ...tarifa,
        moneda: "USD",
        estado: "vigente",
        organization_id: organizationId,
      })
      .select("*")
      .single(),
  );

  const rows = buildRecargoRows(data.id, organizationId, recargos);
  if (rows.length > 0) {
    await run(supabase.from("costeo_tarifa_recargos").insert(rows));
  }
  await registrarActividad({
    modulo: "costeo",
    accion: "crear_tarifa",
    entidadId: data.id,
    entidadNombre: nombreTarifa(input),
  });
  return data as CosteoTarifa;
}

export async function updateTarifaConRecargos(
  id: string,
  input: TarifaInput,
): Promise<void> {
  const { recargos, ...rest } = input;
  const tarifa = sanitizeTarifaDates(rest);
  const padre = await unwrap(
    supabase.from("costeo_tarifas").select("organization_id").eq("id", id).single(),
  );
  await run(
    supabase.from("costeo_tarifas").update({ ...tarifa, moneda: "USD" }).eq("id", id),
  );

  // Sincronizar recargos: borrar todos los existentes y reinsertar los nuevos.
  await run(supabase.from("costeo_tarifa_recargos").delete().eq("tarifa_id", id));

  const rows = buildRecargoRows(id, padre.organization_id, recargos);
  if (rows.length > 0) {
    await run(supabase.from("costeo_tarifa_recargos").insert(rows));
  }
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
