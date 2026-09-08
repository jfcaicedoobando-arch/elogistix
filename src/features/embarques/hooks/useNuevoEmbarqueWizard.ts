/**
 * Controller hook del wizard "Nuevo embarque".
 * Encapsula estado del wizard, validaciones, expediente y vinculación.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 * Orquestación del submit → `useEmbarqueSubmitOrchestrator`.
 * Expediente (modo nuevo/existente) → `useNuevoEmbarqueExpediente`.
 * Vinculación con cotización + hidratación → `useNuevoEmbarqueCotVinculada`.
 * Submit final → `useNuevoEmbarqueFinish`.
 */
import { useCallback, useRef, useState } from "react";
import { useContactosCliente } from "@/features/cliente/hooks/useClientes";
import { useConceptosForm } from "@/features/cotizacion/hooks";
import { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import { validateWizardStep } from "@/features/embarques/domain/embarqueWizardStepValidator";
import { notifyError } from "@/lib/ui/appFeedback";
import { useNuevoEmbarqueExpediente } from "./useNuevoEmbarqueExpediente";
import { useNuevoEmbarqueCotVinculada } from "./useNuevoEmbarqueCotVinculada";
import { useNuevoEmbarqueCatalogos } from "./useNuevoEmbarqueCatalogos";
import { useNuevoEmbarqueFinish } from "./useNuevoEmbarqueFinish";
import { buildConceptosCostoBloqueados } from "./conceptosCostoBloqueo";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";

export function useNuevoEmbarqueWizard() {
  // v13.303.26 — sin excepciones de rol: cotización siempre obligatoria.
  const {
    clientes,
    proveedoresDb,
    cotizacionesAceptadas,
    catalogosCargando,
    catalogosError,
    recargarCatalogos,
  } = useNuevoEmbarqueCatalogos();

  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<number, StepValidationErrors>>({});

  const form = useEmbarqueForm();
  const { methods } = form;

  const clienteId = methods.watch("clienteId");
  const modo = methods.watch("modo");
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const conceptos = useConceptosForm();
  const selectedCliente = clientes.find((c) => c.id === clienteId);

  const expediente = useNuevoEmbarqueExpediente({ methods, clienteId });

  const cotVinc = useNuevoEmbarqueCotVinculada({
    form,
    setConceptosVenta: conceptos.setConceptosVenta,
    setConceptosCosto: conceptos.setConceptosCosto,
    proveedoresDb,
    onClearExpediente: expediente.clearExpediente,
  });

  // ── Validación por paso (zod) ──────────────────────────────
  const validateStep = useCallback(
    (step: number): boolean => {
      const values = methods.getValues();
      const errors: StepValidationErrors = validateWizardStep({
        step,
        values,
        documentosArchivos: form.documentosArchivos,
        conceptosVenta: conceptos.conceptosVenta,
        conceptosCosto: conceptos.conceptosCosto,
        requiereCotizacion: true,
        cotizacionVinculadaId: cotVinc.cotizacionVinculada?.id ?? null,
      });

      setValidationErrors((prev) => ({ ...prev, [step]: errors }));

      if (Object.keys(errors).length > 0) {
        notifyError(undefined, { step, errors, method: "USE_NUEVO_EMBARQUE_WIZARD", errorCode: ERROR_CODES.VALIDATION_FAILED });
        return false;
      }
      return true;
    },
    [methods, form.documentosArchivos, conceptos.conceptosVenta, conceptos.conceptosCosto, cotVinc.cotizacionVinculada],
  );


  // Compatibilidad con consumidores antiguos
  const validateStep1 = useCallback(() => validateStep(1), [validateStep]);

  // P3: marca de tiempo de inicio del wizard para medir duración end-to-end.
  const wizardStartedAt = useRef<number>(Date.now());

  // ── Submit final (delegado) ────────────────────────────────
  const { handleFinish, isPending: finishPending } = useNuevoEmbarqueFinish({
    form,
    conceptos,
    expediente,
    cotVinc,
    contactos,
    selectedClienteNombre: selectedCliente?.nombre || "",
    proveedoresDb,
    validateStep,
    setCurrentStep,
    wizardStartedAt: wizardStartedAt.current,
  });

  return {
    methods,
    currentStep,
    setCurrentStep,
    validationErrors,
    validateStep,
    validateStep1,
    clientes,
    proveedoresDb,
    cotizacionesAceptadas,
    contactos,
    selectedCliente,
    modo,
    cotizacionVinculada: cotVinc.cotizacionVinculada,
    handleVincularCotizacion: cotVinc.handleVincularCotizacion,
    handleDesvincularCotizacion: cotVinc.handleDesvincularCotizacion,
    restaurarVinculacion: cotVinc.restaurarVinculacion,
    // M-13: setters a granel para restaurar borradores (los add/update uno-a-uno
    // no sirven para rehidratar N conceptos de golpe).
    setConceptosVenta: conceptos.setConceptosVenta,
    setConceptosCosto: conceptos.setConceptosCosto,
    modoExpediente: expediente.modoExpediente,
    expedienteSeleccionado: expediente.expedienteSeleccionado,
    handleModoExpedienteChange: expediente.handleModoExpedienteChange,
    handleSeleccionarExpediente: expediente.handleSeleccionarExpediente,
    handleMsdsUpload: form.handleMsdsUpload,
    setDocumentoArchivo: form.setDocumentoArchivo,
    getDocumentosChecklist: form.getDocumentosChecklist,
    conceptosVenta: conceptos.conceptosVenta,
    conceptosCosto: conceptos.conceptosCosto,
    updateConceptoVenta: conceptos.updateConceptoVenta,
    addConceptoVenta: conceptos.addConceptoVenta,
    removeConceptoVenta: conceptos.removeConceptoVenta,
    // R201-COT-06: mientras la importación de costos está en vuelo el paso queda
    // en sólo lectura; así ninguna edición se descarta al resolver el fetch.
    ...buildConceptosCostoBloqueados(conceptos, cotVinc),
    subtotalVenta: conceptos.subtotalVenta,
    totalCosto: conceptos.totalCosto,
    utilidadEstimada: conceptos.utilidadEstimada,
    handleFinish,
    catalogosCargando,
    catalogosError,
    recargarCatalogos,
    cargandoCostosVinculados: cotVinc.cargandoCostosVinculados,
    errorCostosVinculados: cotVinc.errorCostosVinculados,
    reintentarCostosVinculados: cotVinc.reintentarCostosVinculados,
    costosBloqueados: cotVinc.costosBloqueados,
    isPending: finishPending || cotVinc.cargandoCostosVinculados,
  };
}
