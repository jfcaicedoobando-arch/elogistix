/**
 * Tarifas del Portal del Agente de Carga.
 * Extraído de `index.ts` para mantener ambos archivos bajo 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";

export interface AgenteTarifaRow {
  id: string;
  ruta_id: string;
  naviera_id: string;
  tipo_contenedor_id: string;
  moneda: string;
  flete_base: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: string;
  estado_aprobacion: string;
  motivo_rechazo: string | null;
  aprobada_en: string | null;
  transit_time_dias: number | null;
  dias_libres_demoras: number;
  notas: string | null;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
}

/** Forma cruda del join anidado de `costeo_tarifas` (alias de relaciones). */
type RawTarifaAgente = {
  id: string; ruta_id: string; naviera_id: string; tipo_contenedor_id: string;
  moneda: string; flete_base: number;
  vigente_desde: string; vigente_hasta: string; estado: string; estado_aprobacion: string;
  motivo_rechazo: string | null; aprobada_en: string | null;
  transit_time_dias: number | null; dias_libres_demoras: number | null;
  notas: string | null;
  costeo_agentes?: { nombre?: string } | null;
  navieras?: { name?: string } | null;
  tipos_contenedor?: { name?: string } | null;
  costeo_rutas?: {
    puerto_origen?: { name?: string } | null;
    puerto_destino?: { name?: string } | null;
  } | null;
};

/** Nombres legibles de las relaciones de una tarifa (guion largo si faltan). */
function nombresRelacionesTarifa(r: RawTarifaAgente) {
  const txt = (v?: string | null) => v ?? "—";
  return {
    agente_nombre: txt(r.costeo_agentes?.nombre),
    naviera_nombre: txt(r.navieras?.name),
    tipo_contenedor_nombre: txt(r.tipos_contenedor?.name),
    puerto_origen_nombre: txt(r.costeo_rutas?.puerto_origen?.name),
    puerto_destino_nombre: txt(r.costeo_rutas?.puerto_destino?.name),
  };
}

/** Lista todas las tarifas del agente autenticado (cualquier estado_aprobacion). */
export async function fetchAgenteTarifas(): Promise<AgenteTarifaRow[]> {
  const data = await unwrapOr(
    supabase
      .from("costeo_tarifas")
      .select(`
      id, ruta_id, naviera_id, tipo_contenedor_id, moneda, flete_base,
      vigente_desde, vigente_hasta, estado, estado_aprobacion,
      motivo_rechazo, aprobada_en,
      transit_time_dias, dias_libres_demoras, notas,
      costeo_agentes:agente_id(nombre),
      navieras:naviera_id(name),
      tipos_contenedor:tipo_contenedor_id(name),
      costeo_rutas:ruta_id(
        puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name),
        puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name)
      )
    `)
      .order("vigente_desde", { ascending: false })
      .limit(500),
    [],
  );
  // SAFE-CAST: alias de relaciones — el cliente generado infiere never en joins anidados.
  return (data as unknown as RawTarifaAgente[]).map((r) => ({
    id: r.id,
    ruta_id: r.ruta_id,
    naviera_id: r.naviera_id,
    tipo_contenedor_id: r.tipo_contenedor_id,
    moneda: r.moneda,
    flete_base: Number(r.flete_base) || 0,
    vigente_desde: r.vigente_desde,
    vigente_hasta: r.vigente_hasta,
    estado: r.estado,
    estado_aprobacion: r.estado_aprobacion,
    motivo_rechazo: r.motivo_rechazo,
    aprobada_en: r.aprobada_en,
    transit_time_dias: r.transit_time_dias ?? null,
    dias_libres_demoras: Number(r.dias_libres_demoras) || 0,
    notas: r.notas ?? null,
    ...nombresRelacionesTarifa(r),
  }));
}
