/**
 * facturapi-cancelar — Cancela un CFDI emitido en Facturapi.
 *
 * Entrada: { factura_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string, sustituida_por_factura_id?: string }
 * Motivos SAT:
 *   01 = Comprobante emitido con errores con relación
 *   02 = Comprobante emitido con errores sin relación
 *   03 = No se llevó a cabo la operación
 *   04 = Operación nominativa relacionada en una factura global
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { validateCancelacionInput, type CancelacionInput } from "./helpers.ts";
import { handleDescargarAcusePdf, handleDescargarAcuseXml } from "./acuseHandlers.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
import { marcarTimeoutCancelacion } from "./timeoutCancelacion.ts";
import {
  handleCancelFailure,
  resolveSustitutaSnapshot,
  runPreflightSustitucion,
} from "./cancelacion.ts";

import {
  handleAceptada,
  handleEstadoDesconocido,
  handlePendiente,
  handleRechazada,
} from "./terminales.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

Deno.serve(wrapEdgeHandler("facturapi-cancelar", async (req) => {
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const rawBody = (await req.json().catch(() => ({}))) as CancelacionInput & {
    sustituida_por_factura_id?: string;
    solo_descargar_acuse?: boolean;
    solo_descargar_acuse_pdf?: boolean;
  };

  // Modo "solo descargar acuse PDF": Facturapi expone el acuse SAT en
  // formato PDF (además del XML). Aquí lo streameamos como binario al
  // navegador sin guardarlo en BD (el XML sigue siendo la fuente de verdad).
  if (rawBody.solo_descargar_acuse_pdf === true) {
    if (!rawBody.factura_id) return json({ error: "factura_id_required" }, 400);
    return await handleDescargarAcusePdf(supabase, userData.user.id, rawBody.factura_id);
  }

  // Modo "solo descargar acuse": la factura ya se canceló antes y sólo
  // necesitamos volver a preguntarle al SAT por el acuse (útil cuando la
  // primera cancelación quedó con `acuse_cancelacion_status = 'pending'`).
  if (rawBody.solo_descargar_acuse === true) {
    if (!rawBody.factura_id) return json({ error: "factura_id_required" }, 400);
    return await handleDescargarAcuseXml(supabase, userData.user.id, rawBody.factura_id);
  }

  // Si viene `sustituida_por_factura_id`, resolver su UUID SAT y su facturapi_id.
  // FacturApi espera el `facturapi_id` (ObjectId) en el parámetro `substitution`,
  // NO el UUID SAT. El UUID SAT sólo lo usamos para bitácora/auditoría.
  let sustituyeUuidResuelto: string | undefined = rawBody.sustituye_uuid;
  let sustituyeFacturapiId: string | undefined;
  let sustitutaOrgId: string | undefined;
  const sustituidaPorFacturaId: string | null = rawBody.sustituida_por_factura_id ?? null;
  if (sustituidaPorFacturaId) {
    const snap = await resolveSustitutaSnapshot(supabase, sustituidaPorFacturaId);
    if (!snap.ok) {
      return json({ error: "sustituta_sin_uuid", message: "La factura sustituta aún no está timbrada." }, 422);
    }
    sustituyeUuidResuelto = snap.uuid;
    sustituyeFacturapiId = snap.facturapiId;
    sustitutaOrgId = snap.organizationId;
  }

  const validated = validateCancelacionInput({ ...rawBody, sustituye_uuid: sustituyeUuidResuelto });
  if (!validated.ok) {
    return json({ error: validated.error, ...(validated.message ? { message: validated.message } : {}) }, 400);
  }
  const { factura_id, motivo, sustituye_uuid } = validated.data;

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado")
    .eq("id", factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found" }, 404);
  if (!factura.facturapi_id) return json({ error: "no_timbrada" }, 409);
  // Ola 4 · N38: la sustituta debe pertenecer a la MISMA organización que la
  // factura a cancelar — sin este guard se grababa `sustituida_por`
  // cross-tenant y el pre-flight consultaba un ObjectId ajeno.
  if (sustitutaOrgId && sustitutaOrgId !== factura.organization_id) {
    return json({ error: "sustituta_otra_org", message: "La factura sustituta pertenece a otra organización." }, 422);
  }
  if (!(await authorizeOrgRole(supabase, userData.user.id, factura.organization_id, ROLES_EMISOR_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  // Pre-flight motivo 01: verificar related_documents relación 04.
  if (motivo === "01" && sustituyeFacturapiId) {
    const preflight = await runPreflightSustitucion({
      supabase,
      facturapi: facturapi as { invoices: { retrieve: (id: string) => Promise<unknown> } },
      facturaId: factura_id,
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      motivo,
      sustituyeFacturapiId,
      sustituidaPorFacturaId,
    });
    if (preflight) return preflight;
  }

  // FacturApi devuelve tanto `status` (valid/canceled) como `cancellation_status`
  // (none|verifying|pending|accepted|rejected|expired).
  interface FapiCancelResponse { status?: string; cancellation_status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    const cancelPayload: { motive: string; substitution?: string } = { motive: motivo };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    // EF-05: timeout defensivo (guía facturapiClient.ts "Envuelve TODA llamada
    // al SDK"). En timeout el cron reconciliar-cancelaciones sincroniza el
    // estado real de la factura.
    cancelResp = await withFacturapiTimeout(
      "invoices.cancel",
      facturapi.invoices.cancel(factura.facturapi_id, cancelPayload),
      FACTURAPI_CANCEL_TIMEOUT_MS,
    ) as FapiCancelResponse;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      // REF-01: dejar la fila en `verifying` para que el cron la reconcilie.
      const marca = await marcarTimeoutCancelacion({
        supabase,
        facturaId: factura_id,
        organizationId: factura.organization_id,
        usuarioId: userData.user.id,
        usuarioEmail: userData.user.email,
        motivo,
        op: err.op,
        timeoutMs: err.timeoutMs,
      });
      // v13.821.6 — Si el estado quedó persistido como pending/verifying, la
      // solicitud está ACEPTADA con resultado incierto: el cron y "Verificar
      // estatus" la resuelven. Responder 504 hacía que la UI comunicara un
      // fallo definitivo y ofreciera reintentar, lo cual es inseguro.
      if (marca.persisted) {
        return json(
          {
            ok: true,
            pending: true,
            uncertain: true,
            cancellation_status: marca.cancellationStatus,
            message:
              "La solicitud fue enviada, pero FacturApi tardó en confirmar. Estamos verificando el estado; no vuelvas a cancelarla.",
          },
          202,
        );
      }
      // Sin `verifying` persistido nadie reconciliará: error observable.
      return json(
        {
          error: "facturapi_timeout",
          op: err.op,
          timeout_ms: err.timeoutMs,
          persisted: false,
          message: err.message,
        },
        504,
      );
    }


    return await handleCancelFailure({
      err,
      supabase,
      facturaId: factura_id,
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
    });
  }

  const cancellationStatus = (cancelResp.cancellation_status ?? "none").toLowerCase();
  const invoiceStatus = (cancelResp.status ?? "").toLowerCase();
  const esSustitucion = motivo === "01" && !!sustituidaPorFacturaId;
  const esAceptada = cancellationStatus === "accepted" || (invoiceStatus === "canceled" && cancellationStatus === "none");
  const esPendiente = cancellationStatus === "pending" || cancellationStatus === "verifying";
  const esRechazada = cancellationStatus === "rejected" || cancellationStatus === "expired";
  const nowIso = new Date().toISOString();
  const baseCtx = {
    supabase,
    facturaId: factura_id,
    organizationId: factura.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    motivo,
    esSustitucion,
    sustituidaPorFacturaId,
  };

  if (esRechazada) return await handleRechazada({ ...baseCtx, cancellationStatus });
  if (esPendiente) return await handlePendiente({ ...baseCtx, cancellationStatus, nowIso });
  if (!esAceptada) return await handleEstadoDesconocido({ ...baseCtx, cancellationStatus, invoiceStatus });

  return await handleAceptada({
    ...baseCtx,
    nowIso,
    facturapiId: factura.facturapi_id!,
    apiKey: resolved.data.apiKey,
    sustituyeUuid: sustituye_uuid,
    cancelStatusHint: cancelResp.status,
  });
}));


