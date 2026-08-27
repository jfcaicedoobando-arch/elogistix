import { z } from "zod";

export type Row = Record<string, string>;

export const optional = (s: string | undefined): string | null => {
  if (s === undefined) return null;
  const t = s.trim();
  return t === "" ? null : t;
};

export interface ImportRowResult<T> {
  /** 1-indexado considerando que la fila 1 es encabezado */
  rowNumber: number;
  payload: T;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
  raw: Row;
}

export interface ImportPreview<T> {
  valid: ImportRowResult<T>[];
  invalid: ImportRowError[];
}

export function firstZodMessage(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "Inválido.";
  const path = i.path?.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

/**
 * N-05 (QA r2): anti "CSV formula injection".
 *
 * Analogía: un dato que empieza con `=` es como una nota que dice "haz esto"
 * en lugar de "esto dice". Excel/Sheets la ejecutan al reabrir el archivo
 * exportado. Se antepone `'` para forzar texto plano.
 */
export function sanitizeCsvFormula(valor: string): string {
  const t = valor.trimStart();
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : valor;
}

/** Aplica `sanitizeCsvFormula` a cada celda de la fila cruda (antes del zod). */
export function sanitizeRow(raw: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = typeof v === "string" ? sanitizeCsvFormula(v) : v;
  }
  return out;
}
