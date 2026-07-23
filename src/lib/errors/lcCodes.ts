/**
 * Traductor de códigos `LC_*` (RAISE EXCEPTION 'LC_XXX ...') a mensajes
 * amigables en es-MX. El catálogo vive en `lcCodeMessages.ts` para respetar
 * el límite Power-of-10 de 200 líneas por archivo.
 *
 * Arquitectura Bloque 2 · Item 2.1
 */
import { LC_CODE_MESSAGES } from "./lcCodeMessages";

export { LC_CODE_MESSAGES };

const LC_REGEX = /LC_[A-Z0-9_]+/g;

/**
 * Devuelve el mensaje amigable asociado al primer código `LC_*` presente en
 * `raw`. Si no hay match en el catálogo, devuelve `null` para que la capa
 * superior use el mensaje original.
 */
export function translateLcCode(raw: string): string | null {
  const matches = raw.match(LC_REGEX);
  if (!matches) return null;
  for (const code of matches) {
    const friendly = LC_CODE_MESSAGES[code];
    if (friendly) return friendly;
  }
  return null;
}

/**
 * Quita los tokens `LC_*` del mensaje para dejar sólo el texto legible en
 * casos donde no tenemos traducción explícita pero sí un mensaje humano
 * adjunto en el RAISE (ej. `LC_CXP_DESCUADRE: total no cuadra`).
 */
export function stripLcCode(raw: string): string {
  return raw.replace(LC_REGEX, "").replace(/^[\s:—-]+/, "").trim();
}
