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
  version: 2;
  savedAt: number;
  /** B-003 (v13.320.32): sin esto, recargar el wizard tras paso 1 duplicaba
   *  la cotización — el `cotizacionId` vivía sólo en memoria React. */
  cotizacionId: string | null;
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
      typeof (parsedUnknown as { savedAt?: unknown }).savedAt !== "number"
    ) {
      return null;
    }
    const versionRaw = (parsedUnknown as { version?: unknown }).version;
    // Aceptamos v1 (legacy, sin cotizacionId) y v2 (con cotizacionId).
    if (versionRaw !== 1 && versionRaw !== 2) return null;
    const bag = parsedUnknown as { savedAt: number; values: CotizacionFormValues; cotizacionId?: unknown };
    if (Date.now() - bag.savedAt > DRAFT_TTL_MS) {
      safeLocalStorage.removeItem(draftKey(userId));
      return null;
    }
    // SAFE-CAST: shape mínimo validado + rehidratación de fechas.
    const parsed: StoredDraft = {
      version: 2,
      savedAt: bag.savedAt,
      cotizacionId: typeof bag.cotizacionId === "string" ? bag.cotizacionId : null,
      values: bag.values,
    };
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
  /** B-003: se sigue guardando aún después del paso 1 para persistir el
   *  `cotizacionId` en el draft y evitar duplicados al recargar. Sólo se
   *  desactiva en modo edición (initialData presente en el wizard). */
  enabled: boolean;
  /** B-003: id actual del wizard; se persiste en el draft junto con los values. */
  cotizacionId: string | null;
}

export function useCotizacionDraftAutosave({ form, userId, enabled, cotizacionId }: Params): {
  clear: () => void;
  flush: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cotIdRef = useRef<string | null>(cotizacionId);
  cotIdRef.current = cotizacionId;

  const clear = useCallback(() => {
    clearDraft(userId);
  }, [userId]);

  const flush = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      const payload: StoredDraft = {
        version: 2,
        savedAt: Date.now(),
        cotizacionId: cotIdRef.current,
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
          version: 2,
          savedAt: Date.now(),
          cotizacionId: cotIdRef.current,
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

  // B-003: al cambiar el `cotizacionId` (transición paso 1 → 2), escribimos
  // inmediatamente para no perderlo si el usuario recarga en ese momento.
  useEffect(() => {
    if (!enabled || !cotizacionId) return;
    try {
      const payload: StoredDraft = {
        version: 2,
        savedAt: Date.now(),
        cotizacionId,
        values: form.getValues(),
      };
      safeLocalStorage.setItem(draftKey(userId), JSON.stringify(payload));
    } catch {
      /* noop */
    }
  }, [enabled, cotizacionId, form, userId]);

  return { clear, flush };
}
