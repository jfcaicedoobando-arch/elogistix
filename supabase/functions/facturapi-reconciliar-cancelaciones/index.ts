/**
 * facturapi-reconciliar-cancelaciones — cron que consulta a FacturApi el
 * `cancellation_status` de cada factura marcada como `pending`/`verifying`
 * y sincroniza la BD. Se dispara cada 30 min via pg_cron/pg_net.
 * Idempotente y seguro de reintentar.
 *
 * P1-3b: la corrida tiene presupuesto de wall-time (`presupuesto.ts`) y recorre
 * un plan intercalado por organización y familia (`plan.ts`), ejecutado por
 * `ejecutar.ts`. Los documentos que no alcanzan a iniciarse quedan intactos
 * (`resumen.diferidos`) y son los primeros de la corrida siguiente.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { getFacturapiClient, withFacturapiTimeout } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { tomarCronLock, soltarCronLock } from "../_shared/cronLock.ts";
import { validarRequest, cargarPendientes } from "./entrada.ts";
import { marcarRevisado } from "./cursor.ts";
import { reconcileOneRep } from "./reps.ts";
import { reconcileOneNc } from "./ncs.ts";
import { planificarTareas } from "./plan.ts";
import { crearPresupuesto, CRON_RETRIEVE_TIMEOUT_MS } from "./presupuesto.ts";
import { cerrarFacturaConAcuse } from "./cierreFactura.ts";
import { reprocesarWebhooksPendientes } from "../_shared/facturapi-webhook/reprocesar.ts";
import { ejecutarPlan, type ReconcileCtx, type ClienteResuelto, type RetrieveClient } from "./ejecutar.ts";
import {
  descargarAcuse,
  resolveNextAction,
  acumularOutcome,
  type FacturaPendiente,
  type FapiInvoiceStatus,
} from "./reconcile.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function applyAccepted(
  supabase: SupabaseClient,
  factura: FacturaPendiente,
  apiKey: string,
  orgId: string,
): Promise<void> {
  const acuse = await descargarAcuse(factura.facturapi_id, apiKey);
  const cierre = await cerrarFacturaConAcuse(supabase, factura, acuse, new Date().toISOString());

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: cierre.estado === "Sustituida" ? "facturapi_sustituida_async" : "facturapi_cancelada_async",
    entidadId: factura.id,
    detalles: { via: "cron_reconciliacion", cancellation_status: "accepted" },
  });
}

async function reconcileOne(ctx: ReconcileCtx, factura: FacturaPendiente): Promise<void> {
  ctx.resumen.revisadas++;
  try {
    return await reconcileOneInner(ctx, factura);
  } finally {
    // P1-3: marca el cursor SIEMPRE (accepted/no_change/error) para que el
    // siguiente barrido no vuelva a priorizar este documento sobre el resto.
    // Sólo se llega aquí en documentos realmente INICIADOS: los diferidos por
    // presupuesto no pasan por `reconcileOne` y conservan su cursor.
    await marcarRevisado(ctx.supabase, "facturas", "reconciliacion_checked_at", factura.id, new Date().toISOString());
  }
}

async function reconcileOneInner(ctx: ReconcileCtx, factura: FacturaPendiente): Promise<void> {
  const { supabase, facturapi, apiKey, orgId, resumen } = ctx;
  try {
    const remote = await withFacturapiTimeout(
      "invoices.retrieve",
      facturapi.invoices.retrieve(factura.facturapi_id),
      CRON_RETRIEVE_TIMEOUT_MS,
    ) as FapiInvoiceStatus;
    const decision = resolveNextAction(remote, factura, new Date().toISOString());

    if (decision.outcome === "no_change") {
      resumen.sin_cambio++;
      return;
    }

    if (decision.outcome === "accepted") {
      await applyAccepted(supabase, factura, apiKey, orgId);
      resumen.aceptadas++;
      return;
    }

    // rejected / expired / transition
    const { data, error } = await supabase.from("facturas").update(decision.patch)
      .eq("id", factura.id).eq("organization_id", orgId).is("deleted_at", null)
      .eq("cancellation_status", factura.cancellation_status).select("id").maybeSingle();
    if (error) throw error;
    if (!data) { resumen.sin_cambio++; return; }
    if (decision.outcome === "rejected" || decision.outcome === "expired") {
      await registrarBitacoraEdge(supabase, {
        organizationId: orgId,
        usuarioId: null,
        modulo: "facturacion",
        accion: "facturapi_cancelacion_no_aceptada",
        entidadId: factura.id,
        detalles: { via: "cron_reconciliacion", cancellation_status: decision.outcome },
      });
    }
    acumularOutcome(resumen, decision.outcome);
  } catch (_err) {
    resumen.errores++;
    // EF-12: no tragar el error — sin id un fallo sistemático (API key rotada,
    // red) sólo movía un contador invisible.
    console.error("[reconciliar-cancelaciones] error", {
      entidad: "factura",
      id: factura.id,
      error: _err instanceof Error ? _err.message : String(_err),
    });
    await captureEdgeException(_err, {
      fn: "facturapi-reconciliar-cancelaciones",
      organization_id: orgId,
      extra: { factura_id: factura.id, facturapi_id: factura.facturapi_id },
    });
  }
}

async function resolverCliente(supabase: SupabaseClient, orgId: string): Promise<ClienteResuelto> {
  const resolved = await getFacturapiClient(supabase, orgId);
  if (!resolved.ok) return { ok: false };
  return {
    ok: true,
    // SAFE-CAST: el SDK `facturapi` no expone typings; sólo se usa invoices.retrieve.
    client: resolved.data.client as unknown as RetrieveClient,
    apiKey: resolved.data.apiKey,
  };
}

Deno.serve(wrapEdgeHandler("facturapi-reconciliar-cancelaciones", async (req) => {
  const corte = validarRequest(req, CRON_SECRET);
  if (corte) return corte;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // R3 · P3: mutex anti-traslape — corre cada 30 min; dos corridas
  // concurrentes duplican retrieves a Facturapi y parches de BD. "error" =
  // RPC no disponible → fail-open capturado en Sentry.
  const lock = await tomarCronLock(supabase, "facturapi-reconciliar-cancelaciones", 1800);
  if (lock === "ocupado") return jsonResponse({ ok: true, skipped: "locked" });

  try {
    try {
      await reprocesarWebhooksPendientes(supabase);
    } catch (error) {
      await captureEdgeException(error, { fn: "facturapi-reconciliar-cancelaciones", extra: { tarea: "webhooks" } });
    }
    const pendientes = await cargarPendientes(supabase);
    if (!pendientes.ok) return pendientes.res;

    const resumen = await ejecutarPlan(planificarTareas(pendientes.data), {
      supabase,
      presupuesto: crearPresupuesto(),
      resolverCliente: (orgId) => resolverCliente(supabase, orgId),
      procesar: { factura: reconcileOne, nc: reconcileOneNc, rep: reconcileOneRep },
    });
    return jsonResponse({ ok: true, resumen });
  } finally {
    if (lock === "tomado") await soltarCronLock(supabase, "facturapi-reconciliar-cancelaciones");
  }
}));
