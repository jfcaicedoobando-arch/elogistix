/**
 * Servicio de plantillas de cotización — aísla el I/O contra Supabase para
 * cumplir la jerarquía Pages → Hooks → Services → Lib.
 * (Extraído de `hooks/useCotizacionPlantillas.ts` en v13.297.4.)
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { registrarActividad } from "@/services/bitacora/registrar";

export type PlantillaVisibilidad = "yo" | "org";

export interface PlantillaPayload {
  /** Versión del payload — permite migración defensiva si el schema cambia. */
  version: 1;
  /** Valores base del wizard, sin folios/fechas/tarifa. */
  values: Partial<CotizacionFormValues>;
}

export interface CotizacionPlantilla {
  id: string;
  organization_id: string;
  usuario_id: string | null;
  nombre: string;
  descripcion: string | null;
  visibilidad: PlantillaVisibilidad;
  payload: PlantillaPayload;
  veces_usada: number;
  ultima_uso_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, organization_id, usuario_id, nombre, descripcion, visibilidad, payload, veces_usada, ultima_uso_at, created_at, updated_at";

export async function fetchPlantillas(organizationId: string): Promise<CotizacionPlantilla[]> {
  const { data, error } = await supabase
    .from("cotizacion_plantillas")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("veces_usada", { ascending: false })
    .order("ultima_uso_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  // SAFE-CAST: `payload` es jsonb en BD; validamos su shape al consumirlo.
  return (data ?? []) as unknown as CotizacionPlantilla[];
}

export interface InsertPlantillaInput {
  organizationId: string;
  usuarioId: string;
  nombre: string;
  descripcion?: string | null;
  visibilidad: PlantillaVisibilidad;
  payload: PlantillaPayload;
}

export async function insertPlantilla(input: InsertPlantillaInput): Promise<CotizacionPlantilla> {
  const { data, error } = await supabase
    .from("cotizacion_plantillas")
    .insert({
      organization_id: input.organizationId,
      usuario_id: input.usuarioId,
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      visibilidad: input.visibilidad,
      // SAFE-CAST: payload es jsonb; el schema del insert espera Json.
      payload: input.payload as unknown as never,
    })
    .select()
    .single();
  if (error) throw error;
  // SAFE-CAST: mismo motivo que `fetchPlantillas`.
  const plantilla = data as unknown as CotizacionPlantilla;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "crear_plantilla_cotizacion",
    entidadId: plantilla.id,
    entidadNombre: input.nombre.trim(),
  });
  return plantilla;

}

export async function aplicarPlantillaRpc(plantillaId: string): Promise<PlantillaPayload> {
  const { data, error } = await supabase.rpc("aplicar_plantilla_cotizacion", {
    _plantilla_id: plantillaId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con el payload de la plantilla.
  return data as unknown as PlantillaPayload;
}

export async function softDeletePlantilla(id: string): Promise<void> {
  const { error } = await supabase
    .from("cotizacion_plantillas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "eliminar_plantilla_cotizacion",
    entidadId: id,
  });
}

export interface UpdatePlantillaMetaPatch {
  nombre?: string;
  descripcion?: string | null;
  visibilidad?: PlantillaVisibilidad;
}

export async function updatePlantillaMeta(id: string, patch: UpdatePlantillaMetaPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from("cotizacion_plantillas")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "editar_plantilla_cotizacion",
    entidadId: id,
    detalles: { campos: Object.keys(patch) },
  });
}
