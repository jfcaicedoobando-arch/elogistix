/**
 * Extracts a human-readable error message from an unknown caught value.
 * Traduce códigos conocidos de Postgres/RPC (`LC_*`, otros literales) a
 * mensajes amigables para el usuario final. Ver `lcCodes.ts` para el
 * catálogo central de códigos LC (Arquitectura Bloque 2 · Item 2.1).
 */
import { translateLcCode, stripLcCode } from "./lcCodes";
import { translatePostgresError } from "./pgErrorCodes";
import { traducirMensajeSat } from "./facturapiError";

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

/** Normaliza cualquier valor capturado a `{ raw, pgCode }`. */
function leerCrudo(err: unknown): { raw: string; pgCode: string | null } {
  const fallback = "Error desconocido";
  if (err instanceof Error) return { raw: err.message || fallback, pgCode: null };
  if (typeof err === "string") return { raw: err, pgCode: null };
  if (!err || typeof err !== "object") return { raw: fallback, pgCode: null };
  // PostgrestError u objetos similares (Supabase RPC, etc.) que NO heredan de Error
  const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const pgCode = typeof e.code === "string" && e.code.length > 0 ? e.code : null;
  const parts = [e.message, e.details, e.hint].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (parts.length > 0) return { raw: parts.join(" — "), pgCode };
  return { raw: pgCode ? `Código ${pgCode}` : fallback, pgCode };
}

export function getErrorMessage(err: unknown): string {
  const { raw, pgCode } = leerCrudo(err);

  // 1) Traducciones legacy con regex (factura_inmutable, etc.)
  for (const { match, message } of FRIENDLY_ERROR_MESSAGES) {
    if (match.test(raw)) return message;
  }
  // 2) Errores crudos de Postgres (RLS, FK, unicidad, check) — Q-15.3: el
  //    texto técnico (código/tabla/detalle) sólo debe quedar en consola o en
  //    "Ver detalles", nunca en el título del toast.
  const pg = translatePostgresError(raw, pgCode);
  if (pg) return pg;
  // 2.5) Rechazos del SAT / FacturApi (301, 402, CFDI40147, …). Va antes del
  //      catálogo LC y del fallback genérico de Edge Functions.
  const sat = traducirMensajeSat(raw);
  if (sat) return sat;
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
