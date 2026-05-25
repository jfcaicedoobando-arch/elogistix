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
