import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useProveedoresForSelect,
  useCreateEmbarque,
} from "@/hooks/useEmbarques";
import { useClientesForSelect, useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { uploadFile } from '@/lib/storage';
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/useEmbarqueForm";
import { supabase } from "@/integrations/supabase/client";
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
  const createEmbarque = useCreateEmbarque();
  const registrarActividad = useRegistrarActividad();

  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<EmbarqueValidationErrors>({});
  const { form, setField, handleMsdsUpload, buildEmbarquePayload, buildConceptosVentaPayload, buildConceptosCostoPayload, documentosArchivos, setDocumentoArchivo, getDocumentosChecklist } = useEmbarqueForm();
  const { data: contactos = [] } = useContactosCliente(form.clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
  } = useConceptosForm();

  const selectedCliente = clientes.find(c => c.id === form.clienteId);

  const validateStep1 = useCallback((): boolean => {
    const errors: EmbarqueValidationErrors = {};
    if (!form.modo) errors.modo = 'Selecciona un modo de transporte';
    if (!form.tipo) errors.tipo = 'Selecciona un tipo de operación';
    if (!form.clienteId) errors.clienteId = 'Selecciona un cliente';
    if (!form.descripcionMercancia.trim()) errors.descripcionMercancia = 'Ingresa la descripción de la mercancía';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form.modo, form.tipo, form.clienteId, form.descripcionMercancia]);

  const handleFinish = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      toast({
        title: "Campos requeridos",
        description: "Completa todos los campos obligatorios marcados con * en Datos Generales.",
        variant: "destructive",
      });
      return;
    }

    let expediente: string;
    if (form.blMaster && form.blMaster.trim()) {
      const { data, error } = await supabase.rpc('resolver_expediente_por_bl', { _bl_master: form.blMaster.trim(), _tipo_op: form.tipo });
      if (error || !data) {
        toast({ title: "Error al resolver expediente", description: error?.message || "No se pudo resolver el número de referencia.", variant: "destructive" });
        return;
      }
      expediente = data;
    } else {
      const { data, error } = await supabase.rpc('generar_expediente', { tipo_op: form.tipo });
      if (error || !data) {
        toast({ title: "Error al generar expediente", description: error?.message || "No se pudo generar el número de referencia.", variant: "destructive" });
        return;
      }
      expediente = data;
    }

    try {
      // Subir archivos seleccionados a Storage
      const docPayload: { nombre: string; archivo?: string }[] = [];
      const docsChecklist = getDocumentosChecklist(form.modo);
      for (const doc of docsChecklist) {
        const file = documentosArchivos[doc.nombre];
        if (file) {
          const ruta = `embarques/${expediente}/${doc.nombre}/${Date.now()}_${file.name}`;
          await uploadFile(ruta, file);
          docPayload.push({ nombre: doc.nombre, archivo: ruta });
        } else {
          docPayload.push({ nombre: doc.nombre });
        }
      }

      await createEmbarque.mutateAsync({
        embarque: { expediente, ...buildEmbarquePayload(contactos, selectedCliente?.nombre || '', user?.email || '') },
        conceptosVenta: buildConceptosVentaPayload(conceptosVenta),
        conceptosCosto: buildConceptosCostoPayload(conceptosCosto, proveedoresDb),
        documentos: docPayload,
      });

      registrarActividad.mutate({
        accion: 'crear',
        modulo: 'embarques',
        entidad_nombre: expediente,
        detalles: { modo: form.modo, tipo: form.tipo, cliente: selectedCliente?.nombre ?? '' },
      });

      toast({ title: "Embarque creado", description: `Expediente ${expediente} registrado correctamente.` });
      navigate("/embarques");
    } catch (err: any) {
      toast({ title: "Error al crear embarque", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Embarque</h1>
          <p className="text-sm text-muted-foreground">Completa los datos para registrar un embarque</p>
        </div>
      </div>

      <StepIndicator steps={steps} currentStep={currentStep} />

      {currentStep === 1 && (
        <StepDatosGenerales
          modo={form.modo} setModo={setField('modo')}
          tipo={form.tipo} setTipo={setField('tipo')}
          clienteId={form.clienteId} setClienteId={setField('clienteId')}
          clientes={clientes} clienteNombre={selectedCliente?.nombre || ''}
          incoterm={form.incoterm} setIncoterm={setField('incoterm')}
          shipper={form.shipper} setShipper={setField('shipper')}
          shipperManual={form.shipperManual} setShipperManual={setField('shipperManual')}
          consignatario={form.consignatario} setConsignatario={setField('consignatario')}
          consignatarioManual={form.consignatarioManual} setConsignatarioManual={setField('consignatarioManual')}
          contactos={contactos}
          descripcionMercancia={form.descripcionMercancia} setDescripcionMercancia={setField('descripcionMercancia')}
          pesoKg={form.pesoKg} setPesoKg={setField('pesoKg')}
          volumenM3={form.volumenM3} setVolumenM3={setField('volumenM3')}
          piezas={form.piezas} setPiezas={setField('piezas')}
          tipoCarga={form.tipoCarga} setTipoCarga={setField('tipoCarga')}
          msdsArchivo={form.msdsArchivo} subiendoMsds={form.subiendoMsds}
           onMsdsUpload={handleMsdsUpload}
           errors={validationErrors}
         />
      )}

      {currentStep === 2 && (
        <StepDatosRuta
          modo={form.modo}
          puertoOrigen={form.puertoOrigen} setPuertoOrigen={setField('puertoOrigen')}
          puertoDestino={form.puertoDestino} setPuertoDestino={setField('puertoDestino')}
          naviera={form.naviera} setNaviera={setField('naviera')}
          agente={form.agente} setAgente={setField('agente')}
          blMaster={form.blMaster} setBlMaster={setField('blMaster')}
          blHouse={form.blHouse} setBlHouse={setField('blHouse')}
          tipoServicio={form.tipoServicio} setTipoServicio={setField('tipoServicio')}
          contenedor={form.contenedor} setContenedor={setField('contenedor')}
          tipoContenedor={form.tipoContenedor} setTipoContenedor={setField('tipoContenedor')}
          aeropuertoOrigen={form.aeropuertoOrigen} setAeropuertoOrigen={setField('aeropuertoOrigen')}
          aeropuertoDestino={form.aeropuertoDestino} setAeropuertoDestino={setField('aeropuertoDestino')}
          aerolinea={form.aerolinea} setAerolinea={setField('aerolinea')}
          mawb={form.mawb} setMawb={setField('mawb')}
          hawb={form.hawb} setHawb={setField('hawb')}
          ciudadOrigen={form.ciudadOrigen} setCiudadOrigen={setField('ciudadOrigen')}
          ciudadDestino={form.ciudadDestino} setCiudadDestino={setField('ciudadDestino')}
          transportista={form.transportista} setTransportista={setField('transportista')}
          cartaPorte={form.cartaPorte} setCartaPorte={setField('cartaPorte')}
          etd={form.etd} setEtd={setField('etd')}
          eta={form.eta} setEta={setField('eta')}
        />
      )}

      {currentStep === 3 && (
        <StepDocumentos
          documentos={getDocumentosChecklist(form.modo)}
          onFileChange={setDocumentoArchivo}
        />
      )}

      {currentStep === 4 && (
        <StepCostosPrecios
          modo={form.modo}
          conceptosVenta={conceptosVenta}
          conceptosCosto={conceptosCosto}
          proveedoresDb={proveedoresDb}
          subtotalVenta={subtotalVenta}
          totalCosto={totalCosto}
          utilidadEstimada={utilidadEstimada}
          tipoCambioUSD={form.tipoCambioUSD} setTipoCambioUSD={setField('tipoCambioUSD')}
          tipoCambioEUR={form.tipoCambioEUR} setTipoCambioEUR={setField('tipoCambioEUR')}
          updateConceptoVenta={updateConceptoVenta}
          addConceptoVenta={addConceptoVenta}
          removeConceptoVenta={removeConceptoVenta}
          updateConceptoCosto={updateConceptoCosto}
          addConceptoCosto={addConceptoCosto}
          removeConceptoCosto={removeConceptoCosto}
        />
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(p => p - 1) : navigate("/embarques")}>
          {currentStep === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        <Button
          disabled={createEmbarque.isPending}
          onClick={() => {
            if (currentStep === 1 && !validateStep1()) return;
            if (currentStep < 4) setCurrentStep(p => p + 1);
            else handleFinish();
          }}
        >
          {createEmbarque.isPending ? 'Guardando...' : currentStep === 4 ? 'Crear Embarque' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
