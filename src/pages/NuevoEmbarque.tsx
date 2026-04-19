import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import {
  useProveedoresForSelect,
  useCreateEmbarque,
} from "@/hooks/useEmbarques";
import type { ExpedienteCliente } from "@/hooks/useEmbarques";
import { useClientesForSelect, useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { useCotizacionesAceptadas, useUpdateEstadoCotizacion, useCotizacion, type CotizacionRow } from "@/hooks/useCotizaciones";
import { resolverExpediente, subirDocumentosEmbarque } from "@/services/embarqueServices";
import { supabase } from "@/integrations/supabase/client";
import { parseConceptos } from "@/lib/parsers/cotizacionDetalle";
import { getErrorMessage } from "@/lib/errorUtils";
import { EmbarqueWizardLayout } from "@/components/embarque/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/components/embarque/StepDatosGenerales";
import type { EmbarqueValidationErrors } from "@/components/embarque/StepDatosGenerales";
import { StepDatosRuta } from "@/components/embarque/StepDatosRuta";
import { StepDocumentos } from "@/components/embarque/StepDocumentos";
import { StepCostosPrecios } from "@/components/embarque/StepCostosPrecios";

const steps = [
  { title: 'Datos Generales', num: 1 },
  { title: 'Datos de Ruta', num: 2 },
  { title: 'Documentos', num: 3 },
  { title: 'Costos y Pricing', num: 4 },
];

export default function NuevoEmbarque() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();
  const createEmbarque = useCreateEmbarque();
  const registrarActividad = useRegistrarActividad();
  const updateEstadoCotizacion = useUpdateEstadoCotizacion();

  // Pre-vinculación desde detalle de cotización (location.state.cotizacionPrevinculadaId)
  const cotizacionPrevinculadaId = (location.state as { cotizacionPrevinculadaId?: string } | null)?.cotizacionPrevinculadaId;
  const { data: cotizacionPrevinculada } = useCotizacion(cotizacionPrevinculadaId);

  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<EmbarqueValidationErrors>({});
  const [cotizacionVinculada, setCotizacionVinculada] = useState<CotizacionRow | null>(null);
  const [modoExpediente, setModoExpediente] = useState<'nuevo' | 'existente'>('nuevo');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<ExpedienteCliente | null>(null);

  const {
    methods, handleMsdsUpload, buildEmbarquePayload, buildConceptosVentaPayload,
    buildConceptosCostoPayload, documentosArchivos, setDocumentoArchivo, getDocumentosChecklist,
    vincularCotizacion, desvincularCotizacion,
  } = useEmbarqueForm();
  const clienteId = methods.watch('clienteId');
  const modo = methods.watch('modo');
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
    setConceptosVenta, setConceptosCosto,
  } = useConceptosForm();

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const hidratarConceptosDesdeCotizacion = useCallback(async (cot: CotizacionRow) => {
    // 1. Conceptos de venta desde el JSONB de la cotización
    const ventas = parseConceptos(cot.conceptos_venta);
    if (ventas.length > 0) {
      setConceptosVenta(ventas.map((v, idx) => ({
        id: idx + 1,
        concepto: v.descripcion ?? '',
        cantidad: Number(v.cantidad) || 1,
        precioUnitario: Number(v.precio_unitario) || 0,
        moneda: v.moneda || 'MXN',
      })));
    }
    // 2. Conceptos de costo desde la tabla cotizacion_costos
    const { data: costos } = await supabase
      .from('cotizacion_costos')
      .select('concepto, costo_unitario, moneda, proveedor')
      .eq('cotizacion_id', cot.id);
    if (costos && costos.length > 0) {
      setConceptosCosto(costos.map((c, idx) => {
        const provMatch = proveedoresDb.find(p => p.nombre === c.proveedor);
        return {
          id: idx + 1,
          proveedorId: provMatch?.id ?? '',
          concepto: c.concepto,
          monto: Number(c.costo_unitario) || 0,
          moneda: c.moneda || 'MXN',
        };
      }));
    }
  }, [setConceptosVenta, setConceptosCosto, proveedoresDb]);

  const handleVincularCotizacion = useCallback((cot: CotizacionRow) => {
    setCotizacionVinculada(cot);
    vincularCotizacion(cot);
    void hidratarConceptosDesdeCotizacion(cot);
  }, [vincularCotizacion, hidratarConceptosDesdeCotizacion]);

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    desvincularCotizacion();
    // Reset expediente association too
    setModoExpediente('nuevo');
    setExpedienteSeleccionado(null);
  }, [desvincularCotizacion]);

  // Auto-pre-vinculación si viene de CotizacionDetalle
  const yaPrevinculadoRef = useRef(false);
  useEffect(() => {
    if (yaPrevinculadoRef.current) return;
    if (!cotizacionPrevinculada) return;
    yaPrevinculadoRef.current = true;
    handleVincularCotizacion(cotizacionPrevinculada);
    toast({
      title: 'Datos pre-rellenados',
      description: `Cotización ${cotizacionPrevinculada.folio} vinculada automáticamente.`,
    });
    // Limpiar location.state para evitar re-aplicación en refresh
    window.history.replaceState({}, '');
  }, [cotizacionPrevinculada, handleVincularCotizacion, toast]);

  // Reset expediente selection when client changes
  const prevClienteRef = useRef(clienteId);
  useEffect(() => {
    if (clienteId !== prevClienteRef.current) {
      prevClienteRef.current = clienteId;
      setModoExpediente('nuevo');
      setExpedienteSeleccionado(null);
    }
  }, [clienteId]);

  const handleModoExpedienteChange = useCallback((modo: 'nuevo' | 'existente') => {
    setModoExpediente(modo);
    if (modo === 'nuevo') {
      setExpedienteSeleccionado(null);
      methods.setValue('blMaster', '');
    }
  }, [methods]);

  const handleSeleccionarExpediente = useCallback((exp: ExpedienteCliente) => {
    setExpedienteSeleccionado(exp);
    methods.setValue('blMaster', exp.bl_master || '');
  }, [methods]);

  const validateStep1 = useCallback((): boolean => {
    const v = methods.getValues();
    const errors: EmbarqueValidationErrors = {};
    if (!v.modo) errors.modo = 'Selecciona un modo de transporte';
    if (!v.tipo) errors.tipo = 'Selecciona un tipo de operación';
    if (!v.clienteId) errors.clienteId = 'Selecciona un cliente';
    if (!v.descripcionMercancia.trim()) errors.descripcionMercancia = 'Ingresa la descripción de la mercancía';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [methods]);

  const handleFinish = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      toast({ title: "Campos requeridos", description: "Completa todos los campos obligatorios marcados con * en Datos Generales.", variant: "destructive" });
      return;
    }

    const v = methods.getValues();

    try {
      // Determine expediente: use existing one or generate new
      let expediente: string;
      if (modoExpediente === 'existente' && expedienteSeleccionado) {
        expediente = expedienteSeleccionado.expediente;
      } else {
        expediente = await resolverExpediente(v.blMaster, v.tipo);
      }

      const docPayload = await subirDocumentosEmbarque(
        expediente,
        getDocumentosChecklist(v.modo),
        documentosArchivos,
      );

      const embarquePayload = {
        expediente,
        ...buildEmbarquePayload(contactos, selectedCliente?.nombre || '', user?.email || ''),
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
          estado: 'Embarcada',
        });
      }

      registrarActividad.mutate({
        accion: 'crear',
        modulo: 'embarques',
        entidad_nombre: expediente,
        detalles: { modo: v.modo, tipo: v.tipo, cliente: selectedCliente?.nombre ?? '', cotizacion_folio: cotizacionVinculada?.folio ?? null, asociado_a_existente: modoExpediente === 'existente' },
      });

      toast({ title: "Embarque creado", description: `Expediente ${expediente} registrado correctamente.` });
      navigate("/embarques");
    } catch (err: unknown) {
      toast({ title: "Error al crear embarque", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <FormProvider {...methods}>
      <EmbarqueWizardLayout
        title="Nuevo Embarque"
        subtitle="Completa los datos para registrar un embarque"
        steps={steps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        totalSteps={4}
        isPending={createEmbarque.isPending}
        saveLabel="Crear Embarque"
        onBack={() => navigate("/embarques")}
        onFinish={handleFinish}
        validateStep={(step) => step === 1 ? validateStep1() : true}
      >
        {currentStep === 1 && (
          <StepDatosGenerales
            clientes={clientes}
            clienteNombre={selectedCliente?.nombre || ''}
            contactos={contactos}
            onMsdsUpload={handleMsdsUpload}
            errors={validationErrors}
            cotizacionesAceptadas={cotizacionesAceptadas}
            cotizacionVinculada={cotizacionVinculada}
            onVincularCotizacion={handleVincularCotizacion}
            onDesvincularCotizacion={handleDesvincularCotizacion}
            modoExpediente={modoExpediente}
            onModoExpedienteChange={handleModoExpedienteChange}
            expedienteSeleccionado={expedienteSeleccionado}
            onSeleccionarExpediente={handleSeleccionarExpediente}
          />
        )}
        {currentStep === 2 && <StepDatosRuta />}
        {currentStep === 3 && (
          <StepDocumentos
            documentos={getDocumentosChecklist(modo)}
            onFileChange={setDocumentoArchivo}
          />
        )}
        {currentStep === 4 && (
          <StepCostosPrecios
            conceptosVenta={conceptosVenta}
            conceptosCosto={conceptosCosto}
            proveedoresDb={proveedoresDb}
            subtotalVenta={subtotalVenta}
            totalCosto={totalCosto}
            utilidadEstimada={utilidadEstimada}
            updateConceptoVenta={updateConceptoVenta}
            addConceptoVenta={addConceptoVenta}
            removeConceptoVenta={removeConceptoVenta}
            updateConceptoCosto={updateConceptoCosto}
            addConceptoCosto={addConceptoCosto}
            removeConceptoCosto={removeConceptoCosto}
          />
        )}
      </EmbarqueWizardLayout>
    </FormProvider>
  );
}
