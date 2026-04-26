/**
 * Controller hook del wizard "Nuevo Embarque".
 * Encapsula estado del wizard, validaciones, expediente y vinculación.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 * Orquestación del submit → `useEmbarqueSubmitOrchestrator`.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useProveedoresForSelect,
  type ExpedienteCliente,
} from "@/hooks/useEmbarques";
import {
  useClientesForSelect,
  useContactosCliente,
} from "@/hooks/useClientes";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { useCotizacionHydration } from "@/hooks/embarque/useCotizacionHydration";
import { useEmbarqueSubmitOrchestrator } from "@/hooks/embarque/useEmbarqueSubmitOrchestrator";
import {
  useCotizacionesAceptadas,
  type CotizacionRow,
} from "@/hooks/useCotizaciones";
import { fetchCotizacionCostosForEmbarque } from "@/services/cotizacion";
import {
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
} from "@/lib/domain/embarqueWizard";
import {
  validateStepDatosGenerales,
  validateStepRuta,
  validateStepDocumentos,
  validateStepCostos,
  type StepValidationErrors,
} from "@/lib/domain/embarqueWizardSchemas";

type ModoExpediente = "nuevo" | "existente";

export function useNuevoEmbarqueWizard() {
  const { toast } = useToast();

  // ── Catálogos ──────────────────────────────────────────────
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();

  // ── Estado local del wizard ────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<number, StepValidationErrors>>({});
  const [cotizacionVinculada, setCotizacionVinculada] = useState<CotizacionRow | null>(null);
  const [modoExpediente, setModoExpediente] = useState<ModoExpediente>("nuevo");
  const [expedienteSeleccionado, setExpedienteSeleccionado] =
    useState<ExpedienteCliente | null>(null);

  // ── Form principal del embarque ────────────────────────────
  const form = useEmbarqueForm();
  const { methods } = form;

  const clienteId = methods.watch("clienteId");
  const modo = methods.watch("modo");
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  // ── Conceptos venta/costo ──────────────────────────────────
  const conceptos = useConceptosForm();
  const { setConceptosVenta, setConceptosCosto } = conceptos;

  const selectedCliente = clientes.find((c) => c.id === clienteId);

  // ── Hidratación desde cotización ───────────────────────────
  const hidratarConceptosDesdeCotizacion = useCallback(
    async (cot: CotizacionRow) => {
      const ventas = mapConceptosVentaFromCotizacion(cot);
      if (ventas.length > 0) setConceptosVenta(ventas);

      const costos = await fetchCotizacionCostosForEmbarque(cot.id);
      if (costos.length > 0) {
        setConceptosCosto(mapConceptosCostoFromCotizacion(costos, proveedoresDb));
      }
    },
    [setConceptosVenta, setConceptosCosto, proveedoresDb],
  );

  const handleVincularCotizacion = useCallback(
    (cot: CotizacionRow) => {
      setCotizacionVinculada(cot);
      form.vincularCotizacion(cot);
      void hidratarConceptosDesdeCotizacion(cot);
    },
    [form, hidratarConceptosDesdeCotizacion],
  );

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    form.desvincularCotizacion();
    setModoExpediente("nuevo");
    setExpedienteSeleccionado(null);
  }, [form]);

  useCotizacionHydration({ onPrevincular: handleVincularCotizacion });

  // ── Reset del expediente al cambiar de cliente ─────────────
  const prevClienteRef = useRef(clienteId);
  useEffect(() => {
    if (clienteId !== prevClienteRef.current) {
      prevClienteRef.current = clienteId;
      setModoExpediente("nuevo");
      setExpedienteSeleccionado(null);
    }
  }, [clienteId]);

  const handleModoExpedienteChange = useCallback(
    (nuevoModo: ModoExpediente) => {
      setModoExpediente(nuevoModo);
      if (nuevoModo === "nuevo") {
        setExpedienteSeleccionado(null);
        methods.setValue("blMaster", "");
      }
    },
    [methods],
  );

  const handleSeleccionarExpediente = useCallback(
    (exp: ExpedienteCliente) => {
      setExpedienteSeleccionado(exp);
      methods.setValue("blMaster", exp.bl_master || "");
    },
    [methods],
  );

  // ── Validación por paso (zod) ──────────────────────────────
  const validateStep = useCallback(
    (step: number): boolean => {
      const values = methods.getValues();
      let errors: StepValidationErrors = {};

      if (step === 1) {
        errors = validateStepDatosGenerales(values);
      } else if (step === 2) {
        errors = validateStepRuta(values);
      } else if (step === 3) {
        const archivos: Record<string, { size: number; type: string }> = {};
        for (const [nombre, file] of Object.entries(form.documentosArchivos)) {
          archivos[nombre] = { size: file.size, type: file.type };
        }
        errors = validateStepDocumentos(archivos);
      } else if (step === 4) {
        errors = validateStepCostos({
          conceptosVenta: conceptos.conceptosVenta.map((v) => ({
            id: v.id,
            concepto: v.concepto,
            cantidad: v.cantidad,
            precioUnitario: v.precioUnitario,
            moneda: v.moneda,
          })),
          conceptosCosto: conceptos.conceptosCosto.map((c) => ({
            id: c.id,
            proveedorId: c.proveedorId,
            concepto: c.concepto,
            monto: c.monto,
            moneda: c.moneda,
          })),
          tipoCambioUSD: values.tipoCambioUSD,
          tipoCambioEUR: values.tipoCambioEUR,
        });
      }

      setValidationErrors((prev) => ({ ...prev, [step]: errors }));

      if (Object.keys(errors).length > 0) {
        const stepLabel = STEP_LABELS[step] ?? `Paso ${step}`;
        toast({
          title: `Revisa el Paso ${step}: ${stepLabel}`,
          description: Object.values(errors)[0],
          variant: "destructive",
        });
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
    // Validar todos los pasos antes de enviar
    for (const step of [1, 2, 3, 4]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    await orchestrator.submit({
      values: methods.getValues(),
      modoExpediente,
      expedienteSeleccionado,
      cotizacionVinculada,
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
    validationErrors,
    validateStep,
    validateStep1,
    // Catálogos / contactos
    clientes,
    proveedoresDb,
    cotizacionesAceptadas,
    contactos,
    selectedCliente,
    modo,
    // Vinculación con cotización
    cotizacionVinculada,
    handleVincularCotizacion,
    handleDesvincularCotizacion,
    // Expediente
    modoExpediente,
    expedienteSeleccionado,
    handleModoExpedienteChange,
    handleSeleccionarExpediente,
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
