/**
 * Handler del Paso 2 del wizard de cotización (extraído de
 * `useCotizacionWizardSteps` para mantenerlo bajo el límite Power-of-10 de
 * 200 líneas).
 */
import { useCallback, type MutableRefObject } from "react";
import { savePaso2, buildConceptosFromCostos } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { esConflictoConcurrencia } from "@/lib/errors/concurrencia";
import { notifyError } from "@/lib/ui/appFeedback";
import { costosSinConcepto } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { costosPaso2Schema, primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import { firmaCostos, type WizardStepsDeps as Deps } from "./wizardStepsTypes";

interface Paso2Deps {
  cotizacionId: Deps["cotizacionId"];
  costosInternos: Deps["costosInternos"];
  costosPreLlenados: Deps["costosPreLlenados"];
  setCostosPreLlenados: Deps["setCostosPreLlenados"];
  setConceptosUSD: Deps["setConceptosUSD"];
  setConceptosMXN: Deps["setConceptosMXN"];
  setCurrentStep: Deps["setCurrentStep"];
  tasaIva: Deps["tasaIva"];
  updateCotizacion: Deps["mutations"]["updateCotizacion"];
  upsertCostos: Deps["mutations"]["upsertCostos"];
  lastCostosHash: MutableRefObject<string | null>;
}

export function usePaso2Handler({
  cotizacionId, costosInternos, costosPreLlenados, setCostosPreLlenados,
  setConceptosUSD, setConceptosMXN, setCurrentStep, tasaIva,
  updateCotizacion, upsertCostos, lastCostosHash,
}: Paso2Deps) {
  return useCallback(async () => {
    // Race-fix + B-081: reglas de validez del paso 2 (EC-4) en `validarPaso2`.
    if (!validarPaso2(costosInternos)) return;

    // Falla cerrada: sin sello local no se intenta guardar ni se avanza.
    const selloPaso2 = updateCotizacion.selloActual?.() ?? null;
    if (cotizacionId && costosInternos.length > 0 && !selloPaso2) {
      notifyError(undefined, {
        title: "No se puede guardar sin la versión actual",
        description:
          "Tus costos capturados se conservan. Recarga los datos de la cotización y vuelve a intentar; nada se guardó encima.",
      });
      return;
    }

    try {
      if (cotizacionId) {
        // v13.823.69: el paso 2 viaja con el mismo sello optimista que el resto
        // del wizard; la RPC reemplaza los costos sólo si nadie más tocó la
        // cotización y devuelve el sello nuevo para resincronizar.
        const nuevoSello = await savePaso2({
          cotizacionId,
          costosInternos,
          expectedUpdatedAt: selloPaso2,
          mutations: { upsertCostos },
        });
        if (nuevoSello) updateCotizacion.resincronizarSello?.(nuevoSello);
      }

      sincronizarConceptosPaso2({
        costosInternos,
        tasaIva,
        lastCostosHash,
        costosPreLlenados,
        setConceptosUSD,
        setConceptosMXN,
        setCostosPreLlenados,
      });
      setCurrentStep(3);
    } catch (e: unknown) {
      // Conflicto: no se borró ni insertó nada en servidor. Conservamos los
      // costos capturados y dejamos al usuario en el paso 2.
      notifyError(undefined, {
        title: esConflictoConcurrencia(e)
          ? "Otra persona actualizó la cotización"
          : "Error al guardar costos",
        description: esConflictoConcurrencia(e)
          ? "Tus cambios locales NO se guardaron. Recarga los datos para ver la versión actual o revisa y vuelve a intentar; nada se guardó encima."
          : getErrorMessage(e),
        error: e,
        method: "SAVE_COSTOS_COTIZACION",
        context: { cotizacionId, paso: 2 },
      });
    }
  }, [costosInternos, cotizacionId, costosPreLlenados, tasaIva, upsertCostos, updateCotizacion, setConceptosUSD, setConceptosMXN, setCostosPreLlenados, setCurrentStep, lastCostosHash]);
}
