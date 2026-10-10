import { useCallback, useRef } from "react";
import { savePaso3, savePasoFinal } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fromDb } from "@/lib/supabase/cast";
import { usePaso1Handlers } from "./usePaso1Handlers";
import { errorConceptosVenta } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { conceptosPaso3Schema, primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import { firmaCostos, type WizardStepsDeps as Deps } from "./wizardStepsTypes";
import { usePaso2Handler } from "./usePaso2Handler";
import { validarPaso2 } from "./paso2Helpers";

/**
 * Encapsula la navegación entre pasos del wizard de cotización.
 * v12.1.0: validación y vinculación CRM del paso 1 movidas a `handlePaso1Crm`.
 * v13.47.7: handlers del Paso 1 extraídos a `usePaso1Handlers` para mantener
 *           este archivo bajo 200 líneas (Power-of-10).
 */
export function useCotizacionWizardSteps({
  form, navigate, isEditMode, estadoInicial,
  cotizacionId, setCotizacionId, currentStep, setCurrentStep,
  msdsFile, costosInternos, costosDesajuste, costosPreLlenados, setCostosPreLlenados,
  conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
  tasaIva, tipoCambioUsd, buildPaso1Data, mutations, onFinalized,
}: Deps) {
  const { updateCotizacion, upsertCostos, registrarActividad } = mutations;

  const { validarParaFinalizar, handlePaso1, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError } = usePaso1Handlers({
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
  const costosAnteriores = useRef(costosPreLlenados ? costosInternos.map(c => ({ ...c })) : []);
  const lastCostosHash = useRef<string | null>(costosPreLlenados ? firmaCostos(costosInternos) : null);

  const getCostosSincronizados = useCallback(() => costosAnteriores.current, []);
  const restaurarCostosSincronizados = useCallback((costos: Deps["costosInternos"]) => {
    costosAnteriores.current = costos.map(c => ({ ...c }));
    lastCostosHash.current = firmaCostos(costos);
    setCostosPreLlenados(true);
  }, [setCostosPreLlenados]);

  const handlePaso2 = usePaso2Handler({
    conceptosUSD, conceptosMXN, costosAnteriores,
    cotizacionId, costosInternos, costosDesajuste: costosDesajuste ?? null,
    costosPreLlenados, setCostosPreLlenados,
    setConceptosUSD, setConceptosMXN, setCurrentStep, tasaIva,
    updateCotizacion, upsertCostos, lastCostosHash,
  });



  const handlePaso3 = useCallback(async () => {
    const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion?.trim());
    const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion?.trim());
    const errorPaso3 = primerError(conceptosPaso3Schema, {
      conceptosValidos: conceptosUSDValidos.length + conceptosMXNValidos.length,
    })
      // v13.823.357: mismo contrato que la base (cantidad/precio positivos y
      // moneda soportada); antes sólo se exigía la descripción.
      ?? errorConceptosVenta([...conceptosUSDValidos, ...conceptosMXNValidos]);
    if (errorPaso3) {
      notifyError(undefined, { title: errorPaso3 });
      return;
    }
    try {
      if (cotizacionId) {
        // W-01: `subtotal`/`moneda` se derivan de los conceptos dentro de savePaso3.
        // A1/A7 (13.823.159): la moneda del vínculo CRM (o la ya persistida)
        // es el respaldo cuando la venta queda en cero; antes se guardaba USD.
        // 13.823.281: el TC de la cotización sólo se usa si hay mezcla USD+MXN.
        await savePaso3({ cotizacionId, conceptosVenta: fromDb<Record<string, unknown>[]>([...conceptosUSDValidos, ...conceptosMXNValidos]), monedaFallback: form.getValues("monedaCrm"), conservarMoneda: Boolean(form.getValues("pricingSolicitudId")), tipoCambioUsd: tipoCambioUsd ?? null, mutations: { updateCotizacion } });
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
  }, [conceptosUSD, conceptosMXN, cotizacionId, updateCotizacion, setCurrentStep, form, tipoCambioUsd]);

  const handleSiguiente = useCallback(async () => {
    if (currentStep === 1) return handlePaso1();
    if (currentStep === 2) return handlePaso2();
    if (currentStep === 3) return handlePaso3();
  }, [currentStep, handlePaso1, handlePaso2, handlePaso3]);

  const finalizandoRef = useRef(false);
  const handleGuardar = useCallback(async () => {
    if (!cotizacionId || finalizandoRef.current) return;
    finalizandoRef.current = true;
    try {
      if (!(await validarParaFinalizar())) { setCurrentStep(1); return; }
      const requiereCostos = !form.getValues("sinDesgloseCostos") || costosInternos.length > 0;
      if (requiereCostos && !validarPaso2(costosInternos, costosDesajuste ?? null)) { setCurrentStep(2); return; }
      // No dar por guardados costos modificados que saltaron el Paso 2.
      if (JSON.stringify(costosInternos) !== JSON.stringify(costosAnteriores.current)) {
        notifyError(undefined, { title: "Guarda los cambios de costos en el Paso 2 antes de finalizar." });
        setCurrentStep(2);
        return;
      }
      const conceptosValidos = [...conceptosUSD, ...conceptosMXN].filter(c => c.descripcion?.trim());
      const errorVenta = primerError(conceptosPaso3Schema, { conceptosValidos: conceptosValidos.length })
        ?? errorConceptosVenta(conceptosValidos);
      if (errorVenta) {
        notifyError(undefined, { title: "Conceptos de venta incompletos", description: errorVenta });
        setCurrentStep(3);
        return;
      }
      // Guardar exactamente lo confirmado, también al saltar directamente al resumen.
      // Una sola mutación conserva el candado optimista y evita éxitos parciales.
      await savePasoFinal({
        cotizacionId, isEditMode, estadoActual: estadoInicial,
        venta: { conceptosVenta: fromDb<Record<string, unknown>[]>(conceptosValidos), monedaFallback: form.getValues("monedaCrm"), conservarMoneda: Boolean(form.getValues("pricingSolicitudId")), tipoCambioUsd: tipoCambioUsd ?? null },
        mutations: { updateCotizacion }, registrarActividad: registrarActividad.mutate,
      });
      notifySuccess(undefined, { title: isEditMode ? "Cotización actualizada exitosamente" : "Cotización creada exitosamente" });
      if (onFinalized) onFinalized(cotizacionId);
      else navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: unknown) {
      notifyError(undefined, {
        title: "Error al finalizar cotización", description: getErrorMessage(err), error: err,
        method: "FINALIZE_COTIZACION", context: { cotizacionId, isEditMode },
      });
    } finally { finalizandoRef.current = false; }
  }, [cotizacionId, validarParaFinalizar, setCurrentStep, form, costosInternos, costosDesajuste, conceptosUSD, conceptosMXN,
    isEditMode, estadoInicial, tipoCambioUsd, updateCotizacion, registrarActividad, onFinalized, navigate]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate, setCurrentStep]);

  return { getCostosSincronizados, restaurarCostosSincronizados, handleSiguiente, handleGuardar, handleBack, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError };
}
