/**
 * Helpers puros para `facturapi-reconciliar-cancelaciones`.
 * Sin I/O directo excepto los deps inyectados; permite tests aislados.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

export interface FacturaPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
  sustituida_por: string | null;
}

export interface FapiInvoiceStatus {
  status?: string;
  cancellation_status?: string;
}

export interface AcuseResult {
  xml: string | null;
  status: string;
}

export interface ResolvedPatch {
  outcome: "accepted" | "rejected" | "expired" | "transition" | "no_change";
  patch: Record<string, unknown>;
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
    });
    if (res.status === 200) return { xml: await res.text(), status: "accepted" };
    if (res.status === 404 || res.status === 425) return { xml: null, status: "pending" };
    return { xml: null, status: `error_${res.status}` };
  } catch {
    return { xml: null, status: "error_network" };
  }
}

/**
 * Decide qué hacer con la factura según el cancellation_status remoto vs. local.
 * Devuelve el patch a aplicar y el "outcome" (para actualizar el resumen).
 * NO ejecuta I/O: la actualización real (BD, acuse) queda para el llamador.
 */
export function resolveNextAction(
  remote: FapiInvoiceStatus,
  local: FacturaPendiente,
  nowIso: string,
): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();

  if (cs === local.cancellation_status) {
    return { outcome: "no_change", patch: {} };
  }

  if (cs === "accepted" || remote.status === "canceled") {
    const esSustitucion = !!local.sustituida_por;
    return {
      outcome: "accepted",
      patch: {
        estado: esSustitucion ? "Sustituida" : "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }

  if (cs === "rejected") {
    return {
      outcome: "rejected",
      patch: {
        cancellation_status: cs,
        cancelacion_solicitada_en: null,
        cancelacion_vence_en: null,
      },
    };
  }

  if (cs === "expired") {
    return {
      outcome: "expired",
      patch: {
        cancellation_status: cs,
        cancelacion_solicitada_en: null,
        cancelacion_vence_en: null,
      },
    };
  }

  // Local dice "pending/verifying" pero FacturAPI ya no reporta cancelación en curso
  // (ni aceptada). El proceso quedó colgado: limpiar el flag local para que la
  // factura vuelva a mostrarse como "Emitida" en la UI.
  const localEnProceso = local.cancellation_status === "pending" || local.cancellation_status === "verifying";
  if (!cs && localEnProceso && remote.status !== "canceled") {
    return {
      outcome: "cleared",
      patch: {
        cancellation_status: null,
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
  limpiadas: number;
  sin_cambio: number;
  errores: number;
}

export function nuevoResumen(): Resumen {
  return { revisadas: 0, aceptadas: 0, rechazadas: 0, expiradas: 0, limpiadas: 0, sin_cambio: 0, errores: 0 };
}

export function acumularOutcome(resumen: Resumen, outcome: ResolvedPatch["outcome"]): void {
  if (outcome === "accepted") resumen.aceptadas++;
  else if (outcome === "rejected") resumen.rechazadas++;
  else if (outcome === "expired") resumen.expiradas++;
  else if (outcome === "cleared") resumen.limpiadas++;
  else resumen.sin_cambio++;
}
