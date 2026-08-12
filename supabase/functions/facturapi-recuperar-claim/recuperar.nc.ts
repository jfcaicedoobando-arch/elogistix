/**
 * Recuperación de claims de notas de crédito (factura_notas_credito). Extraído de `recuperar.ts`
 * (Power of 10: archivos ≤250 líneas).
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE } from "../facturapi-emitir/helpers.ts";
import { respaldarXmlTimbrado, type RespaldoResult } from "../_shared/respaldarXmlTimbrado.ts";
import { MIN_EDAD_MINUTOS, type FapiInvoice, type UserIdentity } from "./recuperar.ts";



/* ── Ola 5 · RG4-4 — recuperación de claims en notas de crédito ──────────
 * La emisión de NC (Ola 4 · N1) reclama la fila con PENDING:<uuid> y envía
 * ese tag como external_id. Si la edge muere entre el timbrado y el persist,
 * preloadNcContext devuelve 409 ya_timbrada para siempre: estas funciones
 * extienden a `factura_notas_credito` la misma reconciliación que ya existía
 * para `facturas`. */

export interface NotaCreditoRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  facturapi_claim_at: string | null;
  serie: string | null;
  folio: string | null;
}

export async function loadNotaCredito(supabase: SupabaseClient, notaCreditoId: string): Promise<NotaCreditoRow | Response> {
  const { data: nc, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, facturapi_claim_at, serie, folio")
    .eq("id", notaCreditoId)
    .maybeSingle<NotaCreditoRow>();
  if (ncErr || !nc) return jsonResponse({ error: "nota_credito_not_found", detail: ncErr?.message }, 404);
  return nc;
}

export interface PromoverNcInput {
  supabase: SupabaseClient; nc: NotaCreditoRow; match: FapiInvoice; claimTag: string; user: UserIdentity; apiKey: string; ambiente: string;
}

/**
 * Adopta el CFDI tipo E que FacturAPI sí timbró con el `external_id` del
 * claim. Espejo de `promoverFactura` (misma guarda `.eq("facturapi_id",
 * claimTag)` con 409 claim_perdido) y de `persistTimbradoNc` de
 * facturapi-emitir-nota-credito (folio `<serie><folio>`, estado 'Timbrada',
 * respaldo XML best-effort en el bucket `facturas`, folder `notas-credito`).
 */
export async function promoverNc(input: PromoverNcInput): Promise<Response> {
  const { supabase, nc, match, claimTag, user, apiKey, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? nc.serie ?? "";
  const folioFinal = `${serieTimbrada}${folio}`;
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Respaldo best-effort (mismo helper del timbrado). Se omite sin apiKey
  // para mantener los tests de esta función herméticos (sin red).
  const respaldo: RespaldoResult = apiKey
    ? await respaldarXmlTimbrado({ supabase, apiKey, facturapiId, organizationId: nc.organization_id, uuid, folder: "notas-credito" })
    : { path: null, status: "skipped" };

  const { error: updErr, data: updRow } = await supabase
    .from("factura_notas_credito")
    .update({
      folio: folioFinal, facturapi_id: facturapiId, facturapi_claim_at: null,
      uuid_fiscal: uuid, folio_fiscal: folio, serie: serieTimbrada,
      pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup_path: respaldo.path,
      estado: "Timbrada", ambiente,
      timbrado_en: match.date ?? new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", nc.id)
    // Persistir sólo si seguimos poseyendo el claim — evita pisar el
    // facturapi_id si el usuario reintentó el timbrado en paralelo.
    .eq("facturapi_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_nc_claim_recuperado_promovido", entidadId: nc.id, entidadNombre: folioFinal,
    detalles: {
      facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el CFDI de la nota de crédito que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

/**
 * Libera el claim de una NC cuando FacturAPI NO tiene el CFDI. A diferencia
 * de facturas (RPC `liberar_claim_facturapi_huerfano`), aquí no se crea una
 * RPC/migración nueva: la edge ya verificó membresía y rol (`authorizeOrgRole`
 * + ROLES_EMISOR_FISCAL en index.ts) y corre con service role; el UPDATE
 * replica los mismos predicados (claimTag exacto + edad >= umbral), así una
 * carrera con un reintento del usuario no puede pisarlo. Nota: con
 * `facturapi_claim_at` NULL no se libera (igual que la RPC de facturas).
 */
export async function liberarClaimNc(
  supabase: SupabaseClient, nc: NotaCreditoRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const limite = new Date(Date.now() - MIN_EDAD_MINUTOS * 60_000).toISOString();
  const { data: liberado, error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({ facturapi_id: null, facturapi_claim_at: null })
    .eq("id", nc.id)
    .eq("facturapi_id", claimTag)
    .lt("facturapi_claim_at", limite)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "release_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_nc_claim_recuperado_liberado", entidadId: nc.id, entidadNombre: nc.folio ?? "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó la reserva de la nota de crédito para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}

