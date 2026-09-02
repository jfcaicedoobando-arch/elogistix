/**
 * Servicio de comisiones devengadas: lectura + KPIs por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ymMx } from "@/lib/date/mx";
import { fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";
import { CAP_LISTA } from "@/constants/queryCaps";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

export type ComisionDevengadaRow = Tables<"comisiones_devengadas">;
export type EstadoComision = ComisionDevengadaRow["estado"];

export interface ComisionDevengada {
  id: string;
  organization_id: string;
  pago_factura_id: string;
  embarque_id: string | null;
  factura_id: string;
  vendedora_id: string | null;
  vendedora_nombre: string | null;
  factura_numero: string | null;
  cliente_nombre: string | null;
  expediente: string | null;
  monto_cobrado_mxn: number;
  utilidad_prorrateada_mxn: number;
  porcentaje_aplicado: number;
  comision_mxn: number;
  estado: EstadoComision;
  liquidacion_id: string | null;
  nota: string | null;
  created_at: string;
}

export interface FetchComisionesFiltros {
  vendedora_id?: string | "todas";
  periodo?: string;
  estado?: EstadoComision | "todos";
}

type Joined = ComisionDevengadaRow & {
  facturas: { numero: string; cliente_nombre: string; expediente: string | null } | null;
};

/**
 * B4 (Ola 7): los nombres de las vendedoras no viven en una tabla (se
 * resuelven vía edge function `user-management`, acción `list-nombres` —
 * defecto 10: sin email ni señales de sesión). Se resuelven en un solo viaje
 * y de forma best-effort: si falla, la columna muestra "—".
 */
