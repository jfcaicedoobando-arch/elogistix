import { useCallback, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { CostoCotizacion } from "@/features/cotizacion/hooks/useCotizacionCostos";
import type { CreateCotizacionInput, CotizacionRow, ConceptoVentaCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { savePaso2, savePaso3, savePasoFinal, buildConceptosFromCostos } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fromDb } from "@/lib/supabase/cast";
import { usePaso1Handlers } from "./usePaso1Handlers";

/**
 * Firma estable de las filas de costos internos usadas para decidir cuándo
 * regenerar los conceptos de venta del paso 3. Solo campos que impactan el
 * output de `buildConceptosFromCostos`.
 */
function firmaCostos(costos: FilaCostoLocal[]): string {
  return JSON.stringify(
    costos.map(c => ({
      c: c.concepto,
      m: c.moneda,
      u: c.unidad_medida,
      q: c.cantidad,
      p: c.precio_venta,
    })),
  );
}


interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

interface StepMutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<void>; isPending: boolean };
  upsertCostos: { mutateAsync: (d: { cotizacionId: string; costos: CostoCotizacion[] }) => Promise<CostoCotizacion[]>; isPending: boolean };
  registrarActividad: { mutate: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string; detalles?: Record<string, unknown> }) => void };
}

interface Deps {
  form: UseFormReturn<CotizacionFormValues>;
  toast: ToastFn;
  navigate: NavigateFunction;
  isEditMode: boolean;
  cotizacionId: string | null;
  setCotizacionId: (id: string) => void;
  currentStep: number;
  setCurrentStep: (step: number | ((p: number) => number)) => void;
  msdsFile: File | null;
  costosInternos: FilaCostoLocal[];
  costosPreLlenados: boolean;
  setCostosPreLlenados: (v: boolean) => void;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  setConceptosUSD: (c: ConceptoVentaCotizacion[]) => void;
  setConceptosMXN: (c: ConceptoVentaCotizacion[]) => void;
  totalUSD: number;
  tasaIva: number;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: StepMutations;
  /** v13.293.0 (P0): si se pasa, se llama en lugar de navegar tras guardar. */
  onFinalized?: (cotizacionId: string) => void;
}

/**
 * Encapsula la navegación entre pasos del wizard de cotización.
 * v12.1.0: validación y vinculación CRM del paso 1 movidas a `handlePaso1Crm`.
 * v13.47.7: handlers del Paso 1 extraídos a `usePaso1Handlers` para mantener
 *           este archivo bajo 200 líneas (Power-of-10).
 */
export function useCotizacionWizardSteps({
  form, navigate, isEditMode,
  cotizacionId, setCotizacionId, currentStep, setCurrentStep,
  msdsFile, costosInternos, costosPreLlenados, setCostosPreLlenados,
  conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
  totalUSD, tasaIva, buildPaso1Data, mutations, onFinalized,
}: Deps) {
  const { updateCotizacion, upsertCostos, registrarActividad } = mutations;

  const { handlePaso1, handleCotizarSinDesglose } = usePaso1Handlers({
    form, cotizacionId, setCotizacionId, setCurrentStep,
    msdsFile, buildPaso1Data,
    mutations: {
      crearCotizacion: mutations.crearCotizacion,
      updateCotizacion: mutations.updateCotizacion,
      registrarActividad,
    },
  });

  // Firma del último snapshot de `costosInternos` que produjo conceptos de venta.
  // Se compara en cada avance al paso 3 para re-sincronizar si el usuario editó
  // costos y volvió a avanzar (fix del guard "una sola vez" — LCL bug COT-2026-0123).
  const lastCostosHash = useRef<string | null>(costosPreLlenados ? firmaCostos(costosInternos) : null);

  const handlePaso2 = useCallback(async () => {
    // Race-fix: si el usuario avanza antes de que se llenen los costos internos
    // (típico en LCL con precarga por tarifa aún pendiente), bloqueamos con toast
    // en vez de saltar a paso 3 con `conceptos_venta = []`.
    if (costosInternos.length === 0) {
      notifyError(undefined, {
        title: "Agrega al menos un costo interno antes de continuar",
        description: "El paso 3 usa los costos del paso 2 para generar los conceptos de venta.",
      });
      return;
    }
    try {
      if (cotizacionId) {
        await savePaso2({ cotizacionId, costosInternos, mutations: { upsertCostos } });
      }
      // Re-sincronización idempotente: si la firma cambió respecto al último snapshot
      // procesado (o si nunca hemos sincronizado), regeneramos conceptos.
      const hashActual = firmaCostos(costosInternos);
      if (hashActual !== lastCostosHash.current) {
        const { usd, mxn } = buildConceptosFromCostos(costosInternos, tasaIva);
        if (usd.length > 0) setConceptosUSD(usd);
        if (mxn.length > 0) setConceptosMXN(mxn);
        lastCostosHash.current = hashActual;
        if (!costosPreLlenados) setCostosPreLlenados(true);
      }
      setCurrentStep(3);
    } catch (e: unknown) {
      notifyError(undefined, {
        title: "Error al guardar costos",
        description: getErrorMessage(e),
        error: e,
        method: "SAVE_COSTOS_COTIZACION",
        context: { cotizacionId, paso: 2 },
      });
    }
  }, [costosInternos, cotizacionId, costosPreLlenados, tasaIva, upsertCostos, setConceptosUSD, setConceptosMXN, setCostosPreLlenados, setCurrentStep]);


  const handlePaso3 = useCallback(async () => {
    const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion?.trim());
    const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion?.trim());
    if (conceptosUSDValidos.length === 0 && conceptosMXNValidos.length === 0) {
      notifyError(undefined, { title: "Agrega al menos un concepto de venta" });
      return;
    }
    try {
      if (cotizacionId) {
        await savePaso3({ cotizacionId, conceptosVenta: fromDb<Record<string, unknown>[]>([...conceptosUSDValidos, ...conceptosMXNValidos]), totalUSD, mutations: { updateCotizacion } });
      }
      setCurrentStep(4);
    } catch (e: unknown) {
      notifyError(undefined, {
        title: "Error al guardar conceptos de venta",
        description: getErrorMessage(e),
        error: e,
        method: "SAVE_CONCEPTOS_VENTA_COTIZACION",
        context: { cotizacionId, paso: 3 },
      });
    }
  }, [conceptosUSD, conceptosMXN, cotizacionId, totalUSD, updateCotizacion, setCurrentStep]);

  const handleSiguiente = useCallback(async () => {
    if (currentStep === 1) return handlePaso1();
    if (currentStep === 2) return handlePaso2();
    if (currentStep === 3) return handlePaso3();
  }, [currentStep, handlePaso1, handlePaso2, handlePaso3]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      await savePasoFinal({
        cotizacionId, isEditMode,
        mutations: { updateCotizacion },
        registrarActividad: registrarActividad.mutate,
      });
      notifySuccess(undefined, { title: isEditMode ? "Cotización actualizada exitosamente" : "Cotización creada exitosamente" });
      if (onFinalized) {
        onFinalized(cotizacionId);
      } else {
        navigate(`/cotizaciones/${cotizacionId}`);
      }
    } catch (err: unknown) {
      notifyError(undefined, {
        title: "Error al finalizar cotización",
        description: getErrorMessage(err),
        error: err,
        method: "FINALIZE_COTIZACION",
        context: { cotizacionId, isEditMode },
      });
    }
  }, [cotizacionId, updateCotizacion, registrarActividad, navigate, isEditMode, onFinalized]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate, setCurrentStep]);

  return { handleSiguiente, handleGuardar, handleBack, handleCotizarSinDesglose };
}
