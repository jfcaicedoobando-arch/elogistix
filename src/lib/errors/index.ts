/**
 * Extracts a human-readable error message from an unknown caught value.
 * Traduce códigos conocidos de Postgres/RPC (`LC_*`, otros literales) a
 * mensajes amigables para el usuario final. Ver `lcCodes.ts` para el
 * catálogo central de códigos LC (Arquitectura Bloque 2 · Item 2.1).
 */
import { translateLcCode, stripLcCode } from "./lcCodes";
import { translatePostgresError } from "./pgErrorCodes";

export { translateLcCode, stripLcCode } from "./lcCodes";

const FRIENDLY_ERROR_MESSAGES: Array<{ match: RegExp; message: string }> = [
  {
    match: /factura_inmutable/i,
    message:
      "Esta factura ya fue emitida y no puede modificarse. Para corregirla, emite una nota de crédito.",
  },
  {
    match: /FACTURA_LIQUIDADA_SIN_NC/i,
    message:
      "La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.",
  },
  {
    match: /contenedor_iso6346/i,
    message:
      "Número de contenedor inválido. Formato ISO 6346: 4 letras + 7 dígitos (ej. MSCU1234567). Déjalo vacío si aún no lo asignan.",
  },
  // B-043: errores del SDK de Supabase Functions (timbrado CFDI/REP y demás
  // edge functions) traducidos a mensajes de negocio es-MX.
  {
    match: /failed to send a request to the edge function/i,
    message:
      "No pudimos contactar el servicio en la nube (Edge Function). Revisa tu conexión e intenta de nuevo; si el problema persiste, contacta a soporte.",
  },
  {
    match: /edge function returned a non-2xx status code/i,
    message:
      "El servicio en la nube rechazó la solicitud. Intenta de nuevo en unos minutos; si el problema persiste, contacta a soporte.",
  },
];

export function getErrorMessage(err: unknown): string {
  let raw = "Error desconocido";
  let pgCode: string | null = null;
  if (err instanceof Error) {
    raw = err.message || raw;
  } else if (typeof err === "string") {
    raw = err;
  } else if (err && typeof err === "object") {
    // PostgrestError u objetos similares (Supabase RPC, etc.) que NO heredan de Error
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    if (typeof e.code === "string" && e.code.length > 0) pgCode = e.code;
    const parts = [e.message, e.details, e.hint].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (parts.length > 0) raw = parts.join(" — ");
    else if (pgCode) raw = `Código ${pgCode}`;
  }
  // 1) Traducciones legacy con regex (factura_inmutable, etc.)
  for (const { match, message } of FRIENDLY_ERROR_MESSAGES) {
    if (match.test(raw)) return message;
  }
  // 2) Errores crudos de Postgres (RLS, FK, unicidad, check) — Q-15.3: el
  //    texto técnico (código/tabla/detalle) sólo debe quedar en consola o en
  //    "Ver detalles", nunca en el título del toast.
  const pg = translatePostgresError(raw, pgCode);
  if (pg) return pg;
  // 3) Catálogo central LC_*
  const lc = translateLcCode(raw);
  if (lc) return lc;
  // 4) Si el mensaje trae un LC_* sin traducción pero con texto humano
  //    adjunto, lo devolvemos limpio.
  if (/LC_[A-Z0-9_]+/.test(raw)) {
    const stripped = stripLcCode(raw);
    if (stripped.length > 0) return stripped;
  }
  return raw;
}
