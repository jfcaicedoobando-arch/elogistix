/**
 * Helpers puros para `facturapi-webhook`. Sin I/O, 100% testeables.
 *
 * FacturApi envía eventos con la forma:
 *   { type: "invoice.status_updated", data: { object: { id, status, uuid, ... } } }
 *
 * Firma: header `facturapi-signature` = HMAC-SHA256(raw_body, webhook_secret) hex.
 */

export type FacturapiEventType =
  | "invoice.status_updated"
  | "invoice.cancellation_status_updated"
  | "invoice.canceled"
  | "invoice.delivered_to_customer"
  | "invoice.created"
  | "receipt.status_updated"
  | "receipt.canceled"
  | "receipt.created";

export interface FacturapiWebhookEvent {
  type: string;
  data?: { object?: Record<string, unknown> };
}

export interface MappedUpdate {
  facturapi_id: string;
  patch: Record<string, unknown>;
  bitacora_accion: string;
  /**
   * Si es true, el llamador debe NO sobrescribir `estado` cuando la factura
   * en BD ya está en `Sustituida` (o `sustituida_por IS NOT NULL`). El patch
   * incluye `estado` calculado como "Cancelada" por default, pero para
   * sustituciones el estado correcto es "Sustituida" y lo fija el cron
   * `facturapi-reconciliar-cancelaciones` al descargar el acuse.
   */
  preserva_sustituida?: boolean;
}

/**
 * Convierte un evento de FacturApi en un patch parcial para `public.facturas`.
 * Devuelve `null` si el evento no requiere acción.
 */
export function mapEventToFacturaPatch(ev: FacturapiWebhookEvent): MappedUpdate | null {
  const obj = ev.data?.object as Record<string, unknown> | undefined;
  if (!obj || typeof obj.id !== "string") return null;
  const facturapi_id = obj.id;
  const status = typeof obj.status === "string" ? obj.status : null;
  const uuid = typeof obj.uuid === "string" ? obj.uuid : null;
  const cancellationStatus = typeof obj.cancellation_status === "string"
    ? obj.cancellation_status.toLowerCase()
    : null;

  switch (ev.type) {
    case "invoice.cancellation_status_updated": {
      // Evento crítico: el SAT resolvió (o avanzó) la solicitud asíncrona.
      // No cambiamos `estado` aquí — lo hace el cron/reconciliar cuando
      // pasa a `accepted`, porque necesita descargar el acuse y revertir
      // proformas. El webhook sólo refleja el estado en la BD.
      if (!cancellationStatus) return null;
      const patch: Record<string, unknown> = { cancellation_status: cancellationStatus };
      if (cancellationStatus === "rejected" || cancellationStatus === "expired") {
        patch.cancelacion_solicitada_en = null;
        patch.cancelacion_vence_en = null;
      }
      return { facturapi_id, patch, bitacora_accion: "facturapi_webhook_cancellation_status" };
    }
    case "invoice.status_updated": {
      const patch: Record<string, unknown> = {};
      if (uuid) patch.uuid_fiscal = uuid;
      if (status === "canceled") {
        patch.estado = "Cancelada";
        patch.cancelado_en = new Date().toISOString();
        patch.cancellation_status = "accepted";
      } else if (status === "valid") {
        patch.estado = "Timbrada";
      }
      if (Object.keys(patch).length === 0) return null;
      return { facturapi_id, patch, bitacora_accion: "facturapi_webhook_status" };
    }
    case "invoice.canceled":
      return {
        facturapi_id,
        patch: {
          estado: "Cancelada",
          cancelado_en: new Date().toISOString(),
          cancellation_status: "accepted",
        },
        bitacora_accion: "facturapi_webhook_canceled",
      };
    case "invoice.delivered_to_customer":
      return {
        facturapi_id,
        patch: { enviada_cliente_at: new Date().toISOString() },
        bitacora_accion: "facturapi_webhook_delivered",
      };
    default:
      return null;
  }
}

/**
 * Mapper de eventos `receipt.*` (REP / Complemento de Pagos) hacia
 * `public.pagos_factura`. Devuelve el `facturapi_rep_id` para hacer match.
 *
 * FacturApi nombra al objeto REP `receipt`; los eventos siguen la misma
 * forma que invoice (`type`, `data.object`).
 */
export interface MappedReceiptUpdate {
  facturapi_rep_id: string;
  patch: Record<string, unknown>;
  bitacora_accion: string;
}

export function mapEventToReceiptPatch(ev: FacturapiWebhookEvent): MappedReceiptUpdate | null {
  const obj = ev.data?.object as Record<string, unknown> | undefined;
  if (!obj || typeof obj.id !== "string") return null;
  const facturapi_rep_id = obj.id;
  const status = typeof obj.status === "string" ? obj.status : null;
  const uuid = typeof obj.uuid === "string" ? obj.uuid : null;

  switch (ev.type) {
    case "receipt.status_updated": {
      const patch: Record<string, unknown> = {};
      if (uuid) patch.uuid_rep = uuid;
      if (status === "canceled") {
        patch.estado_rep = "Cancelado";
        patch.rep_cancelado_en = new Date().toISOString();
      } else if (status === "valid") {
        patch.estado_rep = "Timbrado";
        patch.timbrado_rep_en = new Date().toISOString();
      }
      if (Object.keys(patch).length === 0) return null;
      return { facturapi_rep_id, patch, bitacora_accion: "facturapi_webhook_rep_status" };
    }
    case "receipt.canceled":
      return {
        facturapi_rep_id,
        patch: { estado_rep: "Cancelado", rep_cancelado_en: new Date().toISOString() },
        bitacora_accion: "facturapi_webhook_rep_canceled",
      };
    case "receipt.created":
      return {
        facturapi_rep_id,
        patch: uuid ? { uuid_rep: uuid, estado_rep: "Timbrado", timbrado_rep_en: new Date().toISOString() } : { estado_rep: "Timbrado" },
        bitacora_accion: "facturapi_webhook_rep_created",
      };
    default:
      return null;
  }
}

/** HMAC-SHA256 hex del body con el secret. Usa Web Crypto (disponible en Deno). */
export async function computeSignature(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparación constante en tiempo para evitar timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
