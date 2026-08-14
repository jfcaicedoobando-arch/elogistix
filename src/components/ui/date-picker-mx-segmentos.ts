/**
 * Modelo puro de segmentos (`## / ## / ####`) para los pickers MX.
 *
 * Sirve para: saber en qué segmento está el cursor, seleccionarlo completo y
 * sumar/restar sobre el segmento activo con acarreo correcto (bisiestos y
 * meses cortos incluidos).
 */

export type SegmentoTipo = "dia" | "mes" | "anio" | "hora" | "minuto";

export interface PatronSegmento {
  tipo: SegmentoTipo;
  /** Posición del primer carácter del segmento dentro del texto formateado. */
  inicio: number;
  largo: number;
}

/** `DD/MM/AAAA` */
export const PATRON_FECHA: readonly PatronSegmento[] = [
  { tipo: "dia", inicio: 0, largo: 2 },
  { tipo: "mes", inicio: 3, largo: 2 },
  { tipo: "anio", inicio: 6, largo: 4 },
];

/** `MM/AAAA` */
export const PATRON_PERIODO: readonly PatronSegmento[] = [
  { tipo: "mes", inicio: 0, largo: 2 },
  { tipo: "anio", inicio: 3, largo: 4 },
];

/** `DD/MM/AAAA HH:MM` */
export const PATRON_FECHA_HORA: readonly PatronSegmento[] = [
  ...PATRON_FECHA,
  { tipo: "hora", inicio: 11, largo: 2 },
  { tipo: "minuto", inicio: 14, largo: 2 },
];

/** Índice del segmento donde cae el cursor (nunca fuera de rango). */
export function indiceSegmento(patron: readonly PatronSegmento[], pos: number): number {
  for (let i = patron.length - 1; i >= 0; i -= 1) {
    if (pos >= patron[i].inicio) return i;
  }
  return 0;
}

export function rangoSegmento(
  patron: readonly PatronSegmento[],
  indice: number,
): { inicio: number; fin: number } {
  const i = Math.min(Math.max(indice, 0), patron.length - 1);
  const seg = patron[i];
  return { inicio: seg.inicio, fin: seg.inicio + seg.largo };
}

/** Selecciona el segmento completo dentro del input (el próximo dígito lo sobrescribe). */
export function seleccionarSegmento(
  input: HTMLInputElement | null,
  patron: readonly PatronSegmento[],
  indice: number,
): void {
  if (!input) return;
  const { inicio, fin } = rangoSegmento(patron, indice);
  const limite = input.value.length;
  input.setSelectionRange(Math.min(inicio, limite), Math.min(fin, limite));
}

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return DIAS_MES[mes - 1] ?? 31;
}

function armar(anio: number, mes: number, dia: number): string {
  const d = Math.min(dia, diasDelMes(anio, mes));
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Suma `delta` unidades al segmento indicado de una fecha ISO.
 *  - `dia`: aritmética real de días (31/01 + 1 = 01/02).
 *  - `mes` / `anio`: recorta el día al último del mes destino (31/03 - 1 mes = 28/02 o 29/02).
 */
export function ajustarFechaIso(iso: string, tipo: SegmentoTipo, delta: number): string {
  const head = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return iso;
  const [anio, mes, dia] = head.split("-").map(Number);

  if (tipo === "dia") {
    const d = new Date(Date.UTC(anio, mes - 1, dia + delta, 12));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (tipo === "mes") {
    const total = (anio * 12 + (mes - 1)) + delta;
    return armar(Math.floor(total / 12), (total % 12) + 1, dia);
  }
  if (tipo === "anio") return armar(anio + delta, mes, dia);
  return head;
}

/** Suma `delta` al segmento de un periodo `YYYY-MM`. */
export function ajustarPeriodo(ym: string, tipo: SegmentoTipo, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [anio, mes] = ym.split("-").map(Number);
  if (tipo === "anio") return `${String(anio + delta).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
  const total = (anio * 12 + (mes - 1)) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Recorta un ISO al rango permitido (comparación lexicográfica, válida en ISO). */
export function limitarIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
