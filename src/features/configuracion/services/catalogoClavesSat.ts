/**
 * CRUD del catálogo maestro de productos/servicios por organización.
 * Extraído de `CatalogoClavesSATCard.tsx` para respetar la capa
 * componente → service → supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface CatalogoClaveRow {
  id: string;
  organization_id: string;
  patron: string;
  clave_sat: string;
  activo: boolean;
  tipo_iva: string;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

export interface CatalogoClavePayload {
  patron: string;
  clave_sat: string;
  activo: boolean;
  tipo_iva: string;
  tasa_iva_default: number | null;
  clave_unidad_sat: string;
}

const COLUMNS =
  "id, organization_id, patron, clave_sat, activo, tipo_iva, clave_unidad_sat, nombre_unidad";

export async function fetchCatalogoClavesSat(): Promise<CatalogoClaveRow[]> {
  return (await unwrapOr(
    supabase.from("catalogo_claves_sat").select(COLUMNS).order("patron", { ascending: true }),
    [],
  )) as CatalogoClaveRow[];
}

export async function insertCatalogoClaveSat(
  organizationId: string,
  payload: CatalogoClavePayload,
): Promise<void> {
  await run(
    supabase
      .from("catalogo_claves_sat")
      .insert({ organization_id: organizationId, ...payload }),
  );
  await registrarActividad({
    modulo: "configuracion",
    accion: "crear_clave_catalogo_sat",
    entidadNombre: payload.patron,
    detalles: { clave_sat: payload.clave_sat, tipo_iva: payload.tipo_iva },
  });
}

export async function updateCatalogoClaveSat(
  id: string,
  payload: CatalogoClavePayload,
): Promise<void> {
  await run(supabase.from("catalogo_claves_sat").update(payload).eq("id", id));
  await registrarActividad({
    modulo: "configuracion",
    accion: "actualizar_clave_catalogo_sat",
    entidadId: id,
    entidadNombre: payload.patron,
    detalles: { clave_sat: payload.clave_sat, tipo_iva: payload.tipo_iva },
  });
}

export async function deleteCatalogoClaveSat(id: string): Promise<void> {
  await run(supabase.from("catalogo_claves_sat").delete().eq("id", id));
  await registrarActividad({
    modulo: "configuracion",
    accion: "eliminar_clave_catalogo_sat",
    entidadId: id,
  });
}
