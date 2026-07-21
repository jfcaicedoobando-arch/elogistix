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
