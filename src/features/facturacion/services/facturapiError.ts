/**
 * Utilidades de error para el módulo FacturApi.
 * Extraído de `facturapi.ts` (Power-of-10, ≤200 líneas).
 */

import { interpretarErrorFacturapi } from "@/lib/errors/facturapiError";

export interface ValidationIssue { field: string; message: string }

export interface EdgeErrorBody {
  error?: string;
  message?: string;
  issues?: ValidationIssue[];
  transient?: boolean;
  /** Body estructurado de FacturApi/SAT (`describeFacturapiError` en backend). */
  detail?: { code?: string; message?: string; path?: string; logId?: string; errors?: unknown };
  status?: number;
}

/** Error enriquecido: expone si el fallo es transitorio (reintentable)
 *  y si es una validación de negocio esperada (dato mal capturado por el
 *  usuario, no bug — ver `EXPECTED_FACTURAPI_PATTERNS`). */
export class FacturapiError extends Error {
  transient: boolean;
  expected: boolean;
  /** Código SAT/FacturApi reconocido (301, 402, …) para "Ver detalles". */
  codigoSat?: string | null;
  /** Detalles técnicos copiables para soporte administrativo. */
  detallesSat?: Record<string, unknown>;
  constructor(message: string, transient = false, expected = false) {
    super(message);
    this.name = "FacturapiError";
    this.transient = transient;
    this.expected = expected;
  }
}

/**
 * Whitelist de mensajes que FacturApi/SAT devuelven cuando el dato del
 * cliente es incorrecto. NO son bugs — son validaciones que el usuario
 * debe corregir en su catálogo (razón social, RFC, régimen fiscal). Se
 * excluyen de Sentry para no generar ruido. Ref audit Sentry 2T (13.301.59).
 */
const EXPECTED_FACTURAPI_PATTERNS: RegExp[] = [
  /nombre del receptor.*pertenece.*rfc/i,
  /rfc del receptor.*no.*registrado.*sat/i,
  /r[eé]gimen fiscal.*no.*v[aá]lido/i,
  /c[oó]digo postal.*no.*coincide/i,
  /uso de cfdi.*no.*v[aá]lido/i,
  // JAVASCRIPT-REACT-5A: el CFDI ya tiene un trámite de cancelación abierto en
  // el SAT. La UI lo explica y ofrece "Actualizar estado": no es un bug.
  /solicitud de cancelaci[oó]n pendiente/i,
];

function isExpectedFacturapiMessage(message: string): boolean {
  return EXPECTED_FACTURAPI_PATTERNS.some((rx) => rx.test(message));
}

/**
 * JAVASCRIPT-REACT-5D: `validation_failed` es el pre-flight de nuestras propias
 * edge functions de timbrado (RFC, código postal, saldo del documento). Siempre
 * es un dato que el usuario debe corregir, nunca un bug de código, así que se
 * marca como esperado en bloque y se excluye de Sentry.
 */
function isExpectedValidationBody(body: EdgeErrorBody): boolean {
  return body.error === "validation_failed";
}


/**
 * `supabase.functions.invoke()` levanta `FunctionsHttpError` en cualquier
 * status ≠ 2xx y NO expone el JSON del body en `data` — sólo deja
 * `error.message = "Edge Function returned a non-2xx status code"` y el
 * cuerpo real en `error.context` (una `Response`). Esta función lo lee para
 * que el usuario vea el mensaje amable del backend (ej. "Esta organización
 * no tiene FacturApi configurado…") en lugar de la cadena genérica.
 */
export async function parseFunctionError(error: unknown): Promise<EdgeErrorBody> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === "object") return body as EdgeErrorBody;
    } catch {
      // Body no era JSON parseable; caemos al fallback.
    }
  }
  return {};
}

export function toReadableError(
  error: unknown,
  body: EdgeErrorBody,
  fallback: string,
): Error {
  const issues = body.issues?.length
    ? `: ${body.issues.map((i) => i.message).join("; ")}`
    : "";
  const message = body.message
    ?? body.error
    ?? (error as { message?: string } | null)?.message
    ?? fallback;
  const finalMessage = message + issues;
  // Ola 17 · si el backend mandó un rechazo estructurado del SAT/FacturApi,
  // preferimos el mensaje de negocio traducido (ej. 402 → "RFC no inscrito en
  // el padrón del SAT") y guardamos los datos técnicos para "Ver detalles".
  const sat = interpretarErrorFacturapi(body);
  const usarSat = sat?.codigo != null;
  const err = new FacturapiError(
    usarSat ? `${sat!.titulo}. ${sat!.descripcion}` : finalMessage,
    !!body.transient,
    isExpectedFacturapiMessage(finalMessage),
  );
  if (sat) {
    err.codigoSat = sat.codigo;
    err.detallesSat = sat.detalles;
  }
  return err;
}
