import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useProveedoresForSelect,
  useUpdateEmbarque,
} from "@/hooks/useEmbarques";
import { useClientesForSelect, useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/useEmbarqueForm";
import { StepIndicator } from "@/components/embarque/StepIndicator";
import { StepDatosGenerales } from "@/components/embarque/StepDatosGenerales";
import { StepDatosRuta } from "@/components/embarque/StepDatosRuta";
import { StepCostosPrecios } from "@/components/embarque/StepCostosPrecios";

const TOTAL_STEPS = 3;
const steps = [
  { title: 'Datos Generales', num: 1 },
  { title: 'Datos de Ruta', num: 2 },
  { title: 'Costos y Pricing', num: 3 },
];

export default function EditarEmbarque() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVentaDb = [], isLoading: cargandoVenta } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCostoDb = [], isLoading: cargandoCosto } = useEmbarqueConceptosCosto(id);
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const updateEmbarque = useUpdateEmbarque();
  const registrarActividad = useRegistrarActividad();

  const [initialized, setInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const { form, setField, handleMsdsUpload, inicializarDesdeEmbarque, buildEmbarquePayload, buildConceptosVentaPayload, buildConceptosCostoPayload } = useEmbarqueForm();
  const { data: contactos = [] } = useContactosCliente(form.clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
    inicializarVenta, inicializarCosto,
  } = useConceptosForm();

  useEffect(() => {
    if (!embarque || initialized) return;
    inicializarDesdeEmbarque(embarque);
    setInitialized(true);
  }, [embarque, initialized]);

  useEffect(() => {
    if (!initialized || conceptosVentaDb.length === 0) return;
    inicializarVenta(conceptosVentaDb.map((v, i) => ({
      id: i + 1,
      concepto: v.descripcion,
      cantidad: v.cantidad,
      precioUnitario: Number(v.precio_unitario),
      moneda: v.moneda,
    })));
  }, [conceptosVentaDb, initialized]);

  useEffect(() => {
    if (!initialized || conceptosCostoDb.length === 0) return;
    inicializarCosto(conceptosCostoDb.map((c, i) => ({
      id: i + 1,
      proveedorId: c.proveedor_id ?? '',
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
    })));
  }, [conceptosCostoDb, initialized]);

  const selectedCliente = clientes.find(c => c.id === form.clienteId);

  const handleSave = async () => {
    if (!id || !embarque) return;
    try {
      await updateEmbarque.mutateAsync({
        id,
        embarque: buildEmbarquePayload(contactos, selectedCliente?.nombre || '', user?.email || ''),
        conceptosVenta: buildConceptosVentaPayload(conceptosVenta),
        conceptosCosto: buildConceptosCostoPayload(conceptosCosto, proveedoresDb),
      });

      registrarActividad.mutate({
        accion: 'editar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque.expediente,
        detalles: { cliente: selectedCliente?.nombre ?? '', modo: form.modo, tipo: form.tipo },
      });

      toast({ title: "Embarque actualizado", description: `${embarque.expediente} guardado correctamente.` });
      navigate(`/embarques/${id}`);
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading || cargandoVenta || cargandoCosto) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!embarque) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/embarques")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/embarques/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar Embarque</h1>
          <p className="text-sm text-muted-foreground">{embarque.expediente}</p>
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

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(p => p - 1) : navigate(`/embarques/${id}`)}>
          {currentStep === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        <Button
          disabled={updateEmbarque.isPending}
          onClick={() => currentStep < TOTAL_STEPS ? setCurrentStep(p => p + 1) : handleSave()}
        >
          {updateEmbarque.isPending ? 'Guardando...' : currentStep === TOTAL_STEPS ? 'Guardar Cambios' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
