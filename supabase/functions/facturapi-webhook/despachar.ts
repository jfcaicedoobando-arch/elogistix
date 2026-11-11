import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { sanearPatchFactura } from "./facturaPatch.ts";
import { mapEventToFacturaPatch, mapEventToReceiptPatch, type FacturapiWebhookEvent, type MappedReceiptUpdate } from "./helpers.ts";
import { COLS_FACTURA, COLS_REP, externalIdDeEvento, localizarFila, patchAdopcionPendiente } from "./pendiente.ts";

interface VersionLocal {
  id: string;
  updated_at: string;
}

interface FacturaLocal extends VersionLocal {
  estado: string | null;
  sustituida_por: string | null;
  cancellation_status: string | null;
  uuid_fiscal: string | null;
  facturapi_id: string | null;
}

interface PagoLocal extends VersionLocal {
  estado_rep: string | null;
  rep_cancellation_status: string | null;
  facturapi_rep_id: string | null;
}

export type ResultadoWebhook =
  | {
    estado: "aplicar";
    tabla: "facturas" | "pagos_factura";
    id: string;
    version: string;
    claim: string | null;
    patch: Record<string, unknown>;
    accion: string;
  }
  | { estado: "ignorar"; motivo: "evento_sin_efecto" | "estado_ya_avanzado" | "timbrado_pendiente" }
  | { estado: "reintentar"; motivo: "factura_not_found" | "pago_not_found" };

async function prepararPago(
  supabase: SupabaseClient, orgId: string, event: FacturapiWebhookEvent, receipt: MappedReceiptUpdate,
): Promise<ResultadoWebhook> {
  const localizado = await localizarFila<PagoLocal>({
    supabase, tabla: "pagos_factura", orgId, cols: COLS_REP,
    select: "id, updated_at, estado_rep, rep_cancellation_status, facturapi_rep_id",
    remoteId: receipt.facturapi_rep_id, externalId: externalIdDeEvento(event),
  });
  if (!localizado) return { estado: "reintentar", motivo: "pago_not_found" };
  const pago = localizado.fila;

  const patch = { ...receipt.patch };
  if (pago.estado_rep === "Cancelado" && patch.estado_rep === "Timbrado") {
    delete patch.estado_rep;
    delete patch.timbrado_rep_en;
  }
  if (pago.rep_cancellation_status === "accepted" && patch.rep_cancellation_status !== "accepted") {
    delete patch.rep_cancellation_status;
  }
  if (Object.keys(patch).length === 0) return { estado: "ignorar", motivo: "estado_ya_avanzado" };

  if (localizado.via === "pendiente") {
    const adopcion = patchAdopcionPendiente(COLS_REP, receipt.facturapi_rep_id, patch);
    if (!adopcion) return { estado: "ignorar", motivo: "timbrado_pendiente" };
    Object.assign(patch, adopcion);
  }
  return {
    estado: "aplicar", tabla: "pagos_factura", id: pago.id, version: pago.updated_at,
    claim: localizado.claimActual, patch, accion: receipt.bitacora_accion,
  };
}

async function prepararFactura(
  supabase: SupabaseClient, orgId: string, event: FacturapiWebhookEvent,
): Promise<ResultadoWebhook> {
  const mapped = mapEventToFacturaPatch(event);
  if (!mapped) return { estado: "ignorar", motivo: "evento_sin_efecto" };
  const localizada = await localizarFila<FacturaLocal>({
    supabase, tabla: "facturas", orgId, cols: COLS_FACTURA,
    select: "id, updated_at, estado, sustituida_por, cancellation_status, facturapi_id, uuid_fiscal",
    remoteId: mapped.facturapi_id, externalId: externalIdDeEvento(event),
  });
  if (!localizada) return { estado: "reintentar", motivo: "factura_not_found" };
  const factura = localizada.fila;
  const patch = sanearPatchFactura(mapped, factura);

  if (localizada.via === "pendiente") {
    const adopcion = patchAdopcionPendiente(COLS_FACTURA, mapped.facturapi_id, patch);
    if (adopcion) Object.assign(patch, adopcion);
    else if (patch.cancellation_status !== "accepted") return { estado: "ignorar", motivo: "timbrado_pendiente" };
  }
  return {
    estado: "aplicar", tabla: "facturas", id: factura.id, version: factura.updated_at,
    claim: localizada.claimActual, patch, accion: mapped.bitacora_accion,
  };
}

/** Los avisos de cancelación de REP a veces llegan como `invoice.*`. */
export async function despacharEvento(
  supabase: SupabaseClient, orgId: string, event: FacturapiWebhookEvent,
): Promise<ResultadoWebhook> {
  const receipt = mapEventToReceiptPatch(event);
  if (receipt && event.type.startsWith("receipt.")) return prepararPago(supabase, orgId, event, receipt);
  const factura = await prepararFactura(supabase, orgId, event);
  if (!receipt || factura.estado !== "reintentar" || factura.motivo !== "factura_not_found") return factura;
  return prepararPago(supabase, orgId, event, receipt);
}
