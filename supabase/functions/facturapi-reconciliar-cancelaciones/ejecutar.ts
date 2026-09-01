/**
 * P1-3b: ejecutor del plan de reconciliación con presupuesto de wall-time.
 *
 * Recorre el plan intercalado (`planificarTareas`) y, ANTES de iniciar cada
 * documento, comprueba el presupuesto. Si ya se agotó, deja los documentos no
 * iniciados intactos (cursor sin tocar) y los cuenta como `diferidos` — no como
 * errores. La corrida termina limpia, responde y suelta el lock de cron.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { FacturaPendiente, NotaCreditoPendiente, RepPendiente, Resumen } from "./reconcile.ts";
import { nuevoResumen } from "./reconcile.ts";
import type { Tarea } from "./plan.ts";
import type { Presupuesto } from "./presupuesto.ts";

export interface RetrieveClient {
  invoices: { retrieve: (id: string) => Promise<unknown> };
}

export interface ReconcileCtx {
  supabase: SupabaseClient;
  facturapi: RetrieveClient;
  apiKey: string;
  orgId: string;
  resumen: Resumen;
}

export type ClienteResuelto =
  | { ok: true; client: RetrieveClient; apiKey: string }
  | { ok: false };

export interface EjecutarDeps {
  supabase: SupabaseClient;
  presupuesto: Presupuesto;
  resolverCliente: (orgId: string) => Promise<ClienteResuelto>;
  procesar: {
    factura: (ctx: ReconcileCtx, doc: FacturaPendiente) => Promise<void>;
    nc: (ctx: ReconcileCtx, doc: NotaCreditoPendiente) => Promise<void>;
    rep: (ctx: ReconcileCtx, doc: RepPendiente) => Promise<void>;
  };
}

async function despachar(ctx: ReconcileCtx, tarea: Tarea, deps: EjecutarDeps): Promise<void> {
  if (tarea.familia === "factura") return await deps.procesar.factura(ctx, tarea.doc);
  if (tarea.familia === "nc") return await deps.procesar.nc(ctx, tarea.doc);
  return await deps.procesar.rep(ctx, tarea.doc);
}

/** Cachea la resolución de cliente por organización durante la corrida. */
function memoResolver(deps: EjecutarDeps): (orgId: string) => Promise<ClienteResuelto> {
  const cache = new Map<string, ClienteResuelto>();
  return async (orgId: string) => {
    const hit = cache.get(orgId);
    if (hit) return hit;
    const resuelto = await deps.resolverCliente(orgId);
    cache.set(orgId, resuelto);
    return resuelto;
  };
}

export async function ejecutarPlan(tareas: Tarea[], deps: EjecutarDeps): Promise<Resumen> {
  const resumen = nuevoResumen();
  const resolver = memoResolver(deps);

  for (let i = 0; i < tareas.length; i++) {
    // Corte por presupuesto: los pendientes de este punto en adelante quedan
    // intactos para la próxima corrida (mismo orden justo).
    if (deps.presupuesto.agotado()) {
      resumen.diferidos = tareas.length - i;
      break;
    }
    const tarea = tareas[i];
    const cliente = await resolver(tarea.orgId);
    if (!cliente.ok) {
      resumen.errores++;
      continue;
    }
    const ctx: ReconcileCtx = {
      supabase: deps.supabase,
      facturapi: cliente.client,
      apiKey: cliente.apiKey,
      orgId: tarea.orgId,
      resumen,
    };
    try {
      await despachar(ctx, tarea, deps);
    } catch (err) {
      // Blindaje: un fallo inesperado de un documento no debe abortar la
      // corrida (el lock se libera en el `finally` del handler).
      resumen.errores++;
      console.error("[reconciliar-cancelaciones] tarea fallida", {
        familia: tarea.familia,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return resumen;
}
