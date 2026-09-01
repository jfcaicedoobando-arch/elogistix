/**
 * Guardas de entrada y carga del lote pendiente del cron
 * `facturapi-reconciliar-cancelaciones`. Separado de `index.ts` para mantener
 * los archivos bajo el límite de líneas (Power of 10).
 *
 * P1-3: antes cada familia (facturas/NC/REP) se traía con `.limit(200)` sin
 * orden ni cursor — con backlog, siempre se procesaban las mismas primeras
 * 200 filas (starvation del resto) y una familia grande podía acaparar todo
 * el tiempo de ejecución del cron (wall-time). Ahora:
 *   - cada familia se ordena por su cursor de revisión (`reconciliacion_checked_at`
 *     / `rep_reconciliacion_checked_at`, NULLS FIRST = nunca revisada primero),
 *     que es el campo canónico agregado para este propósito (no existía uno
 *     previamente; `updated_at` no sirve porque lo pisa cualquier otra
 *     escritura ajena a la reconciliación).
 *   - se aplica un presupuesto GLOBAL pequeño (`PRESUPUESTO_GLOBAL`) repartido
 *     en round-robin entre las 3 familias, así ninguna hambrienta a las otras.
 *   - lo que no entra en el presupuesto de esta corrida queda con su cursor
 *     intacto (más antiguo) y es lo primero que se toma en la siguiente.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { captureEdgeMessage } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import type { FacturaPendiente, NotaCreditoPendiente, RepPendiente } from "./reconcile.ts";

/**
 * Presupuesto global de documentos procesados por corrida (suma de las 3
 * familias). El cron corre cada 30 min; a 200 registros/familia secuenciales
 * con retrieves a Facturapi, un backlog de ~600 podía exceder el wall-time
 * de la edge function. 180 es un tope conservador con margen holgado.
 */
export const PRESUPUESTO_GLOBAL = 180;

/** Tope de candidatos a traer por familia antes de repartir el presupuesto. */
const FETCH_LIMIT = PRESUPUESTO_GLOBAL;

export type Pendientes = {
  facturas: FacturaPendiente[];
  notasCredito: NotaCreditoPendiente[];
  reps: RepPendiente[];
};

/** Guard de método + secreto cron. Devuelve Response para cortar, o null para seguir. */
export function validarRequest(req: Request, cronSecret: string | undefined): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  // M8: endpoint cron-only — mismo patrón que rep-retry-nocturno.
  if (!cronSecret || req.headers.get("X-Cron-Secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  return null;
}

/**
 * Reparte el presupuesto global en round-robin entre 3 colas ya ordenadas
 * por cursor (más antiguo primero). Un turno por cola en cada ronda: así
 * ninguna familia grande acapara el presupuesto a costa de las otras.
 */
function repartirRoundRobin<A, B, C>(
  facturas: A[],
  notasCredito: B[],
  reps: C[],
  presupuesto: number,
): { facturas: A[]; notasCredito: B[]; reps: C[] } {
  const outFacturas: A[] = [];
  const outNc: B[] = [];
  const outReps: C[] = [];
  let tomados = 0;
  let i = 0;
  while (tomados < presupuesto && (i < facturas.length || i < notasCredito.length || i < reps.length)) {
    if (i < facturas.length && tomados < presupuesto) { outFacturas.push(facturas[i]); tomados++; }
    if (i < notasCredito.length && tomados < presupuesto) { outNc.push(notasCredito[i]); tomados++; }
    if (i < reps.length && tomados < presupuesto) { outReps.push(reps[i]); tomados++; }
    i++;
  }
  return { facturas: outFacturas, notasCredito: outNc, reps: outReps };
}

/**
 * Lee facturas y notas de crédito con cancelación `pending`/`verifying`.
 * EF-03: las NC también se reconcilian aquí — el webhook no las resuelve
 * (factura_not_found → ignored) y sin este barrido quedaban 'pending' para
 * siempre tras el silencio positivo de 72 h.
 * REF-02: mismo tratamiento para los REP (pagos_factura.rep_cancellation_status),
 * cuya única vía de cierre era el webhook.
 */
export async function cargarPendientes(
  supabase: SupabaseClient,
): Promise<{ ok: true; data: Pendientes } | { ok: false; res: Response }> {
  const { data: pendientes, error: fetchErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, cancellation_status, sustituida_por, reconciliacion_checked_at")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .order("reconciliacion_checked_at", { ascending: true, nullsFirst: true })
    .limit(FETCH_LIMIT);
  if (fetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500) };
  }

  // EF-12: si el candidato llega al tope probablemente hay backlog que tarda
  // varias corridas en drenar — dejar señal en Sentry para operación.
  if ((pendientes ?? []).length === FETCH_LIMIT) {
    await captureEdgeMessage("facturapi_reconciliar_backlog", "warning", {
      fn: "facturapi-reconciliar-cancelaciones",
      extra: { candidatos_facturas: FETCH_LIMIT },
    });
  }

  const { data: ncPendientes, error: ncFetchErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, cancellation_status, reconciliacion_checked_at")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .order("reconciliacion_checked_at", { ascending: true, nullsFirst: true })
    .limit(FETCH_LIMIT);
  if (ncFetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: ncFetchErr.message }, 500) };
  }

  // REF-02 (espejo EF-03 para REP): se excluyen los claims PENDING:<uuid> de
  // EF-01 (REP aún no timbrado; los resuelve facturapi-recuperar-claim).
  const { data: repPendientes, error: repFetchErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, rep_cancellation_status, rep_reconciliacion_checked_at")
    .in("rep_cancellation_status", ["pending", "verifying"])
    .not("facturapi_rep_id", "is", null)
    .not("facturapi_rep_id", "like", "PENDING:%")
    .order("rep_reconciliacion_checked_at", { ascending: true, nullsFirst: true })
    .limit(FETCH_LIMIT);
  if (repFetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: repFetchErr.message }, 500) };
  }

  const repartido = repartirRoundRobin(
    (pendientes ?? []) as FacturaPendiente[],
    (ncPendientes ?? []) as NotaCreditoPendiente[],
    (repPendientes ?? []) as RepPendiente[],
    PRESUPUESTO_GLOBAL,
  );

  return { ok: true, data: repartido };
}

/** Sólo para tests: expone el reparto round-robin puro. */
export const __testonly = { repartirRoundRobin };
