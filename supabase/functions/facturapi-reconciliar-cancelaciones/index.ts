/**
 * facturapi-reconciliar-cancelaciones — cron que consulta a FacturApi el
 * `cancellation_status` de cada factura marcada como `pending`/`verifying`
 * y sincroniza la BD. Se dispara cada 30 min via pg_cron/pg_net.
 * Idempotente y seguro de reintentar.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException, captureEdgeMessage } from "../_shared/sentry.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  descargarAcuse,
  resolveNextAction,
  resolveNextActionNc,
  agruparPorOrg,
  nuevoResumen,
  acumularOutcome,
  type FacturaPendiente,
  type NotaCreditoPendiente,
  type FapiInvoiceStatus,
  type Resumen,
} from "./reconcile.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");


/**
 * Limpia sólo los punteros `factura_id`/`factura_secundaria_id`.
 * NO toca `estado_proforma` — de eso se encarga la RPC
 * `revertir_proforma_al_cancelar_sustitucion`, que verifica facturas
 * hermanas vivas (por `proforma_id` y `conceptos_factura.proforma_id_origen`).
 * Ver bug histórico PRO-2026-0970 (F971 → F981).
 */
async function limpiarPunterosProformas(supabase: SupabaseClient, facturaId: string): Promise<void> {
  const { data: pfs } = await supabase
    .from("proformas")
    .select("id, factura_id, factura_secundaria_id")
    .or(`factura_id.eq.${facturaId},factura_secundaria_id.eq.${facturaId}`);
  for (const pf of pfs ?? []) {
    const nuevoFacturaId = pf.factura_id === facturaId ? null : pf.factura_id;
    const nuevoFacturaSecId = pf.factura_secundaria_id === facturaId ? null : pf.factura_secundaria_id;
    await supabase
      .from("proformas")
      .update({ factura_id: nuevoFacturaId, factura_secundaria_id: nuevoFacturaSecId })
      .eq("id", pf.id);
  }
}

async function applyAccepted(
  supabase: SupabaseClient,
  factura: FacturaPendiente,
  patchBase: Record<string, unknown>,
  apiKey: string,
  orgId: string,
): Promise<boolean> {
  const acuse = await descargarAcuse(factura.facturapi_id, apiKey);
  const patch = {
    ...patchBase,
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? new Date().toISOString() : null,
    acuse_cancelacion_status: acuse.status,
  };
  const { error: upErr } = await supabase.from("facturas").update(patch).eq("id", factura.id);
  if (upErr) return false;

  // Marcar los vínculos con embarques como inactivos.
  await supabase.from("factura_embarques").update({ activa: false }).eq("factura_id", factura.id);

  // Liberar la proforma si ya no quedan facturas vivas apuntando a ella.
  // La RPC verifica hermanas vivas (por proforma_id + conceptos_factura.proforma_id_origen)
  // antes de degradar `estado_proforma`. Aquí sólo limpiamos punteros legacy.
  await supabase.rpc("revertir_proforma_al_cancelar_sustitucion", { p_factura_id: factura.id });
  await limpiarPunterosProformas(supabase, factura.id);

  const esSustitucion = !!factura.sustituida_por;

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: esSustitucion ? "facturapi_sustituida_async" : "facturapi_cancelada_async",
    entidadId: factura.id,
    detalles: { via: "cron_reconciliacion", cancellation_status: "accepted" },
  });
  return true;
}

interface ReconcileCtx {
  supabase: SupabaseClient;
  facturapi: { invoices: { retrieve: (id: string) => Promise<unknown> } };
  apiKey: string;
  orgId: string;
  resumen: Resumen;
}

async function reconcileOne(ctx: ReconcileCtx, factura: FacturaPendiente): Promise<void> {
  const { supabase, facturapi, apiKey, orgId, resumen } = ctx;
  resumen.revisadas++;
  try {
    const remote = await facturapi.invoices.retrieve(factura.facturapi_id) as FapiInvoiceStatus;
    const decision = resolveNextAction(remote, factura, new Date().toISOString());

    if (decision.outcome === "no_change") {
      resumen.sin_cambio++;
      return;
    }

    if (decision.outcome === "accepted") {
      const ok = await applyAccepted(supabase, factura, decision.patch, apiKey, orgId);
      if (!ok) { resumen.errores++; return; }
      resumen.aceptadas++;
      return;
    }

    // rejected / expired / transition
    await supabase.from("facturas").update(decision.patch).eq("id", factura.id);
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


/** EF-03: cierra una NC cuya cancelación el SAT aceptó asíncronamente (acuse + bitácora). */
async function applyAcceptedNc(
  supabase: SupabaseClient,
  nc: NotaCreditoPendiente,
  patchBase: Record<string, unknown>,
  apiKey: string,
  orgId: string,
): Promise<boolean> {
  const acuse = await descargarAcuse(nc.facturapi_id, apiKey);
  const patch = {
    ...patchBase,
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? new Date().toISOString() : null,
    acuse_cancelacion_status: acuse.status,
  };
  const { error: upErr } = await supabase.from("factura_notas_credito").update(patch).eq("id", nc.id);
  if (upErr) return false;

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelada_async",
    entidadId: nc.id,
    detalles: { via: "cron_reconciliacion", cancellation_status: "accepted" },
  });
  return true;
}

