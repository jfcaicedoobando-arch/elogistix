/**
 * Autoguardado de borrador del wizard de cotización (P0 — v13.293.0).
 *
 * - Persiste los valores del formulario en localStorage con debounce 800 ms.
 * - TTL 24 h: cualquier borrador más viejo se descarta al leerlo.
 * - El gating de "modo edición" o "ya avanzó a paso 2+" lo hace `enabled`
 *   desde el consumidor (`NuevaCotizacion`); dentro del hook siempre se
 *   escribe mientras `enabled=true` (React Hook Form ya deduplica watches).
 *
 * El formato del draft y su lectura viven en `cotizacionDraftStorage.ts`
 * (v13.342.0, límite de 200 líneas por archivo); aquí sólo va la orquestación.
 *
 * Consumido por `NuevaCotizacion` + `DraftRestoreBanner`.
 */
import { useEffect, useRef, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import {
  DEBOUNCE_MS,
  clearDraft,
  draftKey,
  loadDraft,
  type StoredDraft,
} from "./cotizacionDraftStorage";

export { clearDraft, draftKey, loadDraft };

interface Params {
  form: UseFormReturn<CotizacionFormValues>;
  userId: string;
  /** B-003: se sigue guardando aún después del paso 1 para persistir el
   *  `cotizacionId` en el draft y evitar duplicados al recargar. Sólo se
   *  desactiva en modo edición (initialData presente en el wizard). */
  enabled: boolean;
  /** B-003: id actual del wizard; se persiste en el draft junto con los values. */
  cotizacionId: string | null;
  /** Q-12: paso actual y filas de costos, referenciados vía ref para no
   *  reabrir el `useEffect` de watch en cada cambio (se leen al vuelo). */
  currentStep: number;
  costosInternos: FilaCostoLocal[];
}

export function useCotizacionDraftAutosave({ form, userId, enabled, cotizacionId, currentStep, costosInternos }: Params): {
  clear: () => void;
  flush: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cotIdRef = useRef<string | null>(cotizacionId);
  cotIdRef.current = cotizacionId;
  const stepRef = useRef<number>(currentStep);
  stepRef.current = currentStep;
  const costosRef = useRef<FilaCostoLocal[]>(costosInternos);
  costosRef.current = costosInternos;

  const clear = useCallback(() => {
    clearDraft(userId);
  }, [userId]);

  const buildPayload = useCallback((values: CotizacionFormValues): StoredDraft => ({
    version: 3,
    savedAt: Date.now(),
    cotizacionId: cotIdRef.current,
    values,
    currentStep: stepRef.current,
    costosInternos: costosRef.current,
    noRestaurado: [],
  }), []);

  const persist = useCallback((values: CotizacionFormValues) => {
    try {
      safeLocalStorage.setItem(draftKey(userId), JSON.stringify(buildPayload(values)));
    } catch {
      // safeLocalStorage ya loguea.
    }
  }, [buildPayload, userId]);

  const flush = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persist(form.getValues());
  }, [enabled, form, persist]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch((values) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(values as CotizacionFormValues), DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, form, persist, userId]);

  // Q-12: cambios de paso o de costos internos son estado fuera de RHF
  // (`form.watch` no los ve) — se escriben de inmediato para no perderlos.
  useEffect(() => {
    if (!enabled) return;
    persist(form.getValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentStep, costosInternos, persist]);

  // B-003: al cambiar el `cotizacionId` (transición paso 1 → 2), escribimos
  // inmediatamente para no perderlo si el usuario recarga en ese momento.
  useEffect(() => {
    if (!enabled || !cotizacionId) return;
    persist(form.getValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cotizacionId, persist]);

  return { clear, flush };
}
