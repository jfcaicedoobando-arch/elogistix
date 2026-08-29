/**
 * Autoguardado del borrador del wizard "Nuevo embarque" (M-13, v14-2).
 * Espejo de `useCotizacionDraftAutosave` (cotizaciones): debounce 800 ms,
 * TTL 24 h, congelación durante restauración (`paused`) y detección de
 * conflicto entre pestañas vía evento `storage` + `tabId`.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { EmbarqueFormValues } from "@/features/embarques/domain/mappers/embarque";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import {
  EMBARQUE_DRAFT_DEBOUNCE_MS,
  clearEmbarqueDraft,
  embarqueDraftKey,
  embarqueDraftTieneContenido,
  type StoredEmbarqueDraft,
} from "./embarqueDraftStorage";

interface Params {
  form: UseFormReturn<EmbarqueFormValues>;
  userId: string;
  organizationId?: string | null;
  enabled: boolean;
  currentStep: number;
  conceptosVenta: ConceptoVentaLocal[];
  conceptosCosto: ConceptoCostoLocal[];
  cotizacionVinculadaId: string | null;
  /** Congela el autosave mientras se restaura un borrador (igual que R-09). */
  paused?: boolean;
}

export function useEmbarqueDraftAutosave({
  form,
  userId,
  organizationId = null,
  enabled,
  currentStep,
  conceptosVenta,
  conceptosCosto,
  cotizacionVinculadaId,
  paused = false,
}: Params): {
  clear: () => void;
  conflictoExterno: boolean;
  descartarConflicto: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<number>(currentStep);
  stepRef.current = currentStep;
  const ventaRef = useRef<ConceptoVentaLocal[]>(conceptosVenta);
  ventaRef.current = conceptosVenta;
  const costoRef = useRef<ConceptoCostoLocal[]>(conceptosCosto);
  costoRef.current = conceptosCosto;
  const cotRef = useRef<string | null>(cotizacionVinculadaId);
  cotRef.current = cotizacionVinculadaId;
  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;
  const tabIdRef = useRef<string>(crypto.randomUUID());
  const [conflictoExterno, setConflictoExterno] = useState(false);

  const clear = useCallback(() => {
    clearEmbarqueDraft(userId, organizationId);
  }, [userId, organizationId]);

  const persist = useCallback((values: EmbarqueFormValues) => {
    if (pausedRef.current) return;
    if (!embarqueDraftTieneContenido(values, ventaRef.current, costoRef.current)) return;
    const payload: StoredEmbarqueDraft = {
      version: 1,
      savedAt: Date.now(),
      values,
      currentStep: stepRef.current,
      conceptosVenta: ventaRef.current,
      conceptosCosto: costoRef.current,
      cotizacionVinculadaId: cotRef.current,
      tabId: tabIdRef.current,
    };
    try {
      safeLocalStorage.setItem(embarqueDraftKey(userId, organizationId), JSON.stringify(payload));
    } catch {
      // safeLocalStorage ya loguea.
    }
  }, [userId, organizationId]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch((values) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(values as EmbarqueFormValues), EMBARQUE_DRAFT_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, form, persist]);

  // Paso y conceptos viven fuera de RHF: se escriben de inmediato.
  useEffect(() => {
    if (!enabled) return;
    persist(form.getValues());
  }, [enabled, form, currentStep, conceptosVenta, conceptosCosto, cotizacionVinculadaId, persist]);

  // Conflicto entre pestañas (misma política que cotizaciones, M-12).
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const key = embarqueDraftKey(userId, organizationId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        const tabAjena =
          parsed && typeof parsed === "object" &&
          (parsed as { tabId?: unknown }).tabId !== tabIdRef.current;
        if (tabAjena) setConflictoExterno(true);
      } catch {
        // JSON ajeno/corrupto: no es conflicto accionable.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled, userId, organizationId]);

  const descartarConflicto = useCallback(() => setConflictoExterno(false), []);

  return { clear, conflictoExterno, descartarConflicto };
}
