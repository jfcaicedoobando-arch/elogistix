/**
 * Internos compartidos entre `errorDetailsExtract.ts` y `errorCodeDerive.ts`.
 * No exportar fuera de `components/shared/utils/`.
 */

interface MaybeZodError {
  name?: unknown;
  issues?: unknown;
  errors?: unknown;
}

function asZodError(v: unknown): MaybeZodError | null {
  if (!v || typeof v !== "object") return null;
  const z = v as MaybeZodError;
  if (z.name === "ZodError" && Array.isArray(z.issues)) return z;
  if (z.name === "ZodError" && Array.isArray(z.errors)) return z;
  return null;
}

/** Busca un ZodError en el error o en su cadena `cause` (máx 5 niveles). */
export function findZodError(err: unknown): MaybeZodError | null {
  const seen = new WeakSet<object>();
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const z = asZodError(current);
    if (z) return z;
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) break;
      seen.add(current);
      if ("cause" in current) {
        current = (current as { cause?: unknown }).cause;
        continue;
      }
    }
    break;
  }
  return null;
}

export type { MaybeZodError };
