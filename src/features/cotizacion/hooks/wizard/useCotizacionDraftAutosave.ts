/**
 * Autoguardado de borrador del wizard de cotización (P0 — v13.293.0).
 *
 * - Persiste los valores del formulario en localStorage con debounce 800 ms.
 * - TTL 24 h: cualquier borrador más viejo se descarta al leerlo.
 * - El gating de "modo edición" o "ya avanzó a paso 2+" lo hace `enabled`
 *   desde el consumidor (`NuevaCotizacion`); dentro del hook siempre se
 *   escribe mientras `enabled=true` (React Hook Form ya deduplica watches).
 *
 * Q-12 (Ola 4): además de los `values` del formulario, el draft ahora
 * persiste `currentStep` y `costosInternos` (viven en `useState` fuera de
 * RHF, así que no se guardaban antes). Los drafts viejos (version < 3) no
 * traen esos campos: `loadDraft` lo señala en `noRestaurado` para que el
 * consumidor avise al usuario qué no se pudo recuperar.
 *
 * Consumido por `NuevaCotizacion` + `DraftRestoreBanner`.
 */
import { useEffect, useRef, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const DEBOUNCE_MS = 800;

export const draftKey = (userId: string): string => `lc:cotizacion:draft:${userId || "anon"}`;

interface StoredDraft {
  version: 3;
  savedAt: number;
  /** B-003 (v13.320.32): sin esto, recargar el wizard tras paso 1 duplicaba
   *  la cotización — el `cotizacionId` vivía sólo en memoria React. */
  cotizacionId: string | null;
  values: CotizacionFormValues;
  /** Q-12: paso del wizard en el que estaba el usuario al autoguardar. */
  currentStep: number;
  /** Q-12: filas de costos internos (P&L) capturadas en el paso 2. */
  costosInternos: FilaCostoLocal[];
  /** Etiquetas de lo que NO se pudo restaurar (drafts legacy sin estos campos,
   *  o el archivo MSDS que nunca se persiste por no ser serializable). */
  noRestaurado: string[];
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

interface RawDraftShape {
  savedAt?: unknown;
  version?: unknown;
  values?: CotizacionFormValues;
  cotizacionId?: unknown;
  currentStep?: unknown;
  costosInternos?: unknown;
}

/** El archivo MSDS nunca sobrevive a `JSON.stringify`; siempre se avisa. */
const AVISO_MSDS = "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo";

export function loadDraft(userId: string): StoredDraft | null {
  const raw = safeLocalStorage.getItem(draftKey(userId));
  if (!raw) return null;
  try {
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!parsedUnknown || typeof parsedUnknown !== "object" || typeof (parsedUnknown as RawDraftShape).savedAt !== "number") {
      return null;
    }
    const bag = parsedUnknown as RawDraftShape;
    const versionRaw = bag.version;
    // Aceptamos v1/v2 (legacy, sin paso/costos) y v3 (completo).
    if (versionRaw !== 1 && versionRaw !== 2 && versionRaw !== 3) return null;
    if (Date.now() - (bag.savedAt as number) > DRAFT_TTL_MS) {
      safeLocalStorage.removeItem(draftKey(userId));
      return null;
    }

    const noRestaurado: string[] = [AVISO_MSDS];
    if (versionRaw !== 3) {
      noRestaurado.push("El paso del asistente en el que ibas — se reinicia en el Paso 1");
      noRestaurado.push("Los costos internos capturados — tendrás que volver a agregarlos");
    }

    // SAFE-CAST: shape mínimo validado + rehidratación de fechas.
    const parsed: StoredDraft = {
      version: 3,
      savedAt: bag.savedAt as number,
      cotizacionId: typeof bag.cotizacionId === "string" ? bag.cotizacionId : null,
      values: bag.values as CotizacionFormValues,
      currentStep: typeof bag.currentStep === "number" && bag.currentStep >= 1 ? bag.currentStep : 1,
      costosInternos: Array.isArray(bag.costosInternos) ? (bag.costosInternos as FilaCostoLocal[]) : [],
      noRestaurado,
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
