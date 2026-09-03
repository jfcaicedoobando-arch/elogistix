import { useCallback, useRef } from "react";
import { savePaso3, savePasoFinal, buildConceptosFromCostos } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fromDb } from "@/lib/supabase/cast";
import { usePaso1Handlers } from "./usePaso1Handlers";
import { costosSinConcepto } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { conceptosPaso3Schema, primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import { firmaCostos, type WizardStepsDeps as Deps } from "./wizardStepsTypes";
import { usePaso2Handler } from "./usePaso2Handler";

/**
 * Encapsula la navegación entre pasos del wizard de cotización.
 * v12.1.0: validación y vinculación CRM del paso 1 movidas a `handlePaso1Crm`.
 * v13.47.7: handlers del Paso 1 extraídos a `usePaso1Handlers` para mantener
 *           este archivo bajo 200 líneas (Power-of-10).
 */
export function useCotizacionWizardSteps({
  form, navigate, isEditMode, estadoInicial,
  cotizacionId, setCotizacionId, currentStep, setCurrentStep,
  msdsFile, costosInternos, costosPreLlenados, setCostosPreLlenados,
  conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
  tasaIva, buildPaso1Data, mutations, onFinalized,
}: Deps) {
  const { updateCotizacion, upsertCostos, registrarActividad } = mutations;

  const { handlePaso1, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError } = usePaso1Handlers({
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

  const handlePaso2 = usePaso2Handler({
    cotizacionId, costosInternos, costosPreLlenados, setCostosPreLlenados,
    setConceptosUSD, setConceptosMXN, setCurrentStep, tasaIva,
    updateCotizacion, upsertCostos, lastCostosHash,
  });



  const handlePaso3 = useCallback(async () => {
    const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion?.trim());
    const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion?.trim());
    const errorPaso3 = primerError(conceptosPaso3Schema, {
      conceptosValidos: conceptosUSDValidos.length + conceptosMXNValidos.length,
    });
    if (errorPaso3) {
      notifyError(undefined, { title: errorPaso3 });
      return;
    }
    try {
      if (cotizacionId) {
        // W-01: `subtotal`/`moneda` se derivan de los conceptos dentro de savePaso3.
        await savePaso3({ cotizacionId, conceptosVenta: fromDb<Record<string, unknown>[]>([...conceptosUSDValidos, ...conceptosMXNValidos]), mutations: { updateCotizacion } });
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
  }, [conceptosUSD, conceptosMXN, cotizacionId, updateCotizacion, setCurrentStep]);

  const handleSiguiente = useCallback(async () => {
    if (currentStep === 1) return handlePaso1();
    if (currentStep === 2) return handlePaso2();
    if (currentStep === 3) return handlePaso3();
  }, [currentStep, handlePaso1, handlePaso2, handlePaso3]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      // B-074: no finalizar una cotización con costos con precio de venta y
      // `conceptos_venta` vacío (P&L ficticio en rojo y embarque sin ventas).
      // Si el prefill del paso 3 no se materializó (p. ej. tras override +
      // ida/vuelta entre pasos), regeneramos desde los costos actuales.
      let conceptosValidos = [...conceptosUSD, ...conceptosMXN].filter(c => c.descripcion?.trim());
      const hayVentasEnCostos = costosInternos.some(c => Number(c.precio_venta) > 0);
      if (conceptosValidos.length === 0 && hayVentasEnCostos) {
        const { usd, mxn } = buildConceptosFromCostos(costosInternos, tasaIva);
        conceptosValidos = [...usd, ...mxn].filter(c => c.descripcion?.trim());
        if (conceptosValidos.length > 0) {
          setConceptosUSD(usd);
          setConceptosMXN(mxn);
          lastCostosHash.current = firmaCostos(costosInternos);
          await savePaso3({ cotizacionId, conceptosVenta: fromDb<Record<string, unknown>[]>(conceptosValidos), mutations: { updateCotizacion } });
        }
      }
      if (conceptosValidos.length === 0 && hayVentasEnCostos) {
        notifyError(undefined, {
          title: "La cotización no tiene conceptos de venta",
          description: "Hay costos con precio de venta pero ningún concepto válido. Revisa el paso 3 antes de guardar.",
        });
        return;
      }
      // B-081: si algún renglón con venta quedó fuera por no tener concepto, no
      // damos por buena la cotización (terminaría con importes incompletos).
      const descartados = costosSinConcepto(costosInternos);
      if (descartados.length > 0) {
        notifyError(undefined, {
          title: "Renglones de costo sin concepto",
          description: `${descartados.length === 1 ? "1 renglón tiene" : `${descartados.length} renglones tienen`} importes sin concepto y no se incluirían en la venta. Regresa al paso 2 y captura el concepto.`,
        });
        return;
      }

      await savePasoFinal({
        cotizacionId, isEditMode, estadoActual: estadoInicial,
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
  }, [cotizacionId, updateCotizacion, registrarActividad, navigate, isEditMode, estadoInicial, onFinalized, conceptosUSD, conceptosMXN, costosInternos, tasaIva, setConceptosUSD, setConceptosMXN]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate, setCurrentStep]);

  return { handleSiguiente, handleGuardar, handleBack, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError };
}
