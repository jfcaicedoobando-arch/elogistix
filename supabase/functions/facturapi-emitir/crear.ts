/** Emisión al proveedor y clasificación segura de sus respuestas. */
import { describeFacturapiError, extractFacturapiMessage, withFacturapiTimeout, FacturapiTimeoutError } from '../_shared/facturapiClient.ts';
import { registrarBitacoraEdge } from '../_shared/bitacora.ts';
import { jsonResponse } from '../_shared/response.ts';
import { esIdempotencyKeyEnUso } from '../_shared/timbradoPendiente.ts';
import { exigirInvoices, esContratoSdkError, cuerpoContratoSdk } from '../_shared/facturapiSdk.ts';
import { esRateLimitFacturapi, respuestaRateLimit } from '../_shared/facturapiRateLimit.ts';
import { respuestaIdempotencyEnUso } from './pendiente.ts';
import type { buildFacturapiPayload } from './helpers.ts';
import type { EmitirInput } from './types.ts';

export interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string; status?: string; use?: unknown }

export async function createInvoiceInFacturapi(
  input: EmitirInput,
  payload: ReturnType<typeof buildFacturapiPayload>,
): Promise<FapiInvoice | Response> {
  const { supabase, factura, facturaId, user, claim } = input;
  // P2-C: el cast del SDK vive centralizado en `_shared/facturapiSdk.ts`
  // (antes cada edge function repetía su propio cast anónimo). Si el SDK no
  // cumple el contrato NO se libera el claim ni se reintenta solo.
  let facturapi: { invoices: { create: (p: unknown) => Promise<unknown> } };
  try {
    facturapi = { invoices: exigirInvoices(input.facturapi, "create") };
  } catch (err) {
    if (!esContratoSdkError(err)) throw err;
    const r = cuerpoContratoSdk(err, claim.claimTag);
    return jsonResponse(r.body, r.status);
  }

  const meta = {
    supabase, facturaId, organizationId: factura.organization_id, numero: factura.numero ?? null,
    claimTag: claim.claimTag, usuarioId: user.id, usuarioEmail: user.email,
  };
  try {
    // FIX-04/32 — timeout defensivo: si FacturApi cuelga devolvemos 504 en vez
    // de dejar la Edge Function ocupada 150 s.
    // El cliente del SDK llega como objeto opaco (sus typings no se resuelven
    // desde `npm:` en Deno): el adaptador `_shared/facturapiSdk.ts` lo tipa y
    // valida en runtime la operación que se va a usar.
    return await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;


  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      // EF-02 (auditoría): en timeout NO liberamos el claim. Si FacturApi sí
      // timbró, el tag PENDING:<uuid> (external_id + idempotency_key) es la
      // única correlación que permite a facturapi-recuperar-claim adoptar el
      // CFDI; liberarlo aquí convertía un timeout benigno en un duplicado.
      await registrarBitacoraEdge(supabase, {
        organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
        accion: "facturapi_emitir_timeout", entidadId: facturaId, entidadNombre: factura.numero ?? "",
        detalles: { op: err.op, timeout_ms: err.timeoutMs },
      });
      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. No reintentes el timbrado: usa 'Recuperar timbrado' para sincronizar el intento en curso.`, timeout_ms: err.timeoutMs }, 504);
    }
    const { status, detail } = describeFacturapiError(err);
    // P0-B.4: la llave de idempotencia en uso NO autoriza otro CFDI.
    if (esIdempotencyKeyEnUso(detail, status)) return await respuestaIdempotencyEnUso(meta);
    // P2-B: 429 = el proveedor rechazó la petición ANTES de timbrar. Se libera
    // el claim para que el operador reintente cuando pase la espera, y se
    // responde 429 accionable (nunca un reintento automático).
    if (esRateLimitFacturapi(status, detail)) {
      await claim.release();
      await registrarBitacoraEdge(supabase, {
        organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
        accion: "facturapi_emitir_rate_limited", entidadId: facturaId, entidadNombre: factura.numero ?? "",
        detalles: {
          status, retry_after_segundos: detail.retryAfterSegundos ?? null,
          request_id: detail.requestId ?? null, log_id: detail.logId ?? null,
        },
      });
      return respuestaRateLimit(detail);
    }
    // Error definitivo de FacturApi (no timbró): sí liberamos para reintentar.
    await claim.release();

    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
      accion: "facturapi_emitir_failed", entidadId: facturaId, entidadNombre: factura.numero ?? "",
      detalles: { status, response: detail },
    });
    const message = extractFacturapiMessage(detail, status);
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }
}
