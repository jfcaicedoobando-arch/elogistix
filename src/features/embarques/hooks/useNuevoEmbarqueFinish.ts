/**
 * Submit final del wizard "Nuevo embarque".
 * Extraído de `useNuevoEmbarqueWizard` para respetar el límite de 200 líneas.
 */
import * as Sentry from "@sentry/react";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { notifyError } from "@/lib/ui/appFeedback";
import { useEmbarqueSubmitOrchestrator } from "@/features/embarques/hooks/useEmbarqueSubmitOrchestrator";
import type { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import type { useConceptosForm } from "@/features/cotizacion/hooks";
import type { useNuevoEmbarqueExpediente } from "./useNuevoEmbarqueExpediente";
import type { useNuevoEmbarqueCotVinculada } from "./useNuevoEmbarqueCotVinculada";
import type { useContactosCliente } from "@/features/cliente/hooks/useClientes";

function avisarHidratacionPendiente(cargando: boolean) {
  notifyError(undefined, {
    step: 4,
    title: cargando ? "Los costos de la cotización siguen cargando" : "Falta completar la importación de costos",
    description: cargando
      ? "Espera a que termine la importación antes de crear el embarque."
      : "Reintenta la importación antes de crear el embarque.",
    method: "USE_NUEVO_EMBARQUE_WIZARD",
    errorCode: ERROR_CODES.VALIDATION_FAILED,
  });
}

interface FinishDeps {
  form: ReturnType<typeof useEmbarqueForm>;
  conceptos: ReturnType<typeof useConceptosForm>;
  expediente: ReturnType<typeof useNuevoEmbarqueExpediente>;
  cotVinc: ReturnType<typeof useNuevoEmbarqueCotVinculada>;
  contactos: ReturnType<typeof useContactosCliente>["data"];
  selectedClienteNombre: string;
  proveedoresDb: unknown[];
  validateStep: (step: number) => boolean;
  setCurrentStep: (step: number) => void;
  wizardStartedAt: number;
}

export function useNuevoEmbarqueFinish(deps: FinishDeps) {
  const orchestrator = useEmbarqueSubmitOrchestrator();

  // Devuelve true sólo si el embarque se creó (M-13: para limpiar el borrador).
  const handleFinish = async (): Promise<boolean> => {
    const { form, conceptos, expediente, cotVinc, validateStep, setCurrentStep } = deps;
    const { methods } = form;

    // v13.303.26 — guard defense-in-depth: sin cotización vinculada abortamos
    // antes del orquestador para evitar bypasses por errores parcheados/saltados.
    if (!cotVinc.cotizacionVinculada?.id) {
      setCurrentStep(1);
      notifyError(undefined, {
        step: 1,
        errors: { cotizacion: "Debes iniciar el embarque desde una cotización Aceptada." },
        method: "USE_NUEVO_EMBARQUE_WIZARD",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return false;
    }

    if (cotVinc.cargandoCostosVinculados || cotVinc.errorCostosVinculados) {
      setCurrentStep(4);
      avisarHidratacionPendiente(cotVinc.cargandoCostosVinculados);
      return false;
    }

    for (const step of [1, 2, 3, 4]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return false;
      }
    }

    const values = methods.getValues();
    const ok = await orchestrator.submit({
      values,
      modoExpediente: expediente.modoExpediente,
      expedienteSeleccionado: expediente.expedienteSeleccionado,
      cotizacionVinculada: cotVinc.cotizacionVinculada,
      contactos: deps.contactos ?? [],
      selectedClienteNombre: deps.selectedClienteNombre,
      proveedoresDb: deps.proveedoresDb as never,
      documentosArchivos: form.documentosArchivos,
      buildEmbarquePayload: form.buildEmbarquePayload,
      buildConceptosVentaPayload: form.buildConceptosVentaPayload,
      buildConceptosCostoPayload: form.buildConceptosCostoPayload,
      getDocumentosChecklist: form.getDocumentosChecklist,
      conceptosVenta: conceptos.conceptosVenta,
      conceptosCosto: conceptos.conceptosCosto,
    });

    // P3: métricas de negocio. `modo` es enum low-cardinality (maritimo/terrestre/aereo).
    try {
      Sentry.metrics?.distribution?.(
        "embarque.wizard_duration_ms",
        Date.now() - deps.wizardStartedAt,
        { unit: "millisecond" },
      );
      Sentry.metrics?.count?.("embarque.created", 1, {
        attributes: { modo: String(values.modo ?? "desconocido") },
      });
    } catch { /* best-effort */ }
    return ok === true;
  };

  return { handleFinish, isPending: orchestrator.isPending };
}
