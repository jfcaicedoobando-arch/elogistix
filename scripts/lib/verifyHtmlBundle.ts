/**
 * Verifica que el `index.html` EMITIDO por la compilación actual contenga el
 * bundle JS. Antes se leía `dist/index.html` del filesystem en `closeBundle`:
 * el archivo podía no existir todavía (build limpio → error falso) o ser un
 * `dist` viejo (aprobación falsa). Ahora se inspecciona el `OutputBundle`, que
 * es exactamente lo que produjo ESTA compilación.
 */

/** Entrada mínima del OutputBundle de Rollup que necesitamos inspeccionar. */
export interface SalidaBundle {
  type?: string;
  fileName?: string;
  source?: unknown;
}

const RE_SCRIPT = /<script[^>]+src=["'][^"']*\/assets\/[^"']+\.js["'][^>]*>/i;
const RE_ROOT = /<div\s+id=["']root["']\s*>/i;

/**
 * Busca `index.html` en el bundle y valida `div#root` + script de `/assets/`.
 * Lanza `Error` si falta el archivo o el contenido no es publicable.
 */
export function verificarHtmlBundle(
  bundle: Record<string, SalidaBundle>,
): string {
  const entrada = Object.values(bundle).find(
    (s) => s.fileName === "index.html",
  );
  if (!entrada || typeof entrada.source !== "string") {
    throw new Error(
      "[verify-html-bundle] la compilación no emitió index.html. Build inválido.",
    );
  }
  const html = entrada.source;
  if (!RE_ROOT.test(html) || !RE_SCRIPT.test(html)) {
    throw new Error(
      "[verify-html-bundle] index.html no contiene <div id=root> o <script src=/assets/*.js>. Publicación abortada para evitar pantalla en blanco.",
    );
  }
  return html;
}
