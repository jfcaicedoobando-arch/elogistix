/**
 * REF-02: barrido de REPs (`pagos_factura`) en el cron de reconciliación.
 *
 * `facturapi-cancelar-rep` deja `rep_cancellation_status='pending'/'verifying'`
 * (cancelación asíncrona con silencio positivo de 72 h) y hasta ahora la única
 * vía de cierre era el webhook `receipt.canceled`. Si el webhook se pierde, el
 * REP quedaba en "cancelación pendiente" para siempre — mismo síntoma que EF-03
 * en la familia de notas de crédito.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { captureEdgeException } from "../_shared/sentry.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { withFacturapiTimeout } from "../_shared/facturapiClient.ts";
import { CRON_RETRIEVE_TIMEOUT_MS } from "./presupuesto.ts";
import {
  acumularOutcome,
  resolveNextActionRep,
  type FapiInvoiceStatus,
  type RepPendiente,
  type Resumen,
} from "./reconcile.ts";
import { marcarRevisado } from "./cursor.ts";

interface RepCtx {
  supabase: SupabaseClient;
  facturapi: { invoices: { retrieve: (id: string) => Promise<unknown> } };
  orgId: string;
  resumen: Resumen;
}

/** Cierra un REP cuya cancelación el SAT aceptó asíncronamente. */
async function applyAcceptedRep(
  supabase: SupabaseClient,
  rep: RepPendiente,
  patchBase: Record<string, unknown>,
  orgId: string,
): Promise<boolean> {
  // `pagos_factura` no tiene columnas de acuse de cancelación de REP: el cierre
  // replica la rama aceptada de `facturapi-cancelar-rep` (update + bitácora).
  const { error: upErr } = await supabase.from("pagos_factura").update(patchBase).eq("id", rep.id);
  if (upErr) return false;

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: "facturapi_rep_cancelado_async",
    entidadId: rep.id,
    detalles: { via: "cron_reconciliacion", rep_cancellation_status: "accepted" },
  });
  return true;
}

/** Espejo de `reconcileOneNc` para `pagos_factura` (REP). */
export async function reconcileOneRep(ctx: RepCtx, rep: RepPendiente): Promise<void> {
  const { supabase, facturapi, orgId, resumen } = ctx;
  resumen.revisadas++;
  try {
    return await reconcileOneRepInner(ctx, rep);
  } finally {
    // P1-3: marca el cursor SIEMPRE (accepted/no_change/error) — sólo se llega
    // aquí en documentos realmente INICIADOS (los diferidos no entran).
    await marcarRevisado(
      supabase,
      "pagos_factura",
      "rep_reconciliacion_checked_at",
      rep.id,
      new Date().toISOString(),
    );
  }
}

async function reconcileOneRepInner(ctx: RepCtx, rep: RepPendiente): Promise<void> {
  const { supabase, facturapi, orgId, resumen } = ctx;
  try {
    // P1-3b: timeout compartido (12 s) con las familias factura/NC.
    const remote = await withFacturapiTimeout(
      "invoices.retrieve",
      facturapi.invoices.retrieve(rep.facturapi_rep_id),
      CRON_RETRIEVE_TIMEOUT_MS,
    ) as FapiInvoiceStatus;
    const decision = resolveNextActionRep(remote, rep, new Date().toISOString());

    if (decision.outcome === "no_change") {
      resumen.sin_cambio++;
      return;
    }

    if (decision.outcome === "accepted") {
      const ok = await applyAcceptedRep(supabase, rep, decision.patch, orgId);
      if (!ok) { resumen.errores++; return; }
      resumen.aceptadas++;
      return;
    }

    // rejected / expired / transition
    await supabase.from("pagos_factura").update(decision.patch).eq("id", rep.id);
    if (decision.outcome === "rejected" || decision.outcome === "expired") {
      await registrarBitacoraEdge(supabase, {
        organizationId: orgId,
        usuarioId: null,
        modulo: "facturacion",
        accion: "facturapi_rep_cancelacion_no_aceptada",
        entidadId: rep.id,
        detalles: { via: "cron_reconciliacion", rep_cancellation_status: decision.outcome },
      });
    }
    acumularOutcome(resumen, decision.outcome);
  } catch (_err) {
    resumen.errores++;
    // EF-12: no tragar el error — un fallo sistemático (API key rotada, red)
    // sólo movía un contador invisible.
    console.error("[reconciliar-cancelaciones] error", {
      entidad: "rep",
      id: rep.id,
      error: _err instanceof Error ? _err.message : String(_err),
    });
    await captureEdgeException(_err, {
      fn: "facturapi-reconciliar-cancelaciones",
      organization_id: orgId,
      extra: { pago_id: rep.id, facturapi_rep_id: rep.facturapi_rep_id },
    });
  }
}
