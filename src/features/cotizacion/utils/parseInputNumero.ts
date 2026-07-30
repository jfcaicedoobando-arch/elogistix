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

/**
 * R-01 — límite de saneidad para la columna "Cant.". Ya NO se aplica como
 * clamp silencioso (eso convertía 15,000 en 9,999 y enmascaraba el bug de
 * migración de valores entre campos); sólo se usa para VALIDAR y avisar.
 */
export const CANTIDAD_LIMITE_SANIDAD = 1_000_000;

/**
 * Parseo de la columna "Cant." Acepta separador de miles ("15,000") y respeta
 * el valor tecleado tal cual: la validación de rango vive en el wizard con
 * mensaje al usuario, nunca como reescritura silenciosa.
 */
export function parseCantidad(raw: string): number {
  const limpio = raw.replace(/,/g, "");
  return parseInputNumero(limpio);
}

/** `true` cuando la cantidad supera el límite de saneidad (se avisa, no se reescribe). */
export function cantidadFueraDeRango(n: number): boolean {
  return n > CANTIDAD_LIMITE_SANIDAD;
}
