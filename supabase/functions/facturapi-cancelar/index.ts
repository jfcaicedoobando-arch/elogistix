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
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import { descargarAcuseCancelacion } from "./descargarAcuse.ts";
import { validateCancelacionInput, type CancelacionInput } from "./helpers.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { handleDescargarAcusePdf, handleDescargarAcuseXml } from "./acuseHandlers.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

Deno.serve(wrapEdgeHandler("facturapi-cancelar", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

  const rawBody = (await req.json().catch(() => ({}))) as CancelacionInput & {
    sustituida_por_factura_id?: string;
    solo_descargar_acuse?: boolean;
    solo_descargar_acuse_pdf?: boolean;
  };

  // Modo "solo descargar acuse PDF": Facturapi expone el acuse SAT en
  // formato PDF (además del XML). Aquí lo streameamos como binario al
  // navegador sin guardarlo en BD (el XML sigue siendo la fuente de verdad).
  if (rawBody.solo_descargar_acuse_pdf === true) {
    if (!rawBody.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);
    return await handleDescargarAcusePdf(supabase, userData.user.id, rawBody.factura_id);
  }

  // Modo "solo descargar acuse": la factura ya se canceló antes y sólo
  // necesitamos volver a preguntarle al SAT por el acuse (útil cuando la
  // primera cancelación quedó con `acuse_cancelacion_status = 'pending'`).
  if (rawBody.solo_descargar_acuse === true) {
    if (!rawBody.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);
    return await handleDescargarAcuseXml(supabase, userData.user.id, rawBody.factura_id);
  }

  // Si viene `sustituida_por_factura_id`, resolver su UUID SAT y su facturapi_id.
  // FacturApi espera el `facturapi_id` (ObjectId) en el parámetro `substitution`,
  // NO el UUID SAT. El UUID SAT sólo lo usamos para bitácora/auditoría.
  let sustituyeUuidResuelto: string | undefined = rawBody.sustituye_uuid;
  let sustituyeFacturapiId: string | undefined;
  const sustituidaPorFacturaId: string | null = rawBody.sustituida_por_factura_id ?? null;
  if (sustituidaPorFacturaId) {
    const { data: nueva } = await supabase
      .from("facturas").select("id, uuid_fiscal, facturapi_id").eq("id", sustituidaPorFacturaId).maybeSingle();
    if (!nueva?.uuid_fiscal || !nueva.facturapi_id) {
      return jsonResponse({ error: "sustituta_sin_uuid", message: "La factura sustituta aún no está timbrada." }, 422);
    }
    sustituyeUuidResuelto = nueva.uuid_fiscal as string;
    sustituyeFacturapiId = nueva.facturapi_id as string;
  }

  const validated = validateCancelacionInput({ ...rawBody, sustituye_uuid: sustituyeUuidResuelto });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error, ...(validated.message ? { message: validated.message } : {}) }, 400);
  }
  const { factura_id, motivo, sustituye_uuid } = validated.data;

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado")
    .eq("id", factura_id)
    .maybeSingle();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found" }, 404);
  if (!factura.facturapi_id) return jsonResponse({ error: "no_timbrada" }, 409);
  if (!(await authorizeOrgMembership(supabase, userData.user.id, factura.organization_id))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    // `substitution` requiere el facturapi_id (ObjectId) de la factura sustituta.
    const cancelPayload: { motive: string; substitution?: string } = { motive: motivo };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    cancelResp = await facturapi.invoices.cancel(
      factura.facturapi_id,
      cancelPayload,
    ) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_cancelar_failed",
      entidadId: factura_id,
      detalles: { status, response: detail },
    });
    const message = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }
  const fapiJson = cancelResp;

  // Descarga inmediata del acuse SAT. Si el SAT aún no lo emite, quedará
  // como 'pending' y un cron posterior podrá reintentar. Guardar el XML
  // es OBLIGATORIO por SAT desde 2022 (conservación 5 años).
  const acuse = await descargarAcuseCancelacion(factura.facturapi_id!, resolved.data.apiKey);

  // Si fue sustitución (motivo 01 + sustituta resuelta), marcar estado 'Sustituida'
  // y enlazar `sustituida_por`; si no, el ciclo normal -> 'Cancelada'.
  const esSustitucion = motivo === "01" && !!sustituidaPorFacturaId;
  const updatePayload: Record<string, unknown> = {
    estado: esSustitucion ? "Sustituida" : "Cancelada",
    cancelacion_motivo: motivo,
    cancelado_en: new Date().toISOString(),
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? new Date().toISOString() : null,
    acuse_cancelacion_status: acuse.status,
  };
  if (esSustitucion) updatePayload.sustituida_por = sustituidaPorFacturaId;

  const { error: updErr } = await supabase
    .from("facturas")
    .update(updatePayload)
    .eq("id", factura_id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  // Revertir proformas ligadas a esta factura para que puedan volver a facturarse.
  // Si la proforma originó 2 facturas (venta + demoras), sólo limpiamos el campo
  // que apunta a la factura cancelada; volvemos a 'pendiente' únicamente cuando
  // ya no queda ninguna factura activa ligada.
  const proformasRevertidas: Array<{ id: string; estado: string }> = [];
  if (!esSustitucion) {
    const { data: proformasLigadas } = await supabase
      .from("proformas")
      .select("id, factura_id, factura_secundaria_id")
      .or(`factura_id.eq.${factura_id},factura_secundaria_id.eq.${factura_id}`);
    for (const pf of proformasLigadas ?? []) {
      const nuevoFacturaId = pf.factura_id === factura_id ? null : pf.factura_id;
      const nuevoFacturaSecId = pf.factura_secundaria_id === factura_id ? null : pf.factura_secundaria_id;
      const ambosNulos = !nuevoFacturaId && !nuevoFacturaSecId;
      const patch: Record<string, unknown> = {
        factura_id: nuevoFacturaId,
        factura_secundaria_id: nuevoFacturaSecId,
      };
      if (ambosNulos) {
        patch.estado_proforma = "pendiente";
        patch.fecha_facturacion = null;
        patch.folio_factura_externa = null;
      }
      const { error: upPfErr } = await supabase.from("proformas").update(patch).eq("id", pf.id);
      if (!upPfErr) proformasRevertidas.push({ id: pf.id, estado: ambosNulos ? "pendiente" : "facturada" });
    }
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: esSustitucion ? "facturapi_sustituida" : "facturapi_cancelada",
    entidadId: factura_id,
    detalles: {
      motivo,
      sustituye_uuid: sustituye_uuid ?? null,
      sustituida_por_factura_id: sustituidaPorFacturaId,
      proformas_revertidas: proformasRevertidas,
    },
  });

  return jsonResponse({
    ok: true,
    status: fapiJson.status ?? "canceled",
    sustituida: esSustitucion,
    acuse_status: acuse.status,
    acuse_guardado: !!acuse.xml,
  });
}));

