/**
 * Comparación del tipo de cambio guardado en un embarque contra el DOF.
 *
 * El T/C del embarque es una foto congelada al momento de la captura: el P&L
 * y todas las conversiones a MXN lo usan tal cual. Este servicio permite
 * detectar cuándo ese valor se apartó del DOF de su fecha y, si el embarque
 * sigue abierto, alinearlo con la RPC `actualizar_tc_embarque_dof`.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import { fetchTcDofPorFecha, type TcDofVigente } from "@/features/catalogos/services/tipoCambioDof";
import { hoyMx } from "@/lib/date/mx";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Desviación máxima tolerada (en %) antes de considerar el T/C "fuera del DOF". */
export const TC_DESVIACION_UMBRAL_PCT = 0.5;

export interface EmbarqueTcContexto {
  embarqueId: string;
  expediente: string | null;
  estado: string | null;
  /** Fecha (ISO `YYYY-MM-DD`) usada para buscar el DOF: la de creación. */
  fechaReferencia: string;
  tcUsd: number;
  tcEur: number;
  dof: TcDofVigente | null;
  /** Diferencia porcentual del T/C USD guardado respecto al DOF. */
  desviacionPct: number | null;
  /** `true` cuando la desviación supera el umbral tolerado. */
  fueraDeDof: boolean;
  /** `false` si el embarque está Cerrado o Cancelado. */
  editable: boolean;
}

interface FilaEmbarqueTc {
  expediente: string | null;
  estado: string | null;
  created_at: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
}

const ESTADOS_BLOQUEADOS = ["Cerrado", "Cancelado"];

/** Fecha (día CDMX) a partir de un timestamp ISO. */
function diaMx(iso: string | null): string {
  return iso ? hoyMx(new Date(iso)) : hoyMx();
}

export async function fetchEmbarqueTcContexto(embarqueId: string): Promise<EmbarqueTcContexto | null> {
  const query = supabase
    .from("embarques")
    .select("expediente, estado, created_at, tipo_cambio_usd, tipo_cambio_eur")
    .eq("id", embarqueId)
    .limit(1);
  const rows = await unwrapOr(query, []);
  const fila = (rows ?? [])[0] as FilaEmbarqueTc | undefined;
  if (!fila) return null;

  const fechaReferencia = diaMx(fila.created_at);
  const dof = await fetchTcDofPorFecha(fechaReferencia);
  const tcUsd = Number(fila.tipo_cambio_usd ?? 0) || 0;
  const desviacionPct =
    dof && dof.usdMxn > 0 && tcUsd > 0 ? ((tcUsd - dof.usdMxn) / dof.usdMxn) * 100 : null;

  return {
    embarqueId,
    expediente: fila.expediente,
    estado: fila.estado,
    fechaReferencia,
    tcUsd,
    tcEur: Number(fila.tipo_cambio_eur ?? 0) || 0,
    dof,
    desviacionPct,
    fueraDeDof: desviacionPct != null && Math.abs(desviacionPct) > TC_DESVIACION_UMBRAL_PCT,
    editable: !ESTADOS_BLOQUEADOS.includes(fila.estado ?? ""),
  };
}

export interface ActualizarTcDofResultado {
  fecha_dof: string;
  usd_anterior: number | null;
  usd_nuevo: number;
  eur_anterior: number | null;
  eur_nuevo: number | null;
}

/** Alinea el T/C del embarque al DOF de `fecha` y lo deja en bitácora. */
export async function actualizarTcEmbarqueDof(
  embarqueId: string,
  fecha: string,
): Promise<ActualizarTcDofResultado> {
  const data = await run(
    supabase.rpc("actualizar_tc_embarque_dof", { _embarque_id: embarqueId, _fecha: fecha }),
  );
  // SAFE-CAST: la RPC devuelve el shape ActualizarTcDofResultado (ver migración).
  const res = (data ?? {}) as ActualizarTcDofResultado;
  await registrarActividad({
    modulo: "embarques",
    accion: "Alineó el tipo de cambio al DOF",
    entidadId: embarqueId,
    detalles: {
      fechaDof: res.fecha_dof,
      usdAnterior: res.usd_anterior,
      usdNuevo: res.usd_nuevo,
      eurAnterior: res.eur_anterior,
      eurNuevo: res.eur_nuevo,
    },
  });
  return res;
}
