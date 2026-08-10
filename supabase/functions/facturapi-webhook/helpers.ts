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
   * en BD ya está en `Sustituida` (o `sustituida_por IS NOT NULL`).
   */
  preserva_sustituida?: boolean;
}

interface EventCtx {
  facturapi_id: string;
  status: string | null;
  uuid: string | null;
  cancellationStatus: string | null;
}

function extractCtx(ev: FacturapiWebhookEvent): EventCtx | null {
  const obj = ev.data?.object;
  if (!obj || typeof obj.id !== "string") return null;
  return {
    facturapi_id: obj.id,
    status: typeof obj.status === "string" ? obj.status : null,
    uuid: typeof obj.uuid === "string" ? obj.uuid : null,
    cancellationStatus: typeof obj.cancellation_status === "string"
      ? obj.cancellation_status.toLowerCase()
      : null,
  };
}

function mapCancellationStatusUpdated(ctx: EventCtx): MappedUpdate | null {
  if (!ctx.cancellationStatus) return null;
  const patch: Record<string, unknown> = { cancellation_status: ctx.cancellationStatus };
  if (ctx.cancellationStatus === "rejected" || ctx.cancellationStatus === "expired") {
    patch.cancelacion_solicitada_en = null;
    patch.cancelacion_vence_en = null;
  }
  // Ola 4 · N18: si el SAT acepta la cancelación, el estado debe cerrarse aquí.
  // Antes dependíamos del evento `invoice.canceled`; si se perdía o llegaba
  // fuera de orden la factura quedaba 'Emitida' con cancellation_status
  // 'accepted' para siempre (y la reconciliación tampoco la reparaba).
  if (ctx.cancellationStatus === "accepted") {
    patch.estado = "Cancelada";
    patch.cancelado_en = new Date().toISOString();
  }
  return {
    facturapi_id: ctx.facturapi_id,
    patch,
    bitacora_accion: "facturapi_webhook_cancellation_status",
    preserva_sustituida: ctx.cancellationStatus === "accepted",
  };
}

function mapInvoiceStatusUpdated(ctx: EventCtx): MappedUpdate | null {
  const patch: Record<string, unknown> = {};
  if (ctx.uuid) patch.uuid_fiscal = ctx.uuid;
  if (ctx.status === "canceled") {
    patch.estado = "Cancelada";
    patch.cancelado_en = new Date().toISOString();
    patch.cancellation_status = "accepted";
  } else if (ctx.status === "valid") {
    // Ola 4 · N3: el enum estado_factura NO tiene 'Timbrada' — el UPDATE
    // fallaba con 22P02 en cada evento de timbrado (y con N2 el evento se
    // perdía para siempre). El valor correcto es 'Emitida', igual que el
    // timbrado local en facturapi-emitir/emitir.ts.
    patch.estado = "Emitida";
  }
  if (Object.keys(patch).length === 0) return null;
  return {
    facturapi_id: ctx.facturapi_id,
    patch,
    bitacora_accion: "facturapi_webhook_status",
    preserva_sustituida: ctx.status === "canceled",
  };
}

function mapInvoiceCanceled(ctx: EventCtx): MappedUpdate {
  return {
    facturapi_id: ctx.facturapi_id,
    patch: {
      estado: "Cancelada",
      cancelado_en: new Date().toISOString(),
      cancellation_status: "accepted",
    },
    bitacora_accion: "facturapi_webhook_canceled",
    preserva_sustituida: true,
  };
}

function mapInvoiceDelivered(ctx: EventCtx): MappedUpdate {
  return {
    facturapi_id: ctx.facturapi_id,
    patch: { enviada_cliente_at: new Date().toISOString() },
    bitacora_accion: "facturapi_webhook_delivered",
  };
}

/**
 * Convierte un evento de FacturApi en un patch parcial para `public.facturas`.
 * Devuelve `null` si el evento no requiere acción.
 */
export function mapEventToFacturaPatch(ev: FacturapiWebhookEvent): MappedUpdate | null {
  const ctx = extractCtx(ev);
  if (!ctx) return null;
  switch (ev.type) {
    case "invoice.cancellation_status_updated": return mapCancellationStatusUpdated(ctx);
    case "invoice.status_updated": return mapInvoiceStatusUpdated(ctx);
    case "invoice.canceled": return mapInvoiceCanceled(ctx);
    case "invoice.delivered_to_customer": return mapInvoiceDelivered(ctx);
    default: return null;
  }
}

/**
 * Mapper de eventos `receipt.*` (REP / Complemento de Pagos) hacia
 * `public.pagos_factura`. Devuelve el `facturapi_rep_id` para hacer match.
 */
export interface MappedReceiptUpdate {
  facturapi_rep_id: string;
  patch: Record<string, unknown>;
  bitacora_accion: string;
}

export function mapEventToReceiptPatch(ev: FacturapiWebhookEvent): MappedReceiptUpdate | null {
  const obj = ev.data?.object;
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

/**
 * FIX-22 · Clave estable de idempotencia por evento. FacturAPI a veces omite
 * `event.id` en payloads antiguos; en ese caso derivamos SHA-256 del body para
 * seguir bloqueando retransmisiones exactas. La clave se prefija con `sha256:`
 * cuando es fallback para poder auditarlo desde la BD.
 */
export async function computeEventKey(rawBody: string, event: FacturapiWebhookEvent): Promise<string> {
  const id = (event as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
  return "sha256:" + Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
