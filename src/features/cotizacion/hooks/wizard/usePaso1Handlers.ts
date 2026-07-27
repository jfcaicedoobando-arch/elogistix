/**
 * Handlers del Paso 1 del wizard de cotización (extraídos de
 * `useCotizacionWizardSteps` para mantenerlo bajo el límite Power-of-10
 * de 200 líneas). Ambos handlers comparten validación CRM, llamada a
 * `savePaso1` y vinculación CRM tras crear.
 */
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { CreateCotizacionInput, CotizacionRow } from "@/features/cotizacion/hooks/useCotizaciones";
import { savePaso1 } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/lib/ui/appFeedback";
import { validatePaso1, vincularCrmTrasCrear } from "./handlePaso1Crm";
import { scrollAndFocusSection, seccionParaErrorPaso1 } from "./scrollToErrorSection";


interface Paso1Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<void>; isPending: boolean };
  registrarActividad: { mutate: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string; detalles?: Record<string, unknown> }) => void };
}

interface Paso1Deps {
  form: UseFormReturn<CotizacionFormValues>;
  cotizacionId: string | null;
  setCotizacionId: (id: string) => void;
  setCurrentStep: (step: number | ((p: number) => number)) => void;
  msdsFile: File | null;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: Paso1Mutations;
}

export function usePaso1Handlers({
  form, cotizacionId, setCotizacionId, setCurrentStep,
  msdsFile, buildPaso1Data, mutations,
}: Paso1Deps) {
  const { crearCotizacion, updateCotizacion, registrarActividad } = mutations;

  const handlePaso1 = useCallback(async () => {
    const v = form.getValues();
    const err = validatePaso1(v);
    if (err) { notifyError(undefined, { title: err }); scrollAndFocusSection(seccionParaErrorPaso1(err)); return; }
    const esNueva = !cotizacionId;
    try {
      const id = await savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } });
      if (!cotizacionId) setCotizacionId(id);
      if (esNueva && v.esProspecto) {
        await vincularCrmTrasCrear(id, v);
      }
      setCurrentStep(2);
    } catch (e: unknown) {
      notifyError(undefined, {
        title: "Error al guardar datos generales",
        description: getErrorMessage(e),
        error: e,
        method: cotizacionId ? "UPDATE_DRAFT_COTIZACION" : "CREATE_DRAFT_COTIZACION",
        context: { cotizacionId, paso: 1 },
      });
    }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, setCotizacionId, setCurrentStep]);

  /**
   * Atajo "Cotizar sin desglose": guarda Paso 1 con `sin_desglose_costos = true`
   * y salta directo al Paso 3 (Cotización Cliente). Bitácora: cotizacion_sin_desglose_creada.
   */
  const handleCotizarSinDesglose = useCallback(async () => {
    const v = form.getValues();
    const err = validatePaso1(v);
    if (err) { notifyError(undefined, { title: err }); scrollAndFocusSection(seccionParaErrorPaso1(err)); return; }
    form.setValue("sinDesgloseCostos", true, { shouldDirty: true });
    const esNueva = !cotizacionId;
    try {
      const id = await savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } });
      if (!cotizacionId) setCotizacionId(id);
      if (esNueva && v.esProspecto) {
        await vincularCrmTrasCrear(id, v);
      }
      registrarActividad.mutate({
        accion: "cotizacion_sin_desglose_creada",
        modulo: "cotizaciones",
        entidad_id: id,
        entidad_nombre: "",
      });
      setCurrentStep(3);
    } catch (e: unknown) {
      notifyError(undefined, {
        title: "Error al guardar cotización",
        description: getErrorMessage(e),
        error: e,
        method: "COTIZAR_SIN_DESGLOSE",
        context: { cotizacionId, paso: 1 },
      });
    }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, registrarActividad, setCotizacionId, setCurrentStep]);

  return { handlePaso1, handleCotizarSinDesglose };
}
