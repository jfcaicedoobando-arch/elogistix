/**
 * Llamada a Facturapi para timbrar el REP y manejo de errores/timeout.
 * Extraído de `index.ts` (Power of 10: handler ≤200 líneas).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { esIdempotencyKeyEnUso, MSG_IDEMPOTENCY_EN_USO } from "../_shared/timbradoPendiente.ts";
import { esRateLimitFacturapi, respuestaRateLimit } from "../_shared/facturapiRateLimit.ts";


export interface FapiInvoice {
  id: string;
  uuid: string;
  folio_number?: number;
  folio?: number;
  series?: string;
  /** P0-A: FacturAPI puede responder "pending" (timbre en recuperación). */
  status?: string;
}

interface TimbrarDeps {
  facturapi: { invoices: { create: (payload: unknown) => Promise<unknown> } };
  payload: Record<string, unknown>;
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  claimTag: string;
  releaseClaim: () => Promise<void>;
  json: (body: unknown, status?: number) => Response;
}

type Resultado = { ok: true; invoice: FapiInvoice } | { ok: false; response: Response };

/** Timbra el REP; en error devuelve la respuesta HTTP ya construida. */
export async function timbrarRep(deps: TimbrarDeps): Promise<Resultado> {
  const { supabase, pagoId, organizationId, usuarioId, usuarioEmail, claimTag, json } = deps;
  try {
    // EF-01/EF-02: timeout defensivo. En timeout NO se libera el claim: si
    // Facturapi sí timbró, el tag es la única correlación para recuperarlo.
    const invoice = await withFacturapiTimeout(
      "invoices.create",
      deps.facturapi.invoices.create(deps.payload),
    ) as FapiInvoice;
    return { ok: true, invoice };
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      await registrarBitacoraEdge(supabase, {
        organizationId,
        usuarioId,
        usuarioEmail,
        modulo: "facturacion",
        accion: "facturapi_rep_emitir_timeout",
        entidadId: pagoId,
        detalles: { op: err.op, timeout_ms: err.timeoutMs, external_id: claimTag },
      });
      return {
        ok: false,
        response: json({
          error: "facturapi_timeout",
          message: `${err.message}. El REP pudo haberse timbrado: NO reintentes; usa 'Recuperar timbrado' para sincronizar el intento en curso.`,
          timeout_ms: err.timeoutMs,
          external_id: claimTag,
        }, 504),
      };
    }

    const { status, detail } = describeFacturapiError(err);
    // P0-B.4: llave de idempotencia en uso ⇒ hay un intento vivo en FacturAPI.
    // NO se libera el claim ni se marca Error: se reconcilia.
    if (esIdempotencyKeyEnUso(detail, status)) {
      await registrarBitacoraEdge(supabase, {
        organizationId, usuarioId, usuarioEmail, modulo: "facturacion",
        accion: "facturapi_rep_idempotency_en_uso", entidadId: pagoId,
        detalles: { external_id: claimTag },
      });
      return {
        ok: false,
        response: json({
          error: "idempotency_key_in_use", reintentable: false,
          external_id: claimTag, message: MSG_IDEMPOTENCY_EN_USO,
        }, 409),
      };
    }

    // P2-B: 429 (tope de peticiones) es transitorio y ocurre ANTES de timbrar:
    // se libera el claim para permitir un reintento MANUAL y NO se marca
    // `estado_rep='Error'` (no hay nada que conciliar, sólo hay que esperar).
    if (esRateLimitFacturapi(status, detail)) {
      await deps.releaseClaim();
      await registrarBitacoraEdge(supabase, {
        organizationId, usuarioId, usuarioEmail, modulo: "facturacion",
        accion: "facturapi_rep_rate_limited", entidadId: pagoId,
        detalles: {
          status, external_id: claimTag,
          retry_after_segundos: detail.retryAfterSegundos ?? null,
          request_id: detail.requestId ?? null, log_id: detail.logId ?? null,
        },
      });
      return { ok: false, response: respuestaRateLimit(detail) };
    }


    // Error definitivo de Facturapi (no timbró): liberar el claim para reintentar.
    await deps.releaseClaim();
    const errMsg = typeof detail === "object" && detail !== null
      ? JSON.stringify(detail).slice(0, 500)
      : "Facturapi error";
    await supabase.from("pagos_factura")
      .update({ estado_rep: "Error", rep_error: errMsg })
      .eq("id", pagoId);
    await registrarBitacoraEdge(supabase, {
      organizationId,
      usuarioId,
      usuarioEmail,
      modulo: "facturacion",
      accion: "facturapi_rep_emitir_failed",
      entidadId: pagoId,
      detalles: { status, response: detail },
    });
    const message = typeof detail.message === "string" && detail.message.length > 0
      ? detail.message
      : `FacturApi respondió ${status}`;

    return { ok: false, response: json({ error: "facturapi_error", status, detail, message }, 502) };
  }
}