/** EF-03: espejo de reconcileOne para factura_notas_credito. */
async function reconcileOneNc(ctx: ReconcileCtx, nc: NotaCreditoPendiente): Promise<void> {
  const { supabase, facturapi, apiKey, orgId, resumen } = ctx;
  resumen.revisadas++;
  try {
    const remote = await facturapi.invoices.retrieve(nc.facturapi_id) as FapiInvoiceStatus;
    const decision = resolveNextActionNc(remote, nc, new Date().toISOString());

    if (decision.outcome === "no_change") {
      resumen.sin_cambio++;
      return;
    }

    if (decision.outcome === "accepted") {
      const ok = await applyAcceptedNc(supabase, nc, decision.patch, apiKey, orgId);
      if (!ok) { resumen.errores++; return; }
      resumen.aceptadas++;
      return;
    }

    // rejected / expired / transition
    await supabase.from("factura_notas_credito").update(decision.patch).eq("id", nc.id);
    if (decision.outcome === "rejected" || decision.outcome === "expired") {
      await registrarBitacoraEdge(supabase, {
        organizationId: orgId,
        usuarioId: null,
        modulo: "facturacion",
        accion: "facturapi_nc_cancelacion_no_aceptada",
        entidadId: nc.id,
        detalles: { via: "cron_reconciliacion", cancellation_status: decision.outcome },
      });
    }
    acumularOutcome(resumen, decision.outcome);
  } catch (_err) {
    resumen.errores++;
    // EF-12: no tragar el error — sin id un fallo sistemático (API key rotada,
    // red) sólo movía un contador invisible.
    console.error("[reconciliar-cancelaciones] error", {
      entidad: "nc",
      id: nc.id,
      error: _err instanceof Error ? _err.message : String(_err),
    });
    await captureEdgeException(_err, {
      fn: "facturapi-reconciliar-cancelaciones",
      organization_id: orgId,
      extra: { nota_credito_id: nc.id, facturapi_id: nc.facturapi_id },
    });
  }
}

Deno.serve(wrapEdgeHandler("facturapi-reconciliar-cancelaciones", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // M8: endpoint cron-only — mismo patrón que rep-retry-nocturno.
  if (!CRON_SECRET || req.headers.get("X-Cron-Secret") !== CRON_SECRET) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }



  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: pendientes, error: fetchErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, cancellation_status, sustituida_por")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .limit(200);

  if (fetchErr) return jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500);

  // EF-12: si el lote llega al tope de 200 probablemente hay backlog que tarda
  // horas en drenar a 200/30 min — dejar señal en Sentry para operación.
  if ((pendientes ?? []).length === 200) {
    await captureEdgeMessage("facturapi_reconciliar_backlog", "warning", {
      fn: "facturapi-reconciliar-cancelaciones",
      extra: { pendientes: 200 },
    });
  }

  // EF-03: las cancelaciones asíncronas de NC también se reconcilian aquí —
  // el webhook no las resuelve (factura_not_found → ignored) y sin este
  // barrido quedaban 'pending' para siempre tras el silencio positivo de 72 h.
  const { data: ncPendientes, error: ncFetchErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, cancellation_status")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .limit(200);

  if (ncFetchErr) return jsonResponse({ error: "db_fetch_failed", detail: ncFetchErr.message }, 500);

  const facturas = (pendientes ?? []) as FacturaPendiente[];
  const notasCredito = (ncPendientes ?? []) as NotaCreditoPendiente[];
  const resumen = nuevoResumen();
  const porOrg = agruparPorOrg(facturas);
  const ncPorOrg = agruparPorOrg(notasCredito as unknown as FacturaPendiente[]);
  // Unir las llaves de ambos mapas para resolver el cliente una sola vez por org.
  const orgIds = new Set<string>([...porOrg.keys(), ...ncPorOrg.keys()]);

  for (const orgId of orgIds) {
    const lote = porOrg.get(orgId) ?? [];
    const loteNc = (ncPorOrg.get(orgId) ?? []) as unknown as NotaCreditoPendiente[];
    const resolved = await getFacturapiClient(supabase, orgId);
    if (!resolved.ok) {
      resumen.errores += lote.length + loteNc.length;
      continue;
    }
    const ctx: ReconcileCtx = {
      supabase, facturapi: resolved.data.client, apiKey: resolved.data.apiKey, orgId, resumen,
    };
    for (const factura of lote) {
      await reconcileOne(ctx, factura);
    }
    for (const nc of loteNc) {
      await reconcileOneNc(ctx, nc);
    }
  }

  return jsonResponse({ ok: true, resumen });
}));
