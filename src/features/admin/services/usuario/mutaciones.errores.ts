/**
 * Lectura del motivo real de un error de la edge function `user-management`.
 *
 * `supabase.functions.invoke` colapsa cualquier respuesta no-2xx en el mensaje
 * genérico "Edge Function returned a non-2xx status code": el motivo real viaja
 * en el cuerpo (`FunctionsHttpError.context`). Sin esta lectura el usuario ve
 * "el servicio rechazó la solicitud, intenta más tarde" y reintenta en vano
 * cuando en realidad el correo capturado es inválido.
 */
import { FunctionsHttpError } from "@supabase/supabase-js";

/** Traducciones de mensajes del proveedor de identidad a español mexicano. */
const TRADUCCIONES: ReadonlyArray<{ patron: RegExp; mensaje: string }> = [
  {
    patron: /unable to validate email address|invalid email|email.*invalid format/i,
    mensaje: "El correo electrónico no tiene un formato válido. Revísalo y vuelve a intentarlo.",
  },
  {
    patron: /password.*(short|length|weak)/i,
    mensaje: "La contraseña no cumple con la política mínima de seguridad.",
  },
  {
    patron: /rate limit|too many requests/i,
    mensaje: "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  },
];

/** Aplica las traducciones conocidas; si no hay coincidencia devuelve el original. */
export function traducirMensajeEdge(mensaje: string): string {
  const encontrada = TRADUCCIONES.find((t) => t.patron.test(mensaje));
  return encontrada ? encontrada.mensaje : mensaje;
}

function extraerDeCuerpo(texto: string): string | null {
  try {
    const parsed = JSON.parse(texto) as { error?: unknown; message?: unknown };
    const valor = parsed.error ?? parsed.message;
    return typeof valor === "string" && valor.trim() ? valor.trim() : null;
  } catch {
    // Cuerpo no-JSON (HTML de gateway, texto plano): sólo sirve si es corto.
    const plano = texto.trim();
    return plano && plano.length <= 300 && !plano.startsWith("<") ? plano : null;
  }
}

/**
 * Convierte el error de `functions.invoke` en un `Error` con el motivo real.
 * `fallback` se usa sólo cuando no hay cuerpo legible (caída de red/gateway).
 */
export async function errorDeEdgeFunction(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const motivo = extraerDeCuerpo(await error.context.text());
      if (motivo) return new Error(traducirMensajeEdge(motivo));
    } catch {
      // Cuerpo ya consumido o ilegible: se cae al fallback.
    }
  }
  const mensaje = error instanceof Error ? error.message : "";
  const esGenerico = !mensaje || /non-2xx status code/i.test(mensaje);
  return new Error(esGenerico ? fallback : traducirMensajeEdge(mensaje));
}
