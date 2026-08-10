/**
 * Capa de datos para el dashboard del rol Operador.
 * Aísla las queries a Supabase para que el hook `useDashboardOperador`
 * no importe directamente `@/integrations/supabase/client` (regla de capas).
 *
 * Reglas de negocio (v13.214.4):
 * - Filtrar embarques por `operador = email del usuario`.
 * - "Sin tracking reciente": SOLO embarques `En Tránsito` (una vez que arriban
 *   ya no requiere actualizar ETA, así que se excluyen `Arribo` y `En Aduana`).
 *     · más de 7 días sin un evento manual nuevo, o
 *     · faltan ≤ 2 días para la ETA y el último evento es anterior a (ETA − 2 días).
 *
 * Fuente del "último evento": `eventos_embarque` (eventos manuales),
 * no `tracking_externo` (legacy reservada para integraciones automáticas).
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { ESTADOS_ACTIVOS } from "@/features/embarques/constants/embarqueConstants";

export interface OperadorEmbarqueLite {
  id: string;
  expediente: string | null;
  cliente_nombre: string;
  estado: string;
  eta: string | null;
}

export interface DocsFaltantesItem extends OperadorEmbarqueLite {
  pendientes: number;
}

export interface SinTrackingItem extends OperadorEmbarqueLite {
  diasSinUpdate: number | null;
  /** True si está dentro de los 2 días previos a la ETA (alerta de "pre-arribo"). */
  proximoArribo: boolean;
}

const DIAS_TRACKING_ESTANCADO = 7;
const DIAS_PRE_ARRIBO = 2;
const DAY_MS = 86_400_000;

export async function fetchDocsFaltantesOperador(email: string): Promise<DocsFaltantesItem[]> {
  const { data: embarques, error } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, estado, eta")
    .eq("operador", email)
    .in("estado", [...ESTADOS_ACTIVOS])
    // Ola 4 · N26: excluir soft-deleted.
    .is("deleted_at", null)
    .limit(200);
  if (error) throw error;
  assertNotTruncated(embarques, 200, "operador.embarquesActivos");
  if (!embarques || embarques.length === 0) return [];
  const ids = embarques.map((e) => e.id);
  const { data: docs, error: docsErr } = await supabase
    .from("documentos_embarque")
    .select("embarque_id, estado")
    .in("embarque_id", ids)
    .is("deleted_at", null)
    .eq("estado", "Pendiente");
  if (docsErr) throw docsErr;
  const conteo = new Map<string, number>();
  for (const d of docs ?? []) {
    conteo.set(d.embarque_id, (conteo.get(d.embarque_id) ?? 0) + 1);
  }
  return embarques
    .filter((e) => (conteo.get(e.id) ?? 0) > 0)
    .map((e) => ({
      id: e.id,
      expediente: e.expediente,
      cliente_nombre: e.cliente_nombre ?? "",
      estado: e.estado,
      eta: e.eta,
      pendientes: conteo.get(e.id) ?? 0,
    }))
    .sort((a, b) => b.pendientes - a.pendientes);
}

export async function fetchSinTrackingOperador(email: string): Promise<SinTrackingItem[]> {
  const { data: embarques, error } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, estado, eta")
    .eq("operador", email)
    .in("estado", ["En Tránsito"])
    // Ola 4 · N26: excluir soft-deleted.
    .is("deleted_at", null)
    .limit(200);
  if (error) throw error;
  assertNotTruncated(embarques, 200, "operador.sinTracking");
  if (!embarques || embarques.length === 0) return [];
  const ids = embarques.map((e) => e.id);
  const { data: eventos, error: eErr } = await supabase
    .from("eventos_embarque")
    .select("embarque_id, fecha")
    .in("embarque_id", ids)
    .order("fecha", { ascending: false });
  if (eErr) throw eErr;
  const ultimo = new Map<string, string>();
  for (const ev of eventos ?? []) {
    if (!ultimo.has(ev.embarque_id)) ultimo.set(ev.embarque_id, ev.fecha);
  }
  const ahora = Date.now();
  return embarques
    .map((e): SinTrackingItem => {
      const last = ultimo.get(e.id) ?? null;
      const dias = last ? Math.floor((ahora - new Date(last).getTime()) / DAY_MS) : null;
      const diasHastaEta = e.eta
        ? Math.ceil((new Date(e.eta).getTime() - ahora) / DAY_MS)
        : null;
      const lastBeforePreArrival = last && e.eta
        ? new Date(last).getTime() < new Date(e.eta).getTime() - DIAS_PRE_ARRIBO * DAY_MS
        : true;
      const proximoArribo =
        diasHastaEta !== null && diasHastaEta <= DIAS_PRE_ARRIBO && diasHastaEta >= 0 && lastBeforePreArrival;
      return {
        id: e.id,
        expediente: e.expediente,
        cliente_nombre: e.cliente_nombre ?? "",
        estado: e.estado,
        eta: e.eta,
        diasSinUpdate: dias,
        proximoArribo,
      };
    })
    .filter((e) => e.diasSinUpdate === null || e.diasSinUpdate >= DIAS_TRACKING_ESTANCADO || e.proximoArribo)
    .sort((a, b) => {
      if (a.proximoArribo !== b.proximoArribo) return a.proximoArribo ? -1 : 1;
      return (b.diasSinUpdate ?? 999) - (a.diasSinUpdate ?? 999);
    });
}
