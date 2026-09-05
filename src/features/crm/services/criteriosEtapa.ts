/**
 * Servicio CRM — criterios de salida por etapa y su cumplimiento por oportunidad.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { AvanceCriterios } from "@/features/crm/domain/criterios";

const CRITERIO_COLS = "id, etapa_id, nombre, orden, obligatorio, activo";

export interface CriterioEtapaRow {
  id: string;
  etapa_id: string;
  nombre: string;
  orden: number;
  obligatorio: boolean;
  activo: boolean;
}

export interface CumplimientoRow {
  id: string;
  criterio_id: string;
  cumplido_at: string;
  cumplido_por: string | null;
}

export async function fetchCriteriosPorEtapa(etapaId?: string): Promise<CriterioEtapaRow[]> {
  let q = supabase
    .from("crm_etapa_criterios")
    .select(CRITERIO_COLS)
    .is("deleted_at", null)
    .order("orden", { ascending: true });
  if (etapaId) q = q.eq("etapa_id", etapaId);
  return unwrapOr(q, []) as Promise<CriterioEtapaRow[]>;
}

export async function crearCriterioEtapa(input: {
  etapa_id: string;
  nombre: string;
  orden: number;
  obligatorio: boolean;
}): Promise<void> {
  await run(supabase.from("crm_etapa_criterios").insert({ ...input, activo: true }));
  await registrarActividad({
    modulo: "crm",
    accion: "Creó criterio de salida",
    entidadNombre: input.nombre,
    detalles: { etapa_id: input.etapa_id },
  });
}

export async function actualizarCriterioEtapa(input: {
  id: string;
  patch: Partial<Pick<CriterioEtapaRow, "nombre" | "orden" | "obligatorio" | "activo">>;
}): Promise<void> {
  const { data, error } = await supabase
    .from("crm_etapa_criterios")
    .update(input.patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo actualizar el criterio de salida: no tienes permiso o el criterio ya no existe.",
    );
  }
  await registrarActividad({
    modulo: "crm",
    accion: "Editó criterio de salida",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
}

export async function eliminarCriterioEtapa(id: string, userId: string | null): Promise<void> {
  const { data, error } = await supabase
    .from("crm_etapa_criterios")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, activo: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo eliminar el criterio de salida: no tienes permiso o el criterio ya no existe.",
    );
  }
  await registrarActividad({ modulo: "crm", accion: "Eliminó criterio de salida", entidadId: id });
}

export async function fetchCumplimientoOportunidad(oportunidadId: string): Promise<CumplimientoRow[]> {
  return unwrapOr(
    supabase
      .from("crm_oportunidad_criterios")
      .select("id, criterio_id, cumplido_at, cumplido_por")
      .eq("oportunidad_id", oportunidadId),
    [],
  ) as Promise<CumplimientoRow[]>;
}

export async function marcarCriterio(input: {
  oportunidadId: string;
  criterioId: string;
  cumplido: boolean;
  userId: string | null;
}): Promise<void> {
  if (input.cumplido) {
    await run(
      supabase.from("crm_oportunidad_criterios").upsert(
        {
          oportunidad_id: input.oportunidadId,
          criterio_id: input.criterioId,
          cumplido_at: new Date().toISOString(),
          cumplido_por: input.userId,
        },
        { onConflict: "oportunidad_id,criterio_id" },
      ),
    );
  } else {
    await run(
      supabase
        .from("crm_oportunidad_criterios")
        .delete()
        .eq("oportunidad_id", input.oportunidadId)
        .eq("criterio_id", input.criterioId),
    );
  }
  await registrarActividad({
    modulo: "crm",
    accion: input.cumplido ? "Marcó criterio cumplido" : "Desmarcó criterio",
    entidadId: input.oportunidadId,
    detalles: { criterio_id: input.criterioId },
  });
}

/** Avance de criterios en lote (RPC) para pintar el Kanban sin N consultas. */
export async function fetchAvanceCriterios(
  oportunidadIds: string[],
): Promise<Map<string, AvanceCriterios>> {
  if (oportunidadIds.length === 0) return new Map();
  const rows = (await unwrap(
    supabase.rpc("crm_criterios_avance", { p_oportunidad_ids: oportunidadIds }),
  )) as {
    oportunidad_id: string;
    total: number;
    cumplidos: number;
    obligatorios_pendientes: number;
  }[] | null;
  const map = new Map<string, AvanceCriterios>();
  for (const r of rows ?? []) {
    map.set(r.oportunidad_id, {
      total: Number(r.total ?? 0),
      cumplidos: Number(r.cumplidos ?? 0),
      obligatoriosPendientes: Number(r.obligatorios_pendientes ?? 0),
    });
  }
  return map;
}
