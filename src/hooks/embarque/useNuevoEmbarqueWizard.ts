/**
 * Controller hook del wizard "Nuevo Embarque".
 * Compone los sub-hooks: form, conceptos, expediente/vinculación, validación
 * y orquestador de submit. Mantiene la API pública estable para los consumidores.
 *
 * v8.98.0 — split en sub-hooks dedicados (useNuevoEmbarqueExpediente,
 * useNuevoEmbarqueValidation) para reducir tamaño y mejorar cohesión.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 * Orquestación del submit → `useEmbarqueSubmitOrchestrator`.
 */
import { useState } from "react";
import { useProveedoresForSelect } from "@/hooks/embarque/useEmbarques";
import {
  useClientesForSelect,
  useContactosCliente,
} from "@/hooks/cliente/useClientes";
import { useConceptosForm } from "@/hooks/cotizacion/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { useEmbarqueSubmitOrchestrator } from "@/hooks/embarque/useEmbarqueSubmitOrchestrator";
import { useCotizacionesAceptadas } from "@/hooks/cotizacion/useCotizaciones";
import { useNuevoEmbarqueExpediente } from "@/hooks/embarque/useNuevoEmbarqueExpediente";
import { useNuevoEmbarqueValidation } from "@/hooks/embarque/useNuevoEmbarqueValidation";

export function useNuevoEmbarqueWizard() {
  // ── Catálogos ──────────────────────────────────────────────
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();

  const [currentStep, setCurrentStep] = useState(1);

  // ── Form principal del embarque ────────────────────────────
  const form = useEmbarqueForm();
  const { methods } = form;

  const clienteId = methods.watch("clienteId");
  const modo = methods.watch("modo");
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  // ── Conceptos venta/costo ──────────────────────────────────
  const conceptos = useConceptosForm();
  const selectedCliente = clientes.find((c) => c.id === clienteId);

  // ── Expediente + vinculación con cotización ────────────────
  const expediente = useNuevoEmbarqueExpediente({
    methods,
    vincularCotizacion: form.vincularCotizacion,
    desvincularCotizacion: form.desvincularCotizacion,
    setConceptosVenta: conceptos.setConceptosVenta,
    setConceptosCosto: conceptos.setConceptosCosto,
    proveedoresDb,
    clienteId,
  });

  // ── Validación por paso ────────────────────────────────────
  const validation = useNuevoEmbarqueValidation({
    methods,
    documentosArchivos: form.documentosArchivos,
    conceptosVenta: conceptos.conceptosVenta,
    conceptosCosto: conceptos.conceptosCosto,
  });

  // ── Submit final (delegado al orquestador) ─────────────────
  const orchestrator = useEmbarqueSubmitOrchestrator();

  const handleFinish = async () => {
    for (const step of [1, 2, 3, 4]) {
      if (!validation.validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    await orchestrator.submit({
      values: methods.getValues(),
      modoExpediente: expediente.modoExpediente,
      expedienteSeleccionado: expediente.expedienteSeleccionado,
      cotizacionVinculada: expediente.cotizacionVinculada,
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
    // Form
    methods,
    // Estado wizard
    currentStep,
    setCurrentStep,
    validationErrors: validation.validationErrors,
    validateStep: validation.validateStep,
    validateStep1: validation.validateStep1,
    // Catálogos / contactos
    clientes,
    proveedoresDb,
    cotizacionesAceptadas,
    contactos,
    selectedCliente,
    modo,
    // Vinculación con cotización
    cotizacionVinculada: expediente.cotizacionVinculada,
    handleVincularCotizacion: expediente.handleVincularCotizacion,
    handleDesvincularCotizacion: expediente.handleDesvincularCotizacion,
    // Expediente
    modoExpediente: expediente.modoExpediente,
    expedienteSeleccionado: expediente.expedienteSeleccionado,
    handleModoExpedienteChange: expediente.handleModoExpedienteChange,
    handleSeleccionarExpediente: expediente.handleSeleccionarExpediente,
    // Documentos
    handleMsdsUpload: form.handleMsdsUpload,
    setDocumentoArchivo: form.setDocumentoArchivo,
    getDocumentosChecklist: form.getDocumentosChecklist,
    // Conceptos
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
    // Submit
    handleFinish,
    isPending: orchestrator.isPending,
  };
}
