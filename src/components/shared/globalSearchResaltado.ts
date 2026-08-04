/**
 * Resaltado de coincidencias del buscador global. Lógica pura y testeable:
 * divide un texto en segmentos marcando los tramos que coinciden con los
 * términos escritos por el usuario (BL/guía, expediente, cliente, RFC…).
 */

/** Segmento de texto con la marca de si coincide con la búsqueda. */
export interface SegmentoResaltado {
  texto: string;
  coincide: boolean;
}

/** Escapa los caracteres especiales para usar el término dentro de un RegExp. */
function escaparRegex(termino: string): string {
  return termino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normaliza la consulta a términos útiles: sin acentos, sin duplicados y sin
 * fragmentos vacíos. Se conservan términos de 1 carácter sólo si son dígitos
 * (folios cortos como "7"), para no resaltar letras sueltas por todas partes.
 */
export function terminosBusqueda(query: string): string[] {
  const limpios = (query ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 || /^\d$/.test(t));
  return [...new Set(limpios)];
}

/** Quita acentos para comparar sin perder las posiciones del texto original. */
function plano(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Divide `texto` en segmentos alternando coincidencias y relleno.
 * Si no hay términos o no hay coincidencias, devuelve un único segmento.
 */
export function resaltarCoincidencias(texto: string, query: string): SegmentoResaltado[] {
  const base = texto ?? "";
  const terminos = terminosBusqueda(query);
  if (base.length === 0 || terminos.length === 0) {
    return [{ texto: base, coincide: false }];
  }

  // NFD puede cambiar la longitud; sólo se usa como índice cuando coincide 1:1.
  const comparable = plano(base);
  if (comparable.length !== base.length) {
    return [{ texto: base, coincide: false }];
  }

  const patron = new RegExp(terminos.map(escaparRegex).join("|"), "g");
  const segmentos: SegmentoResaltado[] = [];
  let cursor = 0;
  for (const hit of comparable.matchAll(patron)) {
    const inicio = hit.index ?? 0;
    if (inicio > cursor) {
      segmentos.push({ texto: base.slice(cursor, inicio), coincide: false });
    }
    const fin = inicio + hit[0].length;
    segmentos.push({ texto: base.slice(inicio, fin), coincide: true });
    cursor = fin;
  }
  if (cursor < base.length) {
    segmentos.push({ texto: base.slice(cursor), coincide: false });
  }
  return segmentos.length > 0 ? segmentos : [{ texto: base, coincide: false }];
}
