import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useProveedoresForSelect,
  useCreateEmbarque,
} from "@/hooks/useEmbarques";
import { useClientesForSelect, useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/useEmbarqueForm";
import { useCotizacionesAceptadas, type CotizacionRow } from "@/hooks/useCotizaciones";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { resolverExpediente, subirDocumentosEmbarque } from "@/lib/embarqueServices";
import { StepIndicator } from "@/components/embarque/StepIndicator";
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
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();
  const createEmbarque = useCreateEmbarque();
  const registrarActividad = useRegistrarActividad();

  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<EmbarqueValidationErrors>({});
  const [cotizacionVinculada, setCotizacionVinculada] = useState<CotizacionRow | null>(null);
  const { methods, handleMsdsUpload, buildEmbarquePayload, buildConceptosVentaPayload, buildConceptosCostoPayload, documentosArchivos, setDocumentoArchivo, getDocumentosChecklist } = useEmbarqueForm();
  const clienteId = methods.watch('clienteId');
  const modo = methods.watch('modo');
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
  } = useConceptosForm();

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const opts = { shouldValidate: true, shouldDirty: true } as const;

  const handleVincularCotizacion = useCallback((cot: CotizacionRow) => {
    setCotizacionVinculada(cot);
    methods.setValue('clienteId', cot.cliente_id || '', opts);
    methods.setValue('modo', cot.modo, opts);
    methods.setValue('tipo', cot.tipo, opts);
    methods.setValue('incoterm', cot.incoterm, opts);
    methods.setValue('descripcionMercancia', cot.descripcion_mercancia, opts);
    methods.setValue('tipoCarga', cot.tipo_carga || 'Carga General', opts);
    methods.setValue('tipoContenedor', cot.tipo_contenedor || '', opts);
    methods.setValue('pesoKg', String(cot.peso_kg || ''), opts);
    methods.setValue('volumenM3', String(cot.volumen_m3 || ''), opts);
    methods.setValue('piezas', String(cot.piezas || ''), opts);
    methods.setValue('puertoOrigen', cot.origen || '', opts);
    methods.setValue('puertoDestino', cot.destino || '', opts);
    methods.trigger();
  }, [methods]);

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    methods.setValue('clienteId', '', opts);
    methods.setValue('modo', '', opts);
    methods.setValue('tipo', '', opts);
    methods.setValue('incoterm', 'FOB', opts);
    methods.setValue('descripcionMercancia', '', opts);
    methods.setValue('tipoCarga', 'Carga General', opts);
    methods.setValue('tipoContenedor', '', opts);
    methods.setValue('pesoKg', '', opts);
    methods.setValue('volumenM3', '', opts);
    methods.setValue('piezas', '', opts);
    methods.setValue('puertoOrigen', '', opts);
    methods.setValue('puertoDestino', '', opts);
    methods.trigger();
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
      const expediente = await resolverExpediente(v.blMaster, v.tipo);

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

      // Si hay cotización vinculada, cambiar su estado a 'Embarcada'
      if (cotizacionVinculada) {
        await supabase
          .from('cotizaciones')
          .update({ estado: 'Embarcada' as TablesInsert<'cotizaciones'>['estado'] })
          .eq('id', cotizacionVinculada.id);
      }

      registrarActividad.mutate({
        accion: 'crear',
        modulo: 'embarques',
        entidad_nombre: expediente,
        detalles: { modo: v.modo, tipo: v.tipo, cliente: selectedCliente?.nombre ?? '', cotizacion_folio: cotizacionVinculada?.folio ?? null },
      });

      toast({ title: "Embarque creado", description: `Expediente ${expediente} registrado correctamente.` });
      navigate("/embarques");
    } catch (err: any) {
      toast({ title: "Error al crear embarque", description: err.message, variant: "destructive" });
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        {/* Header fijo */}
        <div className="flex-none border-b bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nuevo Embarque</h1>
              <p className="text-sm text-muted-foreground">Completa los datos para registrar un embarque</p>
            </div>
          </div>
          <StepIndicator steps={steps} currentStep={currentStep} />
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
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
          </div>
        </div>

        {/* Footer fijo */}
        <div className="flex-none border-t bg-background p-4">
          <div className="max-w-4xl mx-auto flex justify-between">
            <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(p => p - 1) : navigate("/embarques")}>
              {currentStep === 1 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
            </Button>
            <Button
              disabled={createEmbarque.isPending}
              onClick={() => {
                if (currentStep === 1 && !validateStep1()) return;
                if (currentStep < 4) setCurrentStep(p => p + 1);
                else handleFinish();
              }}
            >
              {createEmbarque.isPending ? 'Guardando...' : currentStep === 4 ? <><Save className="h-4 w-4 mr-1" /> Crear Embarque</> : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
