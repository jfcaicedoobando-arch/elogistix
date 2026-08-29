import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import { run, unwrap, unwrapOr } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

const ROW_LIMIT = 5000;

/**
 * M-7: sin filtro de ventana `created_at`. La deduplicación de hallazgos es
 * por `detalle_hash` (no por fecha) — con el filtro `>= hoy-90d` anterior, un
 * hallazgo revisado hace más de 90 días "desaparecía" de esta lista y volvía
 * a mostrarse como pendiente aunque ya tuviera una revisión registrada.
 */
export async function fetchAuditoriaRevisiones(): Promise<AuditoriaRevision[]> {
  const data = await unwrapOr(
    supabase
      .from("auditoria_revisiones")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    [],
  );
  // SAFE-CAST: fila devuelve columnas del DTO ya declarado; la generic inferencia cae en never con .select("*").
  return data as unknown as AuditoriaRevision[];
}

export interface UpsertRevisionInput {
  organization_id: string;
  embarque_id: string;
  regla: HallazgoAuditoria["regla"];
  detalle_hash: string;
  detalle: string;
  accion_tomada: string;
  revisado_por: string;
  revisado_por_email: string;
}

export async function upsertAuditoriaRevision(
  input: UpsertRevisionInput,
): Promise<AuditoriaRevision> {
  if (!input.organization_id) {
    throw new Error("organization_id requerido para upsert de revisión");
  }
  const data = await unwrap(
    supabase
      .from("auditoria_revisiones")
      .upsert(
        {
          ...input,
          estado_revision: "revisado",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,embarque_id,regla,detalle_hash" },
      )
      .select()
      .single(),
  );
  await registrarActividad({
    modulo: "auditoria",
    accion: "Cerró revisión de hallazgo",
    entidadId: (data as AuditoriaRevision).id,
    detalles: {
      embarque_id: input.embarque_id,
      regla: input.regla,
      accion_tomada: input.accion_tomada,
    },
  });
  return data as AuditoriaRevision;
}

export interface AsignarResponsableInput {
  organization_id: string;
  embarque_id: string;
  regla: HallazgoAuditoria["regla"];
  detalle_hash: string;
  detalle: string;
  responsable_id: string | null;
  responsable_email: string;
  asignado_por: string;
  asignado_por_email: string;
  fecha_limite: string | null;
  /** Marca el hallazgo como "en_progreso" cuando el responsable lo toma. */
  estado_revision?: "pendiente" | "en_progreso";
}

/**
 * Asigna (o reasigna) un responsable a un hallazgo. Si la revisión no existe
 * la crea con estado=pendiente; si ya existe sólo actualiza la asignación
 * (Ola 4 · N29: un hallazgo `revisado` NUNCA se reabre por reasignación —
 * antes el upsert siempre pisaba estado_revision con `pendiente` y dejaba
 * revisado_por/revisado_por_email huérfanos).
 */
export async function asignarResponsableHallazgo(
  input: AsignarResponsableInput,
): Promise<AuditoriaRevision> {
  if (!input.organization_id) {
    throw new Error("organization_id requerido para asignar responsable");
  }
  const asignacion = {
    detalle: input.detalle,
    responsable_id: input.responsable_id,
    responsable_email: input.responsable_email,
    asignado_por: input.asignado_por,
    asignado_por_email: input.asignado_por_email,
    asignado_at: new Date().toISOString(),
    fecha_limite: input.fecha_limite,
  };
  const existente = (await unwrapOr(
    supabase
      .from("auditoria_revisiones")
      .select("id, estado_revision")
      .eq("organization_id", input.organization_id)
      .eq("embarque_id", input.embarque_id)
      .eq("regla", input.regla)
      .eq("detalle_hash", input.detalle_hash)
      .maybeSingle(),
    null,
  )) as { id: string; estado_revision: string | null } | null;

  const data = existente
    ? await unwrap(
        supabase
          .from("auditoria_revisiones")
          // Ola 4 · N29: estado_revision sólo se toca si la revisión NO está
          // revisada (permite pendiente → en_progreso al "tomar" el hallazgo,
          // sin reabrir jamás un revisado).
          .update(
            existente.estado_revision === "revisado"
              ? asignacion
              : { ...asignacion, estado_revision: input.estado_revision ?? "pendiente" },
          )
          .eq("id", existente.id)
          .select()
          .single(),
      )
    : await unwrap(
        supabase
          .from("auditoria_revisiones")
          .insert({
            organization_id: input.organization_id,
            embarque_id: input.embarque_id,
            regla: input.regla,
            detalle_hash: input.detalle_hash,
            ...asignacion,
            estado_revision: input.estado_revision ?? "pendiente",
          })
          .select()
          .single(),
      );
  await registrarActividad({
    modulo: "auditoria",
    accion: "Asignó responsable de hallazgo",
    entidadId: (data as AuditoriaRevision | null)?.id,
    detalles: {
      embarque_id: input.embarque_id,
      regla: input.regla,
      responsable_email: input.responsable_email,
      fecha_limite: input.fecha_limite,
    },
  });
  return data as AuditoriaRevision;
}

export async function deleteAuditoriaRevision(id: string): Promise<void> {
  await run(supabase.from("auditoria_revisiones").delete().eq("id", id));
  await registrarActividad({
    modulo: "auditoria",
    accion: "Eliminó revisión de hallazgo",
    entidadId: id,
  });
}
