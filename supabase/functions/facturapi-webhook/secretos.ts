/**
 * P2-A · Resolución de secretos del webhook POR AMBIENTE y validación de firma.
 *
 * AISLAMIENTO (corrección P2): el runtime acepta un solo secret — el del
 * ambiente pedido. El endpoint sólo recibe `?org=`, así que el ambiente se
 * decide por el ambiente activo de la credencial o por el parámetro aislado
 * `&amb=sandbox|live` de la URL registrada en el proveedor (única vía de
 * transición soportada). Nunca se prueba el ambiente opuesto.
 *
 * El secret legado indistinto sólo se acepta si la organización no tiene NINGÚN
 * secret por ambiente y `FACTURAPI_WEBHOOK_LEGACY_HASTA` (ISO) sigue vigente.
 */
import { computeSignatureBytes, safeEqual, type FacturapiWebhookEvent } from "./helpers.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  resolverSecretosWebhook,
  type CredencialWebhookRow,
  type FacturapiAmbiente,
  type SecretoWebhook,
} from "../_shared/facturapiWebhookConfig.ts";

export { COLS_WEBHOOK_CRED } from "../_shared/facturapiWebhookConfig.ts";

/** Lee `&amb=` de la URL del webhook. Cualquier otro valor es inválido. */
export function ambienteDeUrl(url: URL): FacturapiAmbiente | null | "invalido" {
  const amb = url.searchParams.get("amb");
  if (amb === null || amb === "") return null;
  return amb === "sandbox" || amb === "live" ? amb : "invalido";
}

export function secretosDeCredencial(
  cred: unknown,
  ambienteSolicitado: FacturapiAmbiente | null = null,
): SecretoWebhook[] {
  return resolverSecretosWebhook(cred as CredencialWebhookRow | null, {
    ambienteSolicitado,
    legacyHasta: Deno.env.get("FACTURAPI_WEBHOOK_LEGACY_HASTA") ?? null,
  });
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
