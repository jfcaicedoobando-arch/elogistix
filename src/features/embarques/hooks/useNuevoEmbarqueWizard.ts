/**
 * Controller hook del wizard "Nuevo embarque".
 * Encapsula estado del wizard, validaciones, expediente y vinculación.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 * Orquestación del submit → `useEmbarqueSubmitOrchestrator`.
 * Expediente (modo nuevo/existente) → `useNuevoEmbarqueExpediente`.
 * Vinculación con cotización + hidratación → `useNuevoEmbarqueCotVinculada`.
 */
import { useCallback, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { useContactosCliente } from "@/features/cliente/hooks/useClientes";
import { useConceptosForm } from "@/features/cotizacion/hooks";
import { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import { useEmbarqueSubmitOrchestrator } from "@/features/embarques/hooks/useEmbarqueSubmitOrchestrator";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import { validateWizardStep } from "@/features/embarques/domain/embarqueWizardStepValidator";
import { notifyError } from "@/lib/ui/appFeedback";
import { useNuevoEmbarqueExpediente } from "./useNuevoEmbarqueExpediente";
import { useNuevoEmbarqueCotVinculada } from "./useNuevoEmbarqueCotVinculada";
import { useNuevoEmbarqueCatalogos } from "./useNuevoEmbarqueCatalogos";

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

  // ── Submit final (delegado al orquestador) ─────────────────
  const orchestrator = useEmbarqueSubmitOrchestrator();

  // P3: marca de tiempo de inicio del wizard para medir duración end-to-end.
  const wizardStartedAt = useRef<number>(Date.now());

  const handleFinish = async () => {
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
      return;
    }


    for (const step of [1, 2, 3, 4]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    const values = methods.getValues();
    await orchestrator.submit({
      values,
      modoExpediente: expediente.modoExpediente,
      expedienteSeleccionado: expediente.expedienteSeleccionado,
      cotizacionVinculada: cotVinc.cotizacionVinculada,
      contactos,
      selectedClienteNombre: selectedCliente?.nombre || "",
      proveedoresDb,
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
        Date.now() - wizardStartedAt.current,
        { unit: "millisecond" },
      );
      Sentry.metrics?.count?.("embarque.created", 1, {
        attributes: { modo: String(values.modo ?? "desconocido") },
      });
    } catch { /* best-effort */ }
  };

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
    updateConceptoCosto: conceptos.updateConceptoCosto,
    addConceptoCosto: conceptos.addConceptoCosto,
    removeConceptoCosto: conceptos.removeConceptoCosto,
    subtotalVenta: conceptos.subtotalVenta,
    totalCosto: conceptos.totalCosto,
    utilidadEstimada: conceptos.utilidadEstimada,
    handleFinish,
    catalogosCargando,
    catalogosError,
    recargarCatalogos,
    isPending: orchestrator.isPending,
  };
}
