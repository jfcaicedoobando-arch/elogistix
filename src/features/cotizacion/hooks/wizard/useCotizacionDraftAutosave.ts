/** Autoguardado local de formulario, costos y ventas; TTL/validación en storage. */
import { useEffect, useRef, useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { ventasTienenContenido } from "./cotizacionDraftVentas";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";
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
  /** EC-6: organización activa; forma parte de la clave del borrador para que
   *  cambiar de tenant no ofrezca restaurar datos de otra organización. */
  organizationId?: string | null;
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
  conceptosUSD?: ConceptoVentaCotizacion[];
  conceptosMXN?: ConceptoVentaCotizacion[];
  tipoCambioUsd?: number | null;
  getCostosSincronizados?: () => FilaCostoLocal[];
  /** v13.823.69: lector del sello optimista vigente de la cotización; se
   *  persiste en el borrador para que al restaurar no se guarde a ciegas. */
  selloActual?: () => string | null;
  /** R-09: mientras se restaura un borrador, el autoguardado se congela para
   *  que el ciclo de autosave no reescriba el draft con los valores por defecto
   *  antes de que RHF termine de aplicar `form.reset`. */
  paused?: boolean;
}

/**
 * R-09 — Un borrador sólo se escribe si tiene algo que recordar. Sin esto, el
 * primer ciclo de autosave (que corre al montar, con el formulario vacío)
 * sobrescribía el borrador guardado y "Restaurar" devolvía campos en blanco.
 */
/**
 * Claves del formulario con un valor por defecto no-vacío (ver
 * `COTIZACION_FORM_DEFAULTS`): deben excluirse porque siempre están
 * "presentes" aunque el usuario no haya tocado nada, y por eso hacían que
 * el borrador se considerara "con contenido" desde el primer render.
 */
const CLAVES_SIN_SEÑAL: ReadonlySet<string> = new Set(["prospectoModo"]);

export function draftTieneContenido(values: CotizacionFormValues, costos: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[] = []): boolean {
  if (costos.length > 0 || ventasTienenContenido(ventas)) return true;
  // SAFE-CAST: sólo se recorren las claves del formulario para detectar si hay
  // algún valor capturado; no se accede a ningún campo de forma tipada.
  const v = values as unknown as Record<string, unknown>;

  return Object.entries(v).some(([clave, valor]) => {
    if (CLAVES_SIN_SEÑAL.has(clave)) return false;
    if (typeof valor === "string") return valor.trim().length > 0;
    if (typeof valor === "number") return valor !== 0;
    if (Array.isArray(valor)) return valor.length > 0;
    return false;
  });
}

export function useCotizacionDraftAutosave({ form, userId, organizationId = null, enabled, cotizacionId, currentStep, costosInternos, conceptosUSD, conceptosMXN, tipoCambioUsd = null, getCostosSincronizados, selloActual, paused = false }: Params): {
  clear: () => void;
  flush: () => void;
  /** M-12: true cuando OTRA pestaña sobrescribió el borrador de este wizard. */
  conflictoExterno: boolean;
  /** M-12: el usuario ya vio el aviso; se reactiva si hay otra escritura externa. */
  descartarConflicto: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cotIdRef = useRef<string | null>(cotizacionId);
  cotIdRef.current = cotizacionId;
  const stepRef = useRef<number>(currentStep);
  stepRef.current = currentStep;
  const costosRef = useRef<FilaCostoLocal[]>(costosInternos);
  costosRef.current = costosInternos;
  const ventasRef = useRef({ conceptosUSD, conceptosMXN, tipoCambioUsd, getCostosSincronizados });
  ventasRef.current = { conceptosUSD, conceptosMXN, tipoCambioUsd, getCostosSincronizados };
  const scopeRef = useRef({ userId, organizationId });
  const wroteRef = useRef(false);
  const selloRef = useRef<(() => string | null) | undefined>(selloActual);
  selloRef.current = selloActual;
  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;
  // M-12 (v14-2): identidad estable de ESTA pestaña; se estampa en cada
  // escritura del draft para que el listener `storage` distinga escrituras
  // propias de las de otra pestaña (antes: last-write-wins silencioso).
  const tabIdRef = useRef<string>(crypto.randomUUID());
  const [conflictoExterno, setConflictoExterno] = useState(false);

  const clear = useCallback(() => {
    clearDraft(userId, organizationId);
  }, [userId, organizationId]);

  const buildPayload = useCallback((values: CotizacionFormValues): StoredDraft => ({
    version: 4,
    userId, organizationId,
    conceptosUSD: ventasRef.current.conceptosUSD ?? [],
    conceptosMXN: ventasRef.current.conceptosMXN ?? [],
    tipoCambioUsd: ventasRef.current.tipoCambioUsd,
    costosSincronizados: ventasRef.current.getCostosSincronizados?.() ?? costosRef.current,
    savedAt: Date.now(),
    cotizacionId: cotIdRef.current,
    updatedAt: selloRef.current?.() ?? null,
    values,
    currentStep: stepRef.current,
    costosInternos: costosRef.current,
    noRestaurado: [],
    tabId: tabIdRef.current,
  }), [userId, organizationId]);

  const persist = useCallback((values: CotizacionFormValues) => {
    if (pausedRef.current || !userId || scopeRef.current.userId !== userId || scopeRef.current.organizationId !== organizationId) return;
    if (!cotIdRef.current && !draftTieneContenido(values, costosRef.current, [...(ventasRef.current.conceptosUSD ?? []), ...(ventasRef.current.conceptosMXN ?? [])])) {
      if (wroteRef.current) clearDraft(userId, organizationId);
      return;
    }
    try {
      safeLocalStorage.setItem(draftKey(userId, organizationId), JSON.stringify(buildPayload(values)));
      wroteRef.current = true;
    } catch {
      // safeLocalStorage ya loguea.
    }
  }, [buildPayload, userId, organizationId]);

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
    const subscription = form.watch(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(form.getValues()), DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, form, persist, userId]);

  // Cambios de paso, costos, ventas y TC son estado fuera de RHF
  // (`form.watch` no los ve) — se escriben de inmediato para no perderlos.
  useEffect(() => {
    if (!enabled) return;
    persist(form.getValues());
  }, [enabled, form, currentStep, costosInternos, conceptosUSD, conceptosMXN, tipoCambioUsd, paused, persist]);

  // B-003: al cambiar el `cotizacionId` (transición paso 1 → 2), escribimos
  // inmediatamente para no perderlo si el usuario recarga en ese momento.
  useEffect(() => {
    if (!enabled || !cotizacionId) return;
    persist(form.getValues());
  }, [enabled, form, cotizacionId, persist]);

  // M-12 (v14-2): el evento `storage` sólo se dispara en las OTRAS pestañas,
  // así que si el draft cambió y su `tabId` no es el nuestro, otra pestaña
  // está capturando el mismo wizard: avisamos para que el usuario decida en
  // cuál seguir (antes: el último en escribir ganaba en silencio).
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const key = draftKey(userId, organizationId);
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

  return { clear, flush, conflictoExterno, descartarConflicto };
}
