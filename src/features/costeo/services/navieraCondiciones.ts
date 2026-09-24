/**
 * Servicio: condiciones por naviera y tabulador escalonado de demoras.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
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
  const condicion = (await unwrap(builder)) as CosteoNavieraCondicion;
  const naviera = await unwrapOr(
    supabase.from("navieras").select("name").eq("id", input.naviera_id).single(),
    { name: input.naviera_id },
  );
  await registrarActividad({
    modulo: "costeo",
    accion: id ? "editar_condicion_naviera" : "crear_condicion_naviera",
    entidadId: condicion.id,
    entidadNombre: (naviera as { name: string }).name,
  });
  return condicion;
}

export async function deleteCondicionNaviera(id: string): Promise<void> {
  await run(supabase.from("costeo_navieras_condiciones").delete().eq("id", id));
  await registrarActividad({
    modulo: "costeo",
    accion: "eliminar_condicion_naviera",
    entidadId: id,
  });
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
 * P1-5: reemplaza el tabulador (condición × tipo de contenedor) en UNA
 * transacción de BD. Si la inserción falla, se conserva el tabulador previo.
 */
export async function replaceDemorasTramos(
  navieraCondicionId: string,
  tipoContenedorId: string,
  tramos: DemorasTramoInput[],
): Promise<void> {
  const { data, error } = await supabase.rpc("reemplazar_demoras_tramos_rpc", {
    p_naviera_condicion_id: navieraCondicionId,
    p_tipo_contenedor_id: tipoContenedorId,
    p_tramos: tramos.map((t) => ({
      desde_dia: t.desde_dia,
      hasta_dia: t.hasta_dia,
      monto_por_dia: t.monto_por_dia,
      moneda: t.moneda,
    })),
  });
  if (error) throw error;
  const n = Number(data ?? 0);
  await registrarActividad({
    modulo: "costeo",
    accion: "editar_tabulador_demoras_naviera",
    entidadId: navieraCondicionId,
    entidadNombre: `Tabulador ${tipoContenedorId} (${n === 0 ? "vacío" : `${n} tramos`})`,
  });
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
