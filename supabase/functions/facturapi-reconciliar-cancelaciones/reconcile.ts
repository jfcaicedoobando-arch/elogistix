/**
 * Helpers puros para `facturapi-reconciliar-cancelaciones`.
 * Sin I/O directo excepto los deps inyectados; permite tests aislados.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import type { FapiInvoiceStatus, ResolvedPatch } from "../_shared/facturapiReconciliarFactura.ts";

export { resolveNextAction, type FapiInvoiceStatus, type ResolvedPatch } from "../_shared/facturapiReconciliarFactura.ts";

export interface FacturaPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
  sustituida_por: string | null;
  reconciliacion_checked_at?: string | null;
}

export interface AcuseResult {
  xml: string | null;
  status: string;
}

/** Descarga el acuse de cancelación desde FacturApi (o pending si aún no está). */
export async function descargarAcuse(
  facturapiId: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AcuseResult> {
  try {
    const res = await fetchFn(`${FACTURAPI_BASE}/invoices/${facturapiId}/cancellation_receipt/xml`, {
      headers: { Authorization: basicAuthHeader(apiKey) },
      // R3EF-02 (Ola 12): un socket colgado no disparaba el catch y consumía
      // el wall-clock de la edge. Patrón AbortSignal.timeout (test-conexion),
      // 12 s como respaldarXmlTimbrado (EF-08).
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 200) return { xml: await res.text(), status: "accepted" };
    if (res.status === 404 || res.status === 425) return { xml: null, status: "pending" };
    return { xml: null, status: `error_${res.status}` };
  } catch (e) {
    const esTimeout = e instanceof DOMException &&
      (e.name === "TimeoutError" || e.name === "AbortError");
    // Reintentable: el acuse queda en null y la próxima corrida lo reintenta.
    return { xml: null, status: esTimeout ? "error_timeout" : "error_network" };
  }
}

/** Agrupa las facturas pendientes por organization_id para reutilizar cliente. */
export function agruparPorOrg(facturas: FacturaPendiente[]): Map<string, FacturaPendiente[]> {
  const map = new Map<string, FacturaPendiente[]>();
  for (const f of facturas) {
    const list = map.get(f.organization_id);
    if (list) list.push(f);
    else map.set(f.organization_id, [f]);
  }
  return map;
}

export interface Resumen {
  revisadas: number;
  aceptadas: number;
  rechazadas: number;
  expiradas: number;
  sin_cambio: number;
  errores: number;
  /** P1-3b: documentos NO iniciados por corte de presupuesto de wall-time. */
  diferidos: number;
}

export function nuevoResumen(): Resumen {
  return { revisadas: 0, aceptadas: 0, rechazadas: 0, expiradas: 0, sin_cambio: 0, errores: 0, diferidos: 0 };
}

export function acumularOutcome(resumen: Resumen, outcome: ResolvedPatch["outcome"]): void {
  if (outcome === "accepted") resumen.aceptadas++;
  else if (outcome === "rejected") resumen.rechazadas++;
  else if (outcome === "expired") resumen.expiradas++;
  else resumen.sin_cambio++;
}


/** EF-03: fila de NC con cancelación asíncrona pendiente. */
export interface NotaCreditoPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
  reconciliacion_checked_at?: string | null;
}

/**
 * EF-03: espejo de resolveNextAction para notas de crédito. Las NC no tienen
 * flujo de sustitución, así que el estado terminal siempre es 'Cancelada'.
 */
export function resolveNextActionNc(
  remote: FapiInvoiceStatus,
  local: NotaCreditoPendiente,
  nowIso: string,
): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();

  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado: "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }

  if (cs === local.cancellation_status) {
    return { outcome: "no_change", patch: {} };
  }

  if (cs === "rejected" || cs === "expired") {
    return {
      outcome: cs,
      patch: {
        cancellation_status: cs,
        cancelacion_solicitada_en: null,
        cancelacion_vence_en: null,
      },
    };
  }

  if (cs && cs !== local.cancellation_status) {
    return { outcome: "transition", patch: { cancellation_status: cs } };
  }

  return { outcome: "no_change", patch: {} };
}


/** REF-02: fila de pago con cancelación de REP asíncrona pendiente. */
export interface RepPendiente {
  id: string;
  organization_id: string;
  facturapi_rep_id: string;
  rep_cancellation_status: string;
  rep_reconciliacion_checked_at?: string | null;
}

/**
 * REF-02: espejo de resolveNextActionNc para REPs (pagos_factura). El REP no
 * tiene flujo de sustitución vía cron, así que el estado terminal siempre es
 * estado_rep='Cancelado' con rep_cancellation_status='accepted' — el mismo
 * patch de la rama aceptada de facturapi-cancelar-rep.
 */
export function resolveNextActionRep(
  remote: FapiInvoiceStatus,
  local: RepPendiente,
  nowIso: string,
): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();

  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado_rep: "Cancelado",
        rep_cancellation_status: "accepted",
        rep_cancelado_en: nowIso,
      },
    };
  }

  if (cs === local.rep_cancellation_status) {
    return { outcome: "no_change", patch: {} };
  }

  if (cs === "rejected" || cs === "expired") {
    return { outcome: cs, patch: { rep_cancellation_status: cs } };
  }

  if (cs && cs !== local.rep_cancellation_status) {
    return { outcome: "transition", patch: { rep_cancellation_status: cs } };
  }

  return { outcome: "no_change", patch: {} };
}
