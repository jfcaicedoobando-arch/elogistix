/**
 * Utilidades de error para el módulo FacturApi.
 * Extraído de `facturapi.ts` (Power-of-10, ≤200 líneas).
 */

export interface ValidationIssue { field: string; message: string }

export interface EdgeErrorBody {
  error?: string;
  message?: string;
  issues?: ValidationIssue[];
  transient?: boolean;
}

/** Error enriquecido: expone si el fallo es transitorio (reintentable)
 *  y si es una validación de negocio esperada (dato mal capturado por el
 *  usuario, no bug — ver `EXPECTED_FACTURAPI_PATTERNS`). */
export class FacturapiError extends Error {
  transient: boolean;
  expected: boolean;
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
];

function isExpectedFacturapiMessage(message: string): boolean {
  return EXPECTED_FACTURAPI_PATTERNS.some((rx) => rx.test(message));
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
  return new FacturapiError(
    finalMessage,
    !!body.transient,
    isExpectedFacturapiMessage(finalMessage),
  );
}
