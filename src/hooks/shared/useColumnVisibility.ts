/**
 * Hook de visibilidad de columnas persistida por usuario.
 *
 * - `defaults`: mapa `columnId → boolean` con la config inicial (columnas
 *   visibles por defecto en `true`; ocultas por defecto en `false`).
 * - `storageKey`: llave estable (ej. `"cxp-facturas-columns"`); se persiste
 *   en `safeLocalStorage` bajo el prefijo `lc:col-vis:<key>`.
 *
 * Retorna la forma que TanStack Table espera en `state.columnVisibility`
 * más un setter y un `reset` para volver a defaults.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";

export type ColumnVisibility = Record<string, boolean>;

const PREFIX = "lc:col-vis:";

function readFromStorage(key: string): ColumnVisibility | null {
  const raw = safeLocalStorage.getItem(`${PREFIX}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: ColumnVisibility = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "boolean") out[k] = v;
      }
      return out;
    }
  } catch {
    // Corrupto: descartar
  }
  return null;
}

export function useColumnVisibility(storageKey: string, defaults: ColumnVisibility) {
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    const stored = readFromStorage(storageKey);
    return { ...defaults, ...(stored ?? {}) };
  });

  useEffect(() => {
    safeLocalStorage.setItem(`${PREFIX}${storageKey}`, JSON.stringify(visibility));
  }, [storageKey, visibility]);

  const toggle = useCallback((columnId: string) => {
    setVisibility((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  }, []);

  const reset = useCallback(() => {
    setVisibility({ ...defaults });
  }, [defaults]);

  const isCustom = useMemo(() => {
    return Object.keys(defaults).some((k) => (defaults[k] ?? true) !== (visibility[k] ?? true));
  }, [defaults, visibility]);

  return { visibility, setVisibility, toggle, reset, isCustom };
}
