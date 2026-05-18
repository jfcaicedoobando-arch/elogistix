/**
 * Helpers de coerción para mappers BD ↔ formulario.
 * Aíslan los defaults (`?? ""`, `?? 0`) para que las funciones de mapeo
 * no acumulen complejidad ciclomática por cada campo.
 */
export const str = (v: unknown, def = ""): string =>
  v === null || v === undefined ? def : String(v);

export const num = (v: unknown, def = 0): number =>
  v === null || v === undefined || v === "" ? def : Number(v);

export const numStr = (v: unknown, def = ""): string =>
  v === null || v === undefined ? def : String(v);

export const bool = (v: unknown, def = false): boolean =>
  v === null || v === undefined ? def : Boolean(v);

export const nullable = <T,>(v: T | null | undefined): T | null =>
  v === undefined ? null : (v ?? null);

export const emptyToNull = (v: string | null | undefined): string | null =>
  v && v.length > 0 ? v : null;