async function buildNombreVendedoraMap(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};
  try {
    const users = await fetchNombresUsuarios();
    const map: Record<string, string> = {};
    for (const u of users) {
      if (unicos.includes(u.id) && u.full_name) map[u.id] = u.full_name;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Convierte un periodo "YYYY-MM" al rango de instantes UTC que cubre ese mes en
 * zona CDMX (UTC-06:00 fijo, México ya no aplica horario de verano).
 */
function rangoMesMx(periodo?: string): { desde: string; hasta: string } | null {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [anio, mes] = periodo.split("-").map(Number);
  const desde = new Date(Date.UTC(anio, mes - 1, 1, 6, 0, 0));
  const hasta = new Date(Date.UTC(anio, mes, 1, 6, 0, 0));
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/** Filtros compartidos entre el listado (con cap) y la lectura de KPIs (completa). */
interface FiltrableQuery<Q> {
  eq(col: string, val: string): Q;
  gte(col: string, val: string): Q;
  lt(col: string, val: string): Q;
}

function aplicarFiltros<Q extends FiltrableQuery<Q>>(q: Q, filtros: FetchComisionesFiltros): Q {
  let out = q;
  if (filtros.vendedora_id && filtros.vendedora_id !== "todas") {
    out = out.eq("vendedora_id", filtros.vendedora_id);
  }
  if (filtros.estado && filtros.estado !== "todos") {
    out = out.eq("estado", filtros.estado);
  }
  const rango = rangoMesMx(filtros.periodo);
  if (rango) out = out.gte("created_at", rango.desde).lt("created_at", rango.hasta);
  return out;
}

/** Fila mínima para KPIs: sólo lo que `calcularKPIsComisiones` necesita. */
export type ComisionKpiRow = Pick<ComisionDevengada, "created_at" | "estado" | "comision_mxn">;

/**
 * Ronda YAGNI · defecto 3: los KPIs de comisiones se calculaban sobre la lista
 * visible (tope de 500 filas), así que "devengado del mes", "pendiente por
 * liquidar" y "por recuperar" se quedaban cortos sin avisar. Esta lectura es
 * ligera (3 columnas) y COMPLETA por páginas, con los mismos filtros.
 */
export async function fetchComisionesKpiRows(
  filtros: FetchComisionesFiltros = {},
): Promise<ComisionKpiRow[]> {
  const filas = await leerTodasLasPaginas<{
    created_at: string; estado: EstadoComision; comision_mxn: number | string;
  }>("comisiones.kpis", (desde, hasta) =>
    aplicarFiltros(
      supabase
        .from("comisiones_devengadas")
        .select("created_at, estado, comision_mxn")
        .is("deleted_at", null),
      filtros,
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, hasta),
  );
  return filas.map((r) => ({
    created_at: r.created_at,
    estado: r.estado,
    comision_mxn: Number(r.comision_mxn),
  }));
}

export async function fetchComisionesDevengadas(
  filtros: FetchComisionesFiltros = {},
): Promise<ComisionDevengada[]> {
  let q = supabase
    .from("comisiones_devengadas")
    .select(`
      id, organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, liquidacion_id, nota, created_at,
      facturas:factura_id ( numero, cliente_nombre, expediente )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(CAP_LISTA);

  if (filtros.vendedora_id && filtros.vendedora_id !== "todas") {
    q = q.eq("vendedora_id", filtros.vendedora_id);
  }
  if (filtros.estado && filtros.estado !== "todos") {
    q = q.eq("estado", filtros.estado);
  }
  // EC-01 (auditoría 2026-08-18): el periodo se filtra en la base ANTES del
  // límite de 500 filas; antes se recortaba en memoria y meses viejos salían
  // vacíos porque el tope ya se había consumido con comisiones recientes.
  const rango = rangoMesMx(filtros.periodo);
  if (rango) {
    q = q.gte("created_at", rango.desde).lt("created_at", rango.hasta);
  }

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: `Joined` modela el shape del embed; Supabase devuelve unknown.
  const crudas = (data as unknown as Joined[] | null) ?? [];
  const nombres = await buildNombreVendedoraMap(
    crudas.map((r) => r.vendedora_id).filter((id): id is string => !!id),
  );

  const rows = crudas.map((r): ComisionDevengada => ({
    id: r.id,
    organization_id: r.organization_id,
    pago_factura_id: r.pago_factura_id,
    embarque_id: r.embarque_id,
    factura_id: r.factura_id,
    vendedora_id: r.vendedora_id,
    vendedora_nombre: r.vendedora_id ? (nombres[r.vendedora_id] ?? null) : null,
    factura_numero: r.facturas?.numero ?? null,
    cliente_nombre: r.facturas?.cliente_nombre ?? null,
    expediente: r.facturas?.expediente ?? null,
    monto_cobrado_mxn: Number(r.monto_cobrado_mxn),
    utilidad_prorrateada_mxn: Number(r.utilidad_prorrateada_mxn),
    porcentaje_aplicado: Number(r.porcentaje_aplicado),
    comision_mxn: Number(r.comision_mxn),
    estado: r.estado,
    liquidacion_id: r.liquidacion_id,
    nota: r.nota,
    created_at: r.created_at,
  }));

  if (filtros.periodo) {
    // A11: el periodo se compara en zona CDMX; `.slice(0,7)` usaba el mes UTC
    // y entre 18:00–23:59 CDMX clasificaba la comisión en el mes equivocado.
    return rows.filter((r) => ymMx(new Date(r.created_at)) === filtros.periodo);
  }
  return rows;
}

export interface KPIsComisiones {
  devengado_mes_mxn: number;
  pendiente_liquidar_mxn: number;
  liquidado_mes_mxn: number;
  /** Comisiones ya pagadas cuyo respaldo se canceló/acreditó: deuda a recuperar. */
  por_recuperar_mxn: number;
}

/**
 * Auditoría 2026-08-28:
 * - Hallazgo 6: el "devengado del mes" debe medirse contra el periodo que el
 *   usuario está consultando, no contra el mes de hoy (al ver un mes pasado el
 *   KPI daba 0).
 * - Hallazgo 1: se expone `por_recuperar_mxn` para que la deuda por comisiones
 *   pagadas de más deje de ser invisible.
 */
export function calcularKPIsComisiones(
  items: ComisionKpiRow[],
  periodo?: string,
): KPIsComisiones {
  const mesRef = periodo || ymMx();
  let dev = 0, pend = 0, liq = 0, porRecuperar = 0;
  for (const it of items) {
    const mes = ymMx(new Date(it.created_at));
    if (mes === mesRef && it.estado !== "Cancelada") dev += it.comision_mxn;
    if (it.estado === "Devengada") pend += it.comision_mxn;
    if (it.estado === "Liquidada" && mes === mesRef) liq += it.comision_mxn;
    if (it.estado === "Por recuperar") porRecuperar += it.comision_mxn;
  }
  return {
    devengado_mes_mxn: dev,
    pendiente_liquidar_mxn: pend,
    liquidado_mes_mxn: liq,
    por_recuperar_mxn: porRecuperar,
  };
}
