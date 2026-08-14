/**
 * Ola 13 · R4EF-01/R4EF-02 — Catálogo LC_* de mensajes seguros para el cliente.
 *
 * Los mensajes crudos de GoTrue y de Postgres (que pueden incluir nombres de
 * constraint y detalle de esquema) ya NO se devuelven al cliente: el frontend
 * los muestra tal cual, así que el mapeo a mensajes seguros se hace
 * server-side. El detalle crudo se conserva en `log.finish(..., payload.error)`.
 */

/**
 * R4EF-02 — Respuesta ÚNICA para correo duplicado (409): no hace eco del correo
 * ni confirma si la cuenta existe. El correo queda en el log estructurado.
 */
export const MENSAJE_CORREO_NO_DISPONIBLE =
  "LC_USUARIO_CORREO_NO_DISPONIBLE: No se pudo completar la operación con ese correo. " +
  "Si la cuenta ya existe, edítala desde la lista o envía un restablecimiento de contraseña.";

const CATALOGO: ReadonlyArray<{ patron: RegExp; codigo: string; mensaje: string }> = [
  {
    patron: /unable to validate email|invalid email|email.*(invalid|format)/i,
    codigo: "LC_USUARIO_EMAIL_INVALIDO",
    mensaje: "El correo electrónico no tiene un formato válido. Revísalo y vuelve a intentarlo.",
  },
  {
    patron: /password.*(short|length|weak|at least)/i,
    codigo: "LC_USUARIO_PASSWORD_RECHAZADA",
    mensaje: "La contraseña no cumple la política mínima de seguridad.",
  },
  {
    patron: /rate.?limit|too many requests/i,
    codigo: "LC_USUARIO_DEMASIADOS_INTENTOS",
    mensaje: "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  },
  {
    // Errores de Postgres: constraint de unicidad/llave foránea, etc.
    patron: /duplicate key|unique constraint|violates.*constraint|foreign key/i,
    codigo: "LC_USUARIO_CONFLICTO_REGISTRO",
    mensaje:
      "La operación entra en conflicto con un registro existente. Recarga la lista e intenta de nuevo.",
  },
];

/** Nunca se propaga el texto crudo: lo no catalogado cae en el genérico. */
const MENSAJE_GENERICO =
  "LC_USUARIO_ERROR_INTERNO: No se pudo completar la operación. Intenta de nuevo; si persiste, contacta a soporte.";

/**
 * Traduce el mensaje crudo del backend (GoTrue/Postgres) a un mensaje seguro
 * del catálogo LC_*. Cualquier texto no reconocido devuelve `fallback` (o el
 * genérico).
 */
export function mensajeSeguro(crudo: string | null | undefined, fallback?: string): string {
  const msg = (crudo ?? "").trim();
  if (!msg) return fallback ?? MENSAJE_GENERICO;
  const hit = CATALOGO.find((c) => c.patron.test(msg));
  if (hit) return `${hit.codigo}: ${hit.mensaje}`;
  return fallback ?? MENSAJE_GENERICO;
}

/** true si el mensaje del proveedor de identidad indica correo ya registrado. */
export function esCorreoDuplicado(crudo: string | null | undefined): boolean {
  return /already|registered|exists|duplicate/i.test(crudo ?? "");
}
