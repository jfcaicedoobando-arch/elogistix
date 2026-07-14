/**
 * Autoguardado de borrador del wizard de cotización (P0 — v13.293.0).
 *
 * - Persiste los valores del formulario en localStorage con debounce 800 ms.
 * - TTL 24 h: cualquier borrador más viejo se descarta al leerlo.
 * - El gating de "modo edición" o "ya avanzó a paso 2+" lo hace `enabled`
 *   desde el consumidor (`NuevaCotizacion`); dentro del hook siempre se
 *   escribe mientras `enabled=true` (React Hook Form ya deduplica watches).
 *
 * Consumido por `NuevaCotizacion` + `DraftRestoreBanner`.
 */
import { useEffect, useRef, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const DEBOUNCE_MS = 800;

export const draftKey = (userId: string): string => `lc:cotizacion:draft:${userId || "anon"}`;

interface StoredDraft {
  version: 1;
  savedAt: number;
  values: CotizacionFormValues;
}

/** Campos `Date` del form que se pierden al pasar por JSON.stringify. */
const DATE_FIELDS: readonly (keyof CotizacionFormValues)[] = ["validezPropuesta"];

function reviveDateFields(values: CotizacionFormValues): void {
  // SAFE-CAST: rehidratación local de fechas serializadas a JSON en el draft (ver mem://principles/safe-cast).
  const bag = values as unknown as Record<string, unknown>;
  for (const key of DATE_FIELDS) {
    const raw = bag[key as string];
    if (typeof raw === "string") {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) bag[key as string] = d;
    }
  }
}


export function loadDraft(userId: string): StoredDraft | null {
  const raw = safeLocalStorage.getItem(draftKey(userId));
  if (!raw) return null;
  try {
    const parsedUnknown: unknown = JSON.parse(raw);
    if (
      !parsedUnknown ||
      typeof parsedUnknown !== "object" ||
      (parsedUnknown as { version?: unknown }).version !== 1 ||
      typeof (parsedUnknown as { savedAt?: unknown }).savedAt !== "number"
    ) {
      return null;
    }
    // SAFE-CAST: validado shape mínimo (version + savedAt numérico) antes de aceptar.
    const parsed = parsedUnknown as StoredDraft;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      safeLocalStorage.removeItem(draftKey(userId));
      return null;
    }
    // JSON.stringify convierte Date → string ISO; revivimos los campos Date
    // conocidos del form para que RHF y los mappers reciban `Date` reales.
    reviveDateFields(parsed.values);
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  safeLocalStorage.removeItem(draftKey(userId));
}

interface Params {
  form: UseFormReturn<CotizacionFormValues>;
  userId: string;
  /** Se desactiva en modo edición o cuando ya existe un cotizacionId (paso 2+). */
  enabled: boolean;
}

export function useCotizacionDraftAutosave({ form, userId, enabled }: Params): {
  clear: () => void;
  flush: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    clearDraft(userId);
  }, [userId]);

  // v13.294.1 (P1) — Guardado inmediato saltándose el debounce.
  // Se dispara desde `Ctrl/Cmd + S`. No-op cuando `enabled=false`.
  const flush = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      const payload: StoredDraft = {
        version: 1,
        savedAt: Date.now(),
        values: form.getValues(),
      };
      safeLocalStorage.setItem(draftKey(userId), JSON.stringify(payload));
    } catch {
      // safeLocalStorage ya loguea.
    }
  }, [enabled, form, userId]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch((values) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const payload: StoredDraft = {
          version: 1,
          savedAt: Date.now(),
          values: values as CotizacionFormValues,
        };
        try {
          safeLocalStorage.setItem(draftKey(userId), JSON.stringify(payload));
        } catch {
          // safeLocalStorage ya loguea; no propagamos.
        }
      }, DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, form, userId]);

  return { clear, flush };
}
