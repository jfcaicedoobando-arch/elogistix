/**
 * Servicio: consulta Top 3 de tarifas vigentes vía RPC `get_top_tarifas`.
 *
 * P1 (2026-09-02): el catálogo de tipos de contenedor puede tener registros
 * legacy equivalentes (mismo tipo, IDs distintos). La búsqueda consulta el
 * conjunto de IDs equivalentes y fusiona resultados de forma determinista, así
 * el ID elegido en el selector nunca cambia el resultado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow, CosteoTarifaRecargo } from "@/features/costeo/types";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import { todayLocalISO } from "@/lib/date/today";

export interface TopTarifasParams {
  puertoOrigenId: string;
  puertoDestinoId: string;
  /** ID del tipo de contenedor (o cualquiera de sus IDs equivalentes). */
  tipoContenedorId: string;
  /** IDs equivalentes a consultar; si no viene, se usa `tipoContenedorId`. */
  tipoContenedorIds?: string[];
  fecha?: string; // YYYY-MM-DD
  organizationId?: string;
}

const LIMITE_TOP = 3;

function num(v: unknown): number {
  return Number(v || 0);
}

/** Orden canónico: precio total, luego crédito, días libres y por último el ID. */
function compararTarifas(a: TopTarifaRow, b: TopTarifaRow): number {
  return (
    num(a.total_comparable) - num(b.total_comparable) ||
    num(b.dias_credito) - num(a.dias_credito) ||
    num(b.dias_libres_demoras) - num(a.dias_libres_demoras) ||
    String(a.id).localeCompare(String(b.id))
  );
}

async function rpcTopTarifas(
  tipoContenedorId: string,
  p: TopTarifasParams,
  fecha: string,
): Promise<TopTarifaRow[]> {
  const { data, error } = await supabase.rpc("get_top_tarifas", {
    p_puerto_origen_id: p.puertoOrigenId,
    p_puerto_destino_id: p.puertoDestinoId,
    p_tipo_contenedor_id: tipoContenedorId,
    p_fecha: fecha,
    p_organization_id: p.organizationId ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as TopTarifaRow[];
}

export async function fetchTopTarifas(p: TopTarifasParams): Promise<TopTarifaRow[]> {
  // Cinturón + tirantes: si llega "" desde arriba, tratarlo como no proveída
  // para no mandar un date inválido al RPC (Postgres 22007).
  const fecha = p.fecha && p.fecha.length > 0 ? p.fecha : todayLocalISO();
  const ids = (p.tipoContenedorIds?.length ? p.tipoContenedorIds : [p.tipoContenedorId]).filter(
    Boolean,
  );
  const idsUnicos = [...new Set(ids)].sort();

  const lotes = await Promise.all(idsUnicos.map((id) => rpcTopTarifas(id, p, fecha)));

  const porId = new Map<string, TopTarifaRow>();
  for (const lote of lotes) for (const row of lote) porId.set(String(row.id), row);
  return [...porId.values()].sort(compararTarifas).slice(0, LIMITE_TOP);
}

/** Recargos detallados de una tarifa específica (para mostrar desglose en el card). */
export async function fetchRecargosDeTarifa(tarifaId: string): Promise<CosteoTarifaRecargo[]> {
  const { data, error } = await supabase
    .from("costeo_tarifa_recargos")
    .select("*")
    .eq("tarifa_id", tarifaId)
    .order("concepto");
  if (error) throw error;
  return (data ?? []) as CosteoTarifaRecargo[];
}

/** Una tarifa vigente por id (para precargar la cotización desde Pricing). */
export async function fetchTarifaVigentePorId(id: string): Promise<TopTarifaRow | null> {
  const { data, error } = await supabase.from("costeo_tarifas_vigentes_v").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as TopTarifaRow | null) ?? null;
}

/** Varias tarifas vigentes, sin duplicados y en el orden de los IDs pedidos. */
export async function fetchTarifasVigentesPorIds(ids: readonly string[]): Promise<TopTarifaRow[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  if (unicos.length >= CAP_LOTES_DURO) {
    throw new ResultadoTruncadoError("costeo.tarifasVigentesPorIds", CAP_LOTES_DURO);
  }
  // Acota el tamaño de la URL del filtro IN, no el número total de resultados.
  const loteIds = 200;
  const porId = new Map<string, TopTarifaRow>();
  for (let inicio = 0; inicio < unicos.length; inicio += loteIds) {
    const lote = unicos.slice(inicio, inicio + loteIds);
    const filas = await leerTodasLasPaginas("costeo.tarifasVigentesPorIds", (desde, hasta) =>
      supabase.from("costeo_tarifas_vigentes_v").select("*").in("id", lote)
        .order("id").range(desde, hasta),
    );
    for (const fila of filas as TopTarifaRow[]) porId.set(fila.id, fila);
  }
  return unicos.flatMap((id) => {
    const fila = porId.get(id);
    return fila ? [fila] : [];
  });
}
