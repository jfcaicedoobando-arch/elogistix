import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { CostoCotizacion } from "@/hooks/cotizacion/useCotizacionCostos";
import type { CreateCotizacionInput, CotizacionRow, ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import type { FilaCostoLocal } from "@/types/cotizacionPL";
import type { CotizacionFormValues } from "@/lib/mappers/cotizacionForm";
import { savePaso1, savePaso2, savePaso3, savePasoFinal, buildConceptosFromCostos } from "@/services/cotizacion";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

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
}

/**
 * Encapsula la navegación entre pasos del wizard de cotización.
 * Extraído de useCotizacionWizardForm para separar orquestación de validación + persistencia por paso.
 */
export function useCotizacionWizardSteps({
  form, toast, navigate, isEditMode,
  cotizacionId, setCotizacionId, currentStep, setCurrentStep,
  msdsFile, costosInternos, costosPreLlenados, setCostosPreLlenados,
  conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
  totalUSD, tasaIva, buildPaso1Data, mutations,
}: Deps) {
  const { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad } = mutations;

  const handleSiguiente = useCallback(async () => {
    const v = form.getValues();
    if (currentStep === 1) {
      if (!v.esProspecto && !v.clienteId) {
        notifyError(toast, { title: "Selecciona un cliente" });
        return;
      }
      if (v.esProspecto && !v.prospectoEmpresa.trim()) {
        notifyError(toast, { title: "Ingresa el nombre de la empresa del prospecto" });
        return;
      }
      if (v.esProspecto && !v.prospectoContacto.trim()) {
        notifyError(toast, { title: "Ingresa el nombre del contacto del prospecto" });
        return;
      }
      try {
        const id = await savePaso1({
          form, msdsFile, cotizacionId, buildPaso1Data,
          mutations: { crearCotizacion, updateCotizacion },
        });
        if (!cotizacionId) setCotizacionId(id);
        setCurrentStep(2);
      } catch (err: unknown) {
        notifyError(toast, { title: "Error al guardar datos generales", message: getErrorMessage(err) });
      }
    } else if (currentStep === 2) {
      try {
        if (costosInternos.length > 0 && cotizacionId) {
          await savePaso2({ cotizacionId, costosInternos, mutations: { upsertCostos } });
        }
        if (!costosPreLlenados && costosInternos.length > 0) {
          const { usd, mxn } = buildConceptosFromCostos(costosInternos, tasaIva);
          if (usd.length > 0) setConceptosUSD(usd);
          if (mxn.length > 0) setConceptosMXN(mxn);
          setCostosPreLlenados(true);
        }
        setCurrentStep(3);
      } catch (err: unknown) {
        notifyError(toast, { title: "Error al guardar costos", message: getErrorMessage(err) });
      }
    } else if (currentStep === 3) {
      const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion?.trim());
      const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion?.trim());
      if (conceptosUSDValidos.length === 0 && conceptosMXNValidos.length === 0) {
        notifyError(toast, { title: "Agrega al menos un concepto de venta" });
        return;
      }
      try {
        if (cotizacionId) {
          await savePaso3({
            cotizacionId,
            conceptosVenta: [...conceptosUSDValidos, ...conceptosMXNValidos] as unknown as Record<string, unknown>[],
            totalUSD,
            mutations: { updateCotizacion },
          });
        }
        setCurrentStep(4);
      } catch (err: unknown) {
        notifyError(toast, { title: "Error al guardar conceptos de venta", message: getErrorMessage(err) });
      }
    }
  }, [
    currentStep, form, msdsFile, buildPaso1Data, cotizacionId, setCotizacionId, setCurrentStep,
    updateCotizacion, crearCotizacion, costosInternos, upsertCostos, costosPreLlenados,
    conceptosUSD, conceptosMXN, totalUSD, toast, tasaIva,
    setConceptosUSD, setConceptosMXN, setCostosPreLlenados,
  ]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      await savePasoFinal({
        cotizacionId, isEditMode,
        mutations: { updateCotizacion },
        registrarActividad: registrarActividad.mutate,
      });
      notifySuccess(toast, { title: isEditMode ? "Cotización actualizada exitosamente" : "Cotización creada exitosamente" });
      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al finalizar cotización", message: getErrorMessage(err) });
    }
  }, [cotizacionId, updateCotizacion, registrarActividad, toast, navigate, isEditMode]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate, setCurrentStep]);

  return { handleSiguiente, handleGuardar, handleBack };
}
