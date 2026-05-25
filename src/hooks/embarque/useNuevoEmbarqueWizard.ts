/**
 * Controller hook del wizard "Nuevo Embarque".
 * Encapsula estado del wizard, validaciones, expediente y vinculación.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 * Orquestación del submit → `useEmbarqueSubmitOrchestrator`.
 * Expediente (modo nuevo/existente) → `useNuevoEmbarqueExpediente`.
 * Vinculación con cotización + hidratación → `useNuevoEmbarqueCotVinculada`.
 */
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/shared/useToast";
import {
  useProveedoresForSelect,
} from "@/hooks/embarque/useEmbarques";
import {
  useClientesForSelect,
  useContactosCliente,
} from "@/hooks/cliente/useClientes";
import { useConceptosForm } from "@/hooks/cotizacion/wizard/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { useEmbarqueSubmitOrchestrator } from "@/hooks/embarque/useEmbarqueSubmitOrchestrator";
import { useCotizacionesAceptadas } from "@/hooks/cotizacion/useCotizaciones";
import type { StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import { validateWizardStep } from "@/lib/domain/embarqueWizardStepValidator";
import { notifyError } from "@/lib/ui/appFeedback";
import { useNuevoEmbarqueExpediente } from "./useNuevoEmbarqueExpediente";
import { useNuevoEmbarqueCotVinculada } from "./useNuevoEmbarqueCotVinculada";

export function useNuevoEmbarqueWizard() {
  const { toast } = useToast();

  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();

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
      });

      setValidationErrors((prev) => ({ ...prev, [step]: errors }));

      if (Object.keys(errors).length > 0) {
        notifyError(toast, { step, errors });
        return false;
      }
      return true;
    },
    [methods, form.documentosArchivos, conceptos.conceptosVenta, conceptos.conceptosCosto, toast],
  );

  // Compatibilidad con consumidores antiguos
  const validateStep1 = useCallback(() => validateStep(1), [validateStep]);

  // ── Submit final (delegado al orquestador) ─────────────────
  const orchestrator = useEmbarqueSubmitOrchestrator();

  const handleFinish = async () => {
    for (const step of [1, 2, 3, 4]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    await orchestrator.submit({
      values: methods.getValues(),
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
    isPending: orchestrator.isPending,
  };
}
