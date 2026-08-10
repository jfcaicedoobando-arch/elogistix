/**
 * M11 — Parser fiscal canónico de conceptos.
 *
 * Antes cada módulo coercía a su manera (`Number(x) || 0`, `parseFloat`,
 * `Math.round`), con dos consecuencias reales:
 *  - `Number("1,200.00")` → NaN → el importe se guardaba como 0 sin aviso.
 *  - cantidades fraccionarias válidas (0.5 TON) se redondeaban a 1.
 *
 * Este módulo es la única fuente de verdad para convertir valores crudos
 * (XML CFDI, PDF parseado con IA, formularios) a números fiscales.
 */
import { roundMoney } from "@/lib/financial/financialUtils";
import { limpiarSeparadoresMiles } from "@/lib/format/parseMonto";

/**
 * Convierte un valor crudo a número finito. Acepta strings con separador de
 * miles (`"1,200.50"`), símbolos de moneda y espacios. Devuelve `null` cuando
 * el valor no es interpretable (el caller decide si es error o fallback).
 */
export function parseNumeroFiscal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const limpio = limpiarSeparadoresMiles(value);
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Importe monetario normalizado a 2 decimales. `fallback` si no es parseable. */
export function parseImporteFiscal(value: unknown, fallback = 0): number {
  const n = parseNumeroFiscal(value);
  return roundMoney(n ?? fallback);
}

/**
 * Cantidad fiscal: positiva y con hasta 6 decimales (lo que admite el CFDI 4.0).
 * Ya NO se redondea a entero: `0.5 TON` es una cantidad válida.
 */
export function parseCantidadFiscal(value: unknown, fallback = 1): number {
  const n = parseNumeroFiscal(value);
  const base = n == null || n <= 0 ? fallback : n;
  return Math.round(base * 1e6) / 1e6;
}

/** Descripción saneada; `null` si queda vacía. */
export function normalizarDescripcionFiscal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpia = value.replace(/\s+/g, " ").trim();
  return limpia === "" ? null : limpia.slice(0, 1000);
}

/** Clave SAT (c_ClaveProdServ / c_ClaveUnidad) saneada; `null` si viene vacía. */
export function normalizarClaveSat(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpia = value.trim().toUpperCase();
  return limpia === "" ? null : limpia;
}
