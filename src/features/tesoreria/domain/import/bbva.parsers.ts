/**
 * Primitivas de parseo del estado de cuenta BBVA México.
 *
 * Extraído de `bbva.ts` (Power of 10: archivos ≤200 líneas). Aquí vive todo lo
 * que no toca el flujo de archivo: catálogos de encabezados, normalización de
 * fechas/montos y el hash de deduplicación.
 */
import { isoUtcDay } from "@/lib/date/mx";

export const HEADERS_FECHA = ["FECHA", "FECHA OPER", "FECHA OPERACION", "F. OPER"];
export const HEADERS_CONCEPTO = ["DESCRIPCION", "DESCRIPCIÓN", "CONCEPTO", "MOVIMIENTO"];
export const HEADERS_REF = ["REFERENCIA", "REF", "FOLIO"];
export const HEADERS_CARGO = ["CARGO", "RETIRO", "RETIROS", "CARGOS", "DEBE"];
export const HEADERS_ABONO = ["ABONO", "DEPOSITO", "DEPÓSITO", "DEPOSITOS", "ABONOS", "HABER"];
export const HEADERS_SALDO = ["SALDO", "SALDO OPERACION"];

export const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

export function findColIdx(headers: string[], candidates: string[]): number {
  const ups = headers.map(norm);
  for (const c of candidates) {
    const i = ups.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * N33 (Ola 4): valida contra el calendario real. Antes el ISO se armaba por
 * interpolación de strings y un 31/02 o un mes >12 viajaba hasta el upsert,
 * donde Postgres rechazaba el LOTE COMPLETO con un error crudo.
 */
export function esFechaValida(yyyy: number, mm: number, dd: number): boolean {
  if (yyyy < 2000 || yyyy > 2099 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

export function parseFecha(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return isoUtcDay(raw);
  if (typeof raw === "number") {
    // Excel serial
    const ms = (raw - 25569) * 86_400_000;
    return isoUtcDay(new Date(ms));
  }
  const s = String(raw).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const yyyy = y.length === 2 ? `20${y}` : y;
    // N33 (Ola 4): DD/MM estricto; inválida → null (fila descartada con warning).
    if (!esFechaValida(Number(yyyy), Number(mo), Number(d))) return null;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD-MMM-YYYY (e.g. 15-MAY-2026)
  const meses: Record<string, string> = {
    ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
  };
  const m2 = s.match(/^(\d{1,2})[/-]?([A-Za-z]{3})[/-]?(\d{2,4})$/);
  if (m2) {
    const [, d, monStr, y] = m2;
    const mo = meses[norm(monStr).slice(0, 3)];
    if (!mo) return null;
    const yyyy = y.length === 2 ? `20${y}` : y;
    if (!esFechaValida(Number(yyyy), Number(mo), Number(d))) return null;
    return `${yyyy}-${mo}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Convierte el valor crudo en número conservando el signo (los cargos suelen
 * llegar negativos en el estado de cuenta). Devuelve `NaN` cuando el valor no
 * es parseable para que la fila se descarte con evidencia y no se colapse
 * silenciosamente a 0.
 */
export function parseMonto(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[$,\s]/g, "");
  // paréntesis contables denotan cargo negativo: (1,234.56) → -1234.56
  const isParen = /^\(.*\)$/.test(s);
  const clean = s.replace(/[()]/g, "");
  const n = Number(clean);
  if (!Number.isFinite(n)) return NaN;
  return isParen ? -Math.abs(n) : n;
}

export async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
