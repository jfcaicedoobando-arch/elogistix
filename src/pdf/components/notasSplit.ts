/**
 * R188-PDF-01: divide el texto de notas en un primer trozo corto (que viaja
 * pegado al título "Notas") y el resto, que puede fluir en varias páginas.
 *
 * Motivo: el motor de paginación calcula la "presencia" de un título como
 * `min(fin + minPresenceAhead, fin del siguiente hermano)`. Cuando la caja de
 * notas es más alta que el espacio restante, ese mínimo se satisface con el
 * propio título y la caja se parte dejando cero líneas visibles en la página
 * anterior: el título queda solo. La solución es que el título y las primeras
 * líneas formen un bloque indivisible pequeño.
 */

/** Largo máximo del trozo que se mantiene junto al título (≈2-3 líneas). */
const MAX_HEAD = 180;
/** Máximo de renglones del trozo que viaja junto al título. */
const MAX_HEAD_LINEAS = 3;

export interface NotasPartes {
  /** Primer trozo, indivisible junto al título. */
  head: string;
  /** Resto del texto; vacío si todo cupo en `head`. */
  rest: string;
}

/**
 * Índice donde empieza el salto de línea número `MAX_HEAD_LINEAS` (LF, CRLF o
 * CR sueltos). Si el texto tiene menos renglones, devuelve su longitud.
 */
function limitePorLineas(texto: string): number {
  let saltos = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c !== "\n" && c !== "\r") continue;
    saltos += 1;
    if (saltos >= MAX_HEAD_LINEAS) return i;
    if (c === "\r" && texto[i + 1] === "\n") i += 1;
  }
  return texto.length;
}

/** Evita cortar en medio de un par surrogate (emoji, etc.). */
function ajustarUnicode(texto: string, corte: number): number {
  if (corte <= 0 || corte >= texto.length) return corte;
  const anterior = texto.charCodeAt(corte - 1);
  const esAltoSurrogate = anterior >= 0xd800 && anterior <= 0xdbff;
  return esAltoSurrogate ? corte - 1 : corte;
}

export function splitNotas(notas: string): NotasPartes {
  const texto = notas.trim();
  const limite = Math.min(MAX_HEAD, limitePorLineas(texto));
  if (texto.length <= limite) return { head: texto, rest: "" };

  const ventana = texto.slice(0, limite);
  const salto = ventana.lastIndexOf("\n");
  const espacio = ventana.lastIndexOf(" ");
  const corte = ajustarUnicode(texto, salto > 40 ? salto : espacio > 40 ? espacio : limite);

  return {
    head: texto.slice(0, corte).trimEnd(),
    rest: texto.slice(corte).trimStart(),
  };
}

