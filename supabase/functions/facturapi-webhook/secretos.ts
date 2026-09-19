/**
 * P2-A · Resolución de secretos del webhook POR AMBIENTE y validación de firma.
 *
 * Extraído de `index.ts` (que ya roza el tope de líneas). La firma se prueba
 * contra el secret del ambiente activo, luego el del opuesto (organización en
 * transición sandbox → live) y sólo al final el legado indistinto.
 */
import { computeSignatureBytes, safeEqual, type FacturapiWebhookEvent } from "./helpers.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  resolverSecretosWebhook,
  type CredencialWebhookRow,
  type SecretoWebhook,
} from "../_shared/facturapiWebhookConfig.ts";

export { COLS_WEBHOOK_CRED } from "../_shared/facturapiWebhookConfig.ts";

export function secretosDeCredencial(cred: unknown): SecretoWebhook[] {
  return resolverSecretosWebhook(cred as CredencialWebhookRow | null);
}

export interface EventoValidado {
  event: FacturapiWebhookEvent;
  /** Ambiente del secret que validó la firma, o "legacy". */
  origen: SecretoWebhook["origen"];
}

/**
 * Verifica la firma sobre los BYTES exactos aceptados y parsea el evento.
 * Devuelve `Response` en caso de rechazo (401/400).
 */
export async function validarEvento(
  bytes: Uint8Array,
  rawBody: string,
  signature: string,
  secretos: SecretoWebhook[],
): Promise<EventoValidado | Response> {
  let origen: SecretoWebhook["origen"] | null = null;
  for (const candidato of secretos) {
    const expected = await computeSignatureBytes(bytes, candidato.secret);
    if (signature && safeEqual(signature, expected)) {
      origen = candidato.origen;
      break;
    }
  }
  if (!origen) return jsonResponse({ error: "invalid_signature" }, 401);
  try {
    return { event: JSON.parse(rawBody) as FacturapiWebhookEvent, origen };
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
}
