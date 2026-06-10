/**
 * Servicio: condiciones por naviera y tabulador escalonado de demoras.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CosteoNavieraCondicion,
  DemorasTramo,
  NavieraCondicionInput,
  DemorasTramoInput,
} from "@/features/costeo/types/navieraCondicion";

export interface NavieraCondicionConNombre extends CosteoNavieraCondicion {
  naviera_nombre: string;
  naviera_code: string;
  proveedor_nombre: string | null;
}

export async function fetchCondicionesNaviera(
  organizationId: string,
): Promise<NavieraCondicionConNombre[]> {
  const { data, error } = await supabase
    .from("costeo_navieras_condiciones")
    .select("*, naviera:navieras(name, code), proveedor:proveedores(nombre)")
    .eq("organization_id", organizationId);
  if (error) throw error;
  type Row = CosteoNavieraCondicion & {
    naviera: { name: string; code: string } | null;
    proveedor: { nombre: string } | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    ...r,
    naviera_nombre: r.naviera?.name ?? "",
    naviera_code: r.naviera?.code ?? "",
    proveedor_nombre: r.proveedor?.nombre ?? null,
  }));
}

export async function upsertCondicionNaviera(
  organizationId: string,
  input: NavieraCondicionInput,
  id?: string,
): Promise<CosteoNavieraCondicion> {
  const payload = {
    organization_id: organizationId,
    naviera_id: input.naviera_id,
    proveedor_id: input.proveedor_id,
    tiene_carta_garantia: input.tiene_carta_garantia,
    carta_garantia_vigente_hasta: input.tiene_carta_garantia
      ? input.carta_garantia_vigente_hasta
      : null,
    carta_garantia_folio: input.tiene_carta_garantia ? input.carta_garantia_folio : null,
    carta_garantia_notas: input.carta_garantia_notas,
    dias_libres_demoras_default: input.dias_libres_demoras_default,
    moneda_demoras: input.moneda_demoras,
    notas: input.notas,
  };
  if (id) {
    const { data, error } = await supabase
      .from("costeo_navieras_condiciones")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as CosteoNavieraCondicion;
  }
  const { data, error } = await supabase
    .from("costeo_navieras_condiciones")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as CosteoNavieraCondicion;
}

export async function deleteCondicionNaviera(id: string): Promise<void> {
  const { error } = await supabase.from("costeo_navieras_condiciones").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchDemorasTramos(
  navieraCondicionId: string,
): Promise<DemorasTramo[]> {
  const { data, error } = await supabase
    .from("costeo_naviera_demoras_tarifa")
    .select("*")
    .eq("naviera_condicion_id", navieraCondicionId)
    .order("tipo_contenedor_id")
    .order("desde_dia");
  if (error) throw error;
  return (data ?? []) as DemorasTramo[];
}

/**
 * Reemplaza el tabulador completo del (condicion × tipo_contenedor):
 * elimina los tramos existentes y reinserta los nuevos. Es la estrategia
 * más simple para evitar inconsistencias parciales (similar al patrón usado
 * en editar embarques con conceptos).
 */
export async function replaceDemorasTramos(
  navieraCondicionId: string,
  tipoContenedorId: string,
  tramos: DemorasTramoInput[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("costeo_naviera_demoras_tarifa")
    .delete()
    .eq("naviera_condicion_id", navieraCondicionId)
    .eq("tipo_contenedor_id", tipoContenedorId);
  if (delErr) throw delErr;
  if (tramos.length === 0) return;
  const rows = tramos.map((t) => ({
    naviera_condicion_id: navieraCondicionId,
    tipo_contenedor_id: tipoContenedorId,
    desde_dia: t.desde_dia,
    hasta_dia: t.hasta_dia,
    monto_por_dia: t.monto_por_dia,
    moneda: t.moneda,
  }));
  const { error } = await supabase.from("costeo_naviera_demoras_tarifa").insert(rows);
  if (error) throw error;
}

export interface TipoContenedorOpcion {
  id: string;
  code: string;
  name: string;
}

/** Tipos de contenedor relevantes para tabulador de demoras marítimas. */
const CODES_DEMORAS = ["20DRY", "40DRY", "40HC", "20RF", "40HCRF"];

export async function fetchTiposContenedorParaDemoras(): Promise<TipoContenedorOpcion[]> {
  const { data, error } = await supabase
    .from("tipos_contenedor")
    .select("id, code, name")
    .in("code", CODES_DEMORAS)
    .order("code");
  if (error) throw error;
  return (data ?? []) as TipoContenedorOpcion[];
}

export async function fetchNavierasCatalogo(): Promise<{ id: string; name: string; code: string }[]> {
  const { data, error } = await supabase
    .from("navieras")
    .select("id, name, code")
    .eq("activo", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; code: string }[];
}
