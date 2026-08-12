/**
 * Llamada a Facturapi para timbrar el REP y manejo de errores/timeout.
 * Extraído de `index.ts` (Power of 10: handler ≤200 líneas).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

export interface FapiInvoice {
  id: string;
  uuid: string;
  folio_number?: number;
  folio?: number;
  series?: string;
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
          message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — el REP pudo haberse timbrado; no reintentes directamente.`,
          timeout_ms: err.timeoutMs,
          external_id: claimTag,
        }, 504),
      };
    }

    // Error definitivo de Facturapi (no timbró): liberar el claim para reintentar.
    await deps.releaseClaim();
    const { status, detail } = describeFacturapiError(err);
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
    const detalleObj = detail as Record<string, unknown> | null;
    const message = detalleObj && typeof detalleObj === "object" && typeof detalleObj.message === "string"
      ? detalleObj.message
      : `FacturApi respondió ${status}`;
    return { ok: false, response: json({ error: "facturapi_error", status, detail, message }, 502) };
  }
}
