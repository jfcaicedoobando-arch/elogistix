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

export interface NotasPartes {
  /** Primer trozo, indivisible junto al título. */
  head: string;
  /** Resto del texto; vacío si todo cupo en `head`. */
  rest: string;
}

export function splitNotas(notas: string): NotasPartes {
  const texto = notas.trim();
  if (texto.length <= MAX_HEAD) return { head: texto, rest: "" };

  const ventana = texto.slice(0, MAX_HEAD);
  const salto = ventana.lastIndexOf("\n");
  const espacio = ventana.lastIndexOf(" ");
  const corte = salto > 40 ? salto : espacio > 40 ? espacio : MAX_HEAD;

  return {
    head: texto.slice(0, corte).trimEnd(),
    rest: texto.slice(corte).trimStart(),
  };
}
