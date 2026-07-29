/**
 * Servicio: condiciones por naviera y tabulador escalonado de demoras.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
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
  type Row = CosteoNavieraCondicion & {
    naviera: { name: string; code: string } | null;
    proveedor: { nombre: string } | null;
  };
  const data = await unwrapOr(
    supabase
      .from("costeo_navieras_condiciones")
      .select("*, naviera:navieras(name, code), proveedor:proveedores(nombre)")
      .eq("organization_id", organizationId),
    [] as Row[],
  );
  return (data as Row[]).map((r) => ({
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
  const builder = id
    ? supabase.from("costeo_navieras_condiciones").update(payload).eq("id", id).select("*").single()
    : supabase.from("costeo_navieras_condiciones").insert(payload).select("*").single();
  return unwrap(builder) as Promise<CosteoNavieraCondicion>;
}

export async function deleteCondicionNaviera(id: string): Promise<void> {
  await run(supabase.from("costeo_navieras_condiciones").delete().eq("id", id));
}

export async function fetchDemorasTramos(
  navieraCondicionId: string,
): Promise<DemorasTramo[]> {
  return unwrapOr(
    supabase
      .from("costeo_naviera_demoras_tarifa")
      .select("*")
      .eq("naviera_condicion_id", navieraCondicionId)
      .order("tipo_contenedor_id")
      .order("desde_dia"),
    [] as DemorasTramo[],
  ) as Promise<DemorasTramo[]>;
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
  await run(
    supabase
      .from("costeo_naviera_demoras_tarifa")
      .delete()
      .eq("naviera_condicion_id", navieraCondicionId)
      .eq("tipo_contenedor_id", tipoContenedorId),
  );
  if (tramos.length === 0) return;
  // M7: la org viaja explícita; el trigger de BD la re-deriva de la condición padre.
  const padre = await unwrap(
    supabase
      .from("costeo_navieras_condiciones")
      .select("organization_id")
      .eq("id", navieraCondicionId)
      .single(),
  );
  const rows = tramos.map((t) => ({
    naviera_condicion_id: navieraCondicionId,
    organization_id: padre.organization_id,
    tipo_contenedor_id: tipoContenedorId,
    desde_dia: t.desde_dia,
    hasta_dia: t.hasta_dia,
    monto_por_dia: t.monto_por_dia,
    moneda: t.moneda,
  }));
  await run(supabase.from("costeo_naviera_demoras_tarifa").insert(rows));
}

export interface TipoContenedorOpcion {
  id: string;
  code: string;
  name: string;
}

/** Tipos de contenedor relevantes para tabulador de demoras marítimas. */
const CODES_DEMORAS = ["20DRY", "40DRY", "40HC", "20RF", "40HCRF"];

export async function fetchTiposContenedorParaDemoras(): Promise<TipoContenedorOpcion[]> {
  return unwrapOr(
    supabase
      .from("tipos_contenedor")
      .select("id, code, name")
      .in("code", CODES_DEMORAS)
      .order("code"),
    [] as TipoContenedorOpcion[],
  ) as Promise<TipoContenedorOpcion[]>;
}

export async function fetchNavierasCatalogo(): Promise<{ id: string; name: string; code: string }[]> {
  return unwrapOr(
    supabase.from("navieras").select("id, name, code").eq("activo", true).order("name"),
    [] as { id: string; name: string; code: string }[],
  ) as Promise<{ id: string; name: string; code: string }[]>;
}
