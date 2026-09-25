/**
 * Consultas de tarifas marítimas: listado completo + resumen ligero por IDs.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoTarifa, CosteoTarifaRecargo, CosteoTarifaRow } from "@/features/costeo/types";
import { CAP_LISTA } from "@/constants/queryCaps";
import { todayLocalISO } from "@/lib/date/today";

// O8 (auditoría 2026-07-29): `*` → columnas explícitas. La lista cubre el
// listado agrupado/tabla, KPIs, filtros y `buildInitialFromTarifa`
// (editar/duplicar). Columnas de la tabla no incluidas por no usarse en el
// listado: aprobada_en, aprobada_por, creado_por, dias_libres_almacenaje_lcl,
// frecuencia_override, reemplazada_por, updated_at.
const SELECT = `
  id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
  flete_base, moneda, dias_libres_demoras, transit_time_dias, notas,
  vigente_desde, vigente_hasta, estado, estado_aprobacion, motivo_rechazo,
  created_at,
  costeo_agentes:agente_id(nombre),
  navieras:naviera_id(name),
  tipos_contenedor:tipo_contenedor_id(name),
  costeo_rutas:ruta_id(
    puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name, code, country),
    puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name, code, country)
  ),
  recargos:costeo_tarifa_recargos(id, tarifa_id, concepto, lado, monto, moneda, incluido_en_total)
`;

/** Puerto con identidad completa (Etapa 2): nombre + UN/LOCODE + país. */
interface RawPuerto {
  name: string;
  code: string | null;
  country: string | null;
}

interface RawRow extends CosteoTarifa {
  costeo_agentes?: { nombre: string } | null;
  navieras?: { name: string } | null;
  tipos_contenedor?: { name: string } | null;
  costeo_rutas?: {
    puerto_origen?: RawPuerto | null;
    puerto_destino?: RawPuerto | null;
  } | null;
  recargos?: CosteoTarifaRecargo[];
}

/**
 * Identidad de puertos (Etapa 2) normalizada en un solo lugar: mantiene
 * `mapRow`/`fetchTarifasResumen` por debajo del límite de complejidad.
 */
function idPuerto(p?: RawPuerto | null) {
  return {
    nombre: p?.name ?? "—",
    code: p?.code ?? null,
    country: p?.country ?? null,
  };
}

function identidadPuertos(ruta?: {
  puerto_origen?: RawPuerto | null;
  puerto_destino?: RawPuerto | null;
} | null) {
  const o = idPuerto(ruta?.puerto_origen);
  const d = idPuerto(ruta?.puerto_destino);
  return {
    puerto_origen_nombre: o.nombre,
    puerto_origen_code: o.code,
    puerto_origen_country: o.country,
    puerto_destino_nombre: d.nombre,
    puerto_destino_code: d.code,
    puerto_destino_country: d.country,
  };
}

function mapRow(r: RawRow): CosteoTarifaRow {
  const recargos = r.recargos ?? [];
  const recargos_total = recargos
    .filter((x) => x.incluido_en_total)
    .reduce((acc, x) => acc + Number(x.monto || 0), 0);
  return {
    ...r,
    agente_nombre: r.costeo_agentes?.nombre ?? "—",
    naviera_nombre: r.navieras?.name ?? "—",
    tipo_contenedor_nombre: r.tipos_contenedor?.name ?? "—",
    ...identidadPuertos(r.costeo_rutas),
    recargos,
    recargos_total,
    total_comparable: Number(r.flete_base || 0) + recargos_total,
  };
}

export interface FetchTarifasFilters {
  estado?: "vigente" | "vencida" | "reemplazada" | "todas";
  agenteId?: string;
  tipoContenedorId?: string;
  rutaId?: string;
}

export async function fetchCosteoTarifas(
  organizationId: string,
  filters: FetchTarifasFilters = {},
): Promise<CosteoTarifaRow[]> {
  let q = supabase
    .from("costeo_tarifas")
    .select(SELECT)
    .eq("organization_id", organizationId)
    .order("vigente_desde", { ascending: false })
    .limit(CAP_LISTA);
  if (filters.estado === "vigente") {
    // P2-A1: "Vigentes hoy" = mismo predicado que `esTarifaUsableEn` (aprobada,
    // no reemplazada, desde <= hoy <= hasta). Se filtra en servidor para que
    // el cap de la lista no trunque resultados. Programadas y pendientes
    // siguen visibles en "Todas".
    const hoy = todayLocalISO();
    q = q.eq("estado", "vigente").eq("estado_aprobacion", "vigente")
      .lte("vigente_desde", hoy).gte("vigente_hasta", hoy);
  } else if (filters.estado && filters.estado !== "todas") {
    q = q.eq("estado", filters.estado);
  }
  if (filters.agenteId) q = q.eq("agente_id", filters.agenteId);
  if (filters.tipoContenedorId) q = q.eq("tipo_contenedor_id", filters.tipoContenedorId);
  if (filters.rutaId) q = q.eq("ruta_id", filters.rutaId);
  const { data, error } = await q;
  if (error) throw error;
  // SAFE-CAST: la query usa select() con join anidado; el cliente generado infiere `never` por el alias de relación.
  return ((data ?? []) as unknown as RawRow[]).map(mapRow);
}

export interface TarifaResumen {
  id: string;
  naviera_nombre: string;
  puerto_origen_nombre: string;
  puerto_origen_code: string | null;
  puerto_origen_country: string | null;
  puerto_destino_nombre: string;
  puerto_destino_code: string | null;
  puerto_destino_country: string | null;
  tipo_contenedor_nombre: string;
  vigente_desde: string | null;
  vigente_hasta: string | null;
}

interface RawResumenRow {
  id: string;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  navieras?: { name: string } | null;
  tipos_contenedor?: { name: string } | null;
  costeo_rutas?: {
    puerto_origen?: RawPuerto | null;
    puerto_destino?: RawPuerto | null;
  } | null;
}

export async function fetchTarifasResumen(
  ids: string[],
): Promise<Record<string, TarifaResumen>> {
  const unicos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unicos.length === 0) return {};
  const { data, error } = await supabase
    .from("costeo_tarifas")
    .select(`
      id, vigente_desde, vigente_hasta,
      navieras:naviera_id(name),
      tipos_contenedor:tipo_contenedor_id(name),
      costeo_rutas:ruta_id(
        puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name, code, country),
        puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name, code, country)
      )
    `)
    .in("id", unicos);
  if (error) throw error;
  // SAFE-CAST: joins anidados fuerzan `never` en el cliente generado.
  const rows = (data ?? []) as unknown as RawResumenRow[];
  const map: Record<string, TarifaResumen> = {};
  for (const r of rows) {
    map[r.id] = {
      id: r.id,
      naviera_nombre: r.navieras?.name ?? "—",
      tipo_contenedor_nombre: r.tipos_contenedor?.name ?? "—",
      ...identidadPuertos(r.costeo_rutas),
      vigente_desde: r.vigente_desde,
      vigente_hasta: r.vigente_hasta,
    };
  }
  return map;
}
