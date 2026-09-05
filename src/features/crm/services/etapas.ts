/**
 * Servicio CRM — Etapas del pipeline y motivos de pérdida.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Database } from "@/integrations/supabase/types";

export type CrmEtapaRow = Database["public"]["Tables"]["crm_etapas_pipeline"]["Row"];
export type CrmEtapaTipo = Database["public"]["Enums"]["crm_etapa_tipo"];

const COLS =
  "id, nombre, orden, tipo, color, probabilidad_default, activa, crea_tarea_seguimiento, dias_seguimiento, sla_dias, organization_id, created_at, updated_at";

export async function fetchEtapasPipelineActivas(): Promise<CrmEtapaRow[]> {
  return unwrapOr(
    supabase
      .from("crm_etapas_pipeline")
      .select(COLS)
      .eq("activa", true)
      .order("orden", { ascending: true }),
    [],
  ) as Promise<CrmEtapaRow[]>;
}

export async function fetchEtapasPipelineTodas(): Promise<CrmEtapaRow[]> {
  return unwrapOr(
    supabase.from("crm_etapas_pipeline").select(COLS).order("orden", { ascending: true }),
    [],
  ) as Promise<CrmEtapaRow[]>;
}

export type EtapaPatch = Partial<
  Pick<
    CrmEtapaRow,
    | "nombre"
    | "orden"
    | "tipo"
    | "color"
    | "probabilidad_default"
    | "activa"
    | "crea_tarea_seguimiento"
    | "dias_seguimiento"
    | "sla_dias"
  >
>;

/**
 * PostgREST devuelve 0 filas SIN error cuando RLS filtra la etapa, ya fue
 * eliminada o el id no existe. Se exige la fila afectada antes de registrar
 * bitácora para no reportar éxito de un cambio que nunca ocurrió (mismo
 * patrón que `actualizarOportunidadFilas`).
 */
export async function actualizarEtapa(input: { id: string; patch: EtapaPatch }): Promise<void> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .update(input.patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("No se pudo actualizar la etapa: no tienes permiso o la etapa ya no existe.");
  }
  await registrarActividad({
    modulo: "crm",
    accion: "Editó etapa de pipeline",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
}

/**
 * Intercambia el `orden` entre dos etapas de la misma organización en una sola
 * transacción (RPC con bloqueo de filas). Evita órdenes duplicados por doble
 * clic o concurrencia: el UPDATE simple no basta porque no toca a la vecina.
 */
export async function intercambiarOrdenEtapas(input: {
  etapaA: string;
  etapaB: string;
}): Promise<void> {
  await run(
    supabase.rpc("crm_intercambiar_orden_etapas", {
      p_etapa_a: input.etapaA,
      p_etapa_b: input.etapaB,
    }),
  );
  await registrarActividad({
    modulo: "crm",
    accion: "Reordenó etapas de pipeline",
    entidadId: input.etapaA,
    detalles: { intercambio_con: input.etapaB },
  });
}

export interface MotivoPerdidaRow {
  id: string;
  nombre: string;
  activa: boolean;
}

export async function fetchMotivosPerdida(soloActivos = true): Promise<MotivoPerdidaRow[]> {
  let q = supabase.from("crm_motivos_perdida").select("id, nombre, activa").order("nombre");
  if (soloActivos) q = q.eq("activa", true);
  return unwrapOr(q, []) as Promise<MotivoPerdidaRow[]>;
}

export async function actualizarMotivoPerdida(input: {
  id: string;
  patch: { nombre?: string; activa?: boolean };
}): Promise<void> {
  const { data, error } = await supabase
    .from("crm_motivos_perdida")
    .update(input.patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo actualizar el motivo de pérdida: no tienes permiso o el motivo ya no existe.",
    );
  }
  await registrarActividad({
    modulo: "crm",
    accion: "Editó motivo de pérdida",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
}

export async function crearMotivoPerdida(nombre: string): Promise<void> {
  await run(supabase.from("crm_motivos_perdida").insert({ nombre, activa: true }));
  await registrarActividad({ modulo: "crm", accion: "Creó motivo de pérdida", entidadNombre: nombre });
}
