/**
 * Controller hook del wizard "Nuevo Embarque".
 * Encapsula estado, validaciones, expediente y orquestación del submit.
 *
 * Lógica pura → `lib/domain/embarqueWizard.ts`.
 * Hidratación inicial → `useCotizacionHydration`.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  useProveedoresForSelect,
  useCreateEmbarque,
  type ExpedienteCliente,
} from "@/hooks/useEmbarques";
import {
  useClientesForSelect,
  useContactosCliente,
} from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { useCotizacionHydration } from "@/hooks/embarque/useCotizacionHydration";
import {
  useCotizacionesAceptadas,
  useUpdateEstadoCotizacion,
  type CotizacionRow,
} from "@/hooks/useCotizaciones";
import {
  resolverExpediente,
  subirDocumentosEmbarque,
} from "@/services/embarqueServices";
import { fetchCotizacionCostosForEmbarque } from "@/services/cotizacionServices";
import {
  validateDatosGenerales,
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
  resolveExpedienteForSubmit,
  buildBitacoraDetalles,
} from "@/lib/domain/embarqueWizard";
import { getErrorMessage } from "@/lib/errors";
import type { EmbarqueValidationErrors } from "@/components/embarque/StepDatosGenerales";

type ModoExpediente = "nuevo" | "existente";

export function useNuevoEmbarqueWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Catálogos ──────────────────────────────────────────────
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();

  // ── Mutaciones ─────────────────────────────────────────────
  const createEmbarque = useCreateEmbarque();
  const registrarActividad = useRegistrarActividad();
  const updateEstadoCotizacion = useUpdateEstadoCotizacion();

  // ── Estado local del wizard ────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<EmbarqueValidationErrors>({});
  const [cotizacionVinculada, setCotizacionVinculada] = useState<CotizacionRow | null>(null);
  const [modoExpediente, setModoExpediente] = useState<ModoExpediente>("nuevo");
  const [expedienteSeleccionado, setExpedienteSeleccionado] =
    useState<ExpedienteCliente | null>(null);

  // ── Form principal del embarque ────────────────────────────
  const {
    methods,
    handleMsdsUpload,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
    documentosArchivos,
    setDocumentoArchivo,
    getDocumentosChecklist,
    vincularCotizacion,
    desvincularCotizacion,
  } = useEmbarqueForm();

  const clienteId = methods.watch("clienteId");
  const modo = methods.watch("modo");
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  // ── Conceptos venta/costo ──────────────────────────────────
  const {
    conceptosVenta,
    conceptosCosto,
    updateConceptoVenta,
    addConceptoVenta,
    removeConceptoVenta,
    updateConceptoCosto,
    addConceptoCosto,
    removeConceptoCosto,
    subtotalVenta,
    totalCosto,
    utilidadEstimada,
    setConceptosVenta,
    setConceptosCosto,
  } = useConceptosForm();

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
      vincularCotizacion(cot);
      void hidratarConceptosDesdeCotizacion(cot);
    },
    [vincularCotizacion, hidratarConceptosDesdeCotizacion],
  );

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    desvincularCotizacion();
    setModoExpediente("nuevo");
    setExpedienteSeleccionado(null);
  }, [desvincularCotizacion]);

  // Pre-vinculación automática desde CotizacionDetalle
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

  // ── Validación step 1 ──────────────────────────────────────
  const validateStep1 = useCallback((): boolean => {
    const errors = validateDatosGenerales(methods.getValues());
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [methods]);

  // ── Submit final ───────────────────────────────────────────
  const handleFinish = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      toast({
        title: "Campos requeridos",
        description:
          "Completa todos los campos obligatorios marcados con * en Datos Generales.",
        variant: "destructive",
      });
      return;
    }

    const v = methods.getValues();

    try {
      const expediente = await resolveExpedienteForSubmit({
        modoExpediente,
        expedienteSeleccionado,
        blMaster: v.blMaster,
        tipo: v.tipo,
        resolverNuevo: resolverExpediente,
      });

      const docPayload = await subirDocumentosEmbarque(
        expediente,
        getDocumentosChecklist(v.modo),
        documentosArchivos,
      );

      const embarquePayload = {
        expediente,
        ...buildEmbarquePayload(contactos, selectedCliente?.nombre || "", user?.email || ""),
        ...(cotizacionVinculada ? { cotizacion_id: cotizacionVinculada.id } : {}),
      };

      await createEmbarque.mutateAsync({
        embarque: embarquePayload,
        conceptosVenta: buildConceptosVentaPayload(conceptosVenta),
        conceptosCosto: buildConceptosCostoPayload(conceptosCosto, proveedoresDb),
        documentos: docPayload,
      });

      if (cotizacionVinculada) {
        await updateEstadoCotizacion.mutateAsync({
          id: cotizacionVinculada.id,
          estado: "Embarcada",
        });
      }

      registrarActividad.mutate({
        accion: "crear",
        modulo: "embarques",
        entidad_nombre: expediente,
        detalles: buildBitacoraDetalles({
          modo: v.modo,
          tipo: v.tipo,
          clienteNombre: selectedCliente?.nombre ?? "",
          cotizacionFolio: cotizacionVinculada?.folio ?? null,
          modoExpediente,
        }),
      });

      toast({
        title: "Embarque creado",
        description: `Expediente ${expediente} registrado correctamente.`,
      });
      navigate("/embarques");
    } catch (err: unknown) {
      toast({
        title: "Error al crear embarque",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return {
    // Form
    methods,
    // Estado wizard
    currentStep,
    setCurrentStep,
    validationErrors,
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
    handleMsdsUpload,
    setDocumentoArchivo,
    getDocumentosChecklist,
    // Conceptos
    conceptosVenta,
    conceptosCosto,
    updateConceptoVenta,
    addConceptoVenta,
    removeConceptoVenta,
    updateConceptoCosto,
    addConceptoCosto,
    removeConceptoCosto,
    subtotalVenta,
    totalCosto,
    utilidadEstimada,
    // Submit
    handleFinish,
    isPending: createEmbarque.isPending,
    navigate,
  };
}
