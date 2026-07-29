/**
 * FIX-18 — parseo defensivo de inputs numéricos. Convierte cualquier string
 * a un número finito ≥ 0; entradas basura (`"."`, `"1.2.3"`, `"abc"`, `""`)
 * degradan a 0 en vez de propagar `NaN` a la BD.
 */
export function parseInputNumero(raw: string): number {
  if (raw === "" || raw === ".") return 0;
  if (!/^\d+(\.\d+)?$/.test(raw)) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Tope de cantidad por partida: evita totales absurdos por typos (Q-15.9). */
export const CANTIDAD_MAX = 9_999;

/**
 * Q-15.9 — parseo de la columna "Cant." Acepta separador de miles ("15,000")
 * y limita el valor a `CANTIDAD_MAX` para que un typo no dispare el total
 * de la cotización a cientos de millones.
 */
export function parseCantidad(raw: string): number {
  const limpio = raw.replace(/,/g, "");
  const n = parseInputNumero(limpio);
  return Math.min(n, CANTIDAD_MAX);
}
