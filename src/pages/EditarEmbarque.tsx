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
  useClientesForSelect,
  useProveedoresForSelect,
  useUpdateEmbarque,
} from "@/hooks/useEmbarques";
import { useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { uploadFile } from "@/lib/storage";
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
  const [modo, setModo] = useState('');
  const [tipo, setTipo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [shipper, setShipper] = useState('');
  const [shipperManual, setShipperManual] = useState('');
  const [consignatario, setConsignatario] = useState('');
  const [consignatarioManual, setConsignatarioManual] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [descripcionMercancia, setDescripcionMercancia] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [volumenM3, setVolumenM3] = useState('');
  const [piezas, setPiezas] = useState('');
  const [tipoCarga, setTipoCarga] = useState('Carga General');
  const [msdsArchivo, setMsdsArchivo] = useState<string | null>(null);
  const [subiendoMsds, setSubiendoMsds] = useState(false);
  const [puertoOrigen, setPuertoOrigen] = useState('');
  const [puertoDestino, setPuertoDestino] = useState('');
  const [naviera, setNaviera] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [contenedor, setContenedor] = useState('');
  const [tipoContenedor, setTipoContenedor] = useState('');
  const [blMaster, setBlMaster] = useState('');
  const [blHouse, setBlHouse] = useState('');
  const [aeropuertoOrigen, setAeropuertoOrigen] = useState('');
  const [aeropuertoDestino, setAeropuertoDestino] = useState('');
  const [aerolinea, setAerolinea] = useState('');
  const [mawb, setMawb] = useState('');
  const [hawb, setHawb] = useState('');
  const [ciudadOrigen, setCiudadOrigen] = useState('');
  const [ciudadDestino, setCiudadDestino] = useState('');
  const [transportista, setTransportista] = useState('');
  const [cartaPorte, setCartaPorte] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [tipoCambioUSD, setTipoCambioUSD] = useState('17.25');
  const [tipoCambioEUR, setTipoCambioEUR] = useState('18.50');

  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
    inicializarVenta, inicializarCosto,
  } = useConceptosForm();

  // Pre-llenar con datos existentes
  useEffect(() => {
    if (!embarque || initialized) return;
    setModo(embarque.modo);
    setTipo(embarque.tipo);
    setClienteId(embarque.cliente_id);
    setShipper(embarque.shipper);
    setConsignatario(embarque.consignatario);
    setIncoterm(embarque.incoterm);
    setDescripcionMercancia(embarque.descripcion_mercancia);
    setPesoKg(String(embarque.peso_kg));
    setVolumenM3(String(embarque.volumen_m3));
    setPiezas(String(embarque.piezas));
    setTipoCarga((embarque as any).tipo_carga ?? 'Carga General');
    setMsdsArchivo((embarque as any).msds_archivo ?? null);
    setPuertoOrigen(embarque.puerto_origen ?? '');
    setPuertoDestino(embarque.puerto_destino ?? '');
    setNaviera(embarque.naviera ?? '');
    setTipoServicio(embarque.tipo_servicio ?? '');
    setContenedor(embarque.contenedor ?? '');
    setTipoContenedor(embarque.tipo_contenedor ?? '');
    setBlMaster(embarque.bl_master ?? '');
    setBlHouse(embarque.bl_house ?? '');
    setAeropuertoOrigen(embarque.aeropuerto_origen ?? '');
    setAeropuertoDestino(embarque.aeropuerto_destino ?? '');
    setAerolinea(embarque.aerolinea ?? '');
    setMawb(embarque.mawb ?? '');
    setHawb(embarque.hawb ?? '');
    setCiudadOrigen(embarque.ciudad_origen ?? '');
    setCiudadDestino(embarque.ciudad_destino ?? '');
    setTransportista(embarque.transportista ?? '');
    setCartaPorte(embarque.carta_porte ?? '');
    setEtd(embarque.etd ?? '');
    setEta(embarque.eta ?? '');
    setTipoCambioUSD(String(embarque.tipo_cambio_usd));
    setTipoCambioEUR(String(embarque.tipo_cambio_eur));
    setInitialized(true);
  }, [embarque, initialized]);

  // Pre-llenar conceptos de venta
  useEffect(() => {
    if (!initialized || conceptosVentaDb.length === 0) return;
    inicializarVenta(conceptosVentaDb.map((conceptoVenta, indice) => ({
      id: indice + 1,
      concepto: conceptoVenta.descripcion,
      cantidad: conceptoVenta.cantidad,
      precioUnitario: Number(conceptoVenta.precio_unitario),
      moneda: conceptoVenta.moneda,
    })));
  }, [conceptosVentaDb, initialized]);

  // Pre-llenar conceptos de costo
  useEffect(() => {
    if (!initialized || conceptosCostoDb.length === 0) return;
    inicializarCosto(conceptosCostoDb.map((conceptoCosto, indice) => ({
      id: indice + 1,
      proveedorId: conceptoCosto.proveedor_id ?? '',
      concepto: conceptoCosto.concepto,
      monto: Number(conceptoCosto.monto),
      moneda: conceptoCosto.moneda,
    })));
  }, [conceptosCostoDb, initialized]);

  const selectedCliente = clientes.find(cliente => cliente.id === clienteId);

  const handleMsdsUpload = async (archivo: File) => {
    setSubiendoMsds(true);
    try {
      const ruta = `embarques/msds/${Date.now()}_${archivo.name}`;
      await uploadFile(ruta, archivo);
      setMsdsArchivo(ruta);
    } catch {
      toast({ title: "Error al subir MSDS", variant: "destructive" });
    } finally {
      setSubiendoMsds(false);
    }
  };

  const handleSave = async () => {
    if (!id || !embarque) return;
    try {
      await updateEmbarque.mutateAsync({
        id,
        embarque: {
          cliente_id: clienteId,
          cliente_nombre: selectedCliente?.nombre || '',
          modo: modo as any,
          tipo: tipo as any,
          shipper,
          consignatario,
          incoterm: incoterm as any,
          descripcion_mercancia: descripcionMercancia,
          peso_kg: Number(pesoKg),
          volumen_m3: Number(volumenM3),
          piezas: Number(piezas),
          puerto_origen: puertoOrigen || null,
          puerto_destino: puertoDestino || null,
          naviera: naviera || null,
          bl_master: blMaster || null,
          bl_house: blHouse || null,
          tipo_servicio: (tipoServicio as any) || null,
          contenedor: contenedor || null,
          tipo_contenedor: tipoContenedor || null,
          aeropuerto_origen: aeropuertoOrigen || null,
          aeropuerto_destino: aeropuertoDestino || null,
          aerolinea: aerolinea || null,
          mawb: mawb || null,
          hawb: hawb || null,
          ciudad_origen: ciudadOrigen || null,
          ciudad_destino: ciudadDestino || null,
          transportista: transportista || null,
          carta_porte: cartaPorte || null,
          etd: etd || null,
          eta: eta || null,
          tipo_cambio_usd: Number(tipoCambioUSD),
          tipo_cambio_eur: Number(tipoCambioEUR),
          tipo_carga: tipoCarga,
          msds_archivo: msdsArchivo,
          operador: user?.email || '',
        },
        conceptosVenta: conceptosVenta
          .filter(venta => venta.concepto)
          .map(venta => ({
            descripcion: venta.concepto,
            cantidad: venta.cantidad,
            precio_unitario: venta.precioUnitario,
            moneda: venta.moneda as any,
            total: venta.cantidad * venta.precioUnitario,
          })),
        conceptosCosto: conceptosCosto
          .filter(costo => costo.concepto)
          .map(costo => ({
            proveedor_id: costo.proveedorId || null,
            proveedor_nombre: proveedoresDb.find(proveedor => proveedor.id === costo.proveedorId)?.nombre || '',
            concepto: costo.concepto,
            monto: costo.monto,
            moneda: costo.moneda as any,
          })),
      });

      registrarActividad.mutate({
        accion: 'editar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque.expediente,
        detalles: { cliente: selectedCliente?.nombre ?? '', modo, tipo },
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
          modo={modo} setModo={setModo}
          tipo={tipo} setTipo={setTipo}
          clienteId={clienteId} setClienteId={setClienteId}
          clientes={clientes}
          incoterm={incoterm} setIncoterm={setIncoterm}
          shipper={shipper} setShipper={setShipper}
          shipperManual={shipperManual} setShipperManual={setShipperManual}
          consignatario={consignatario} setConsignatario={setConsignatario}
          consignatarioManual={consignatarioManual} setConsignatarioManual={setConsignatarioManual}
          contactos={contactos}
          descripcionMercancia={descripcionMercancia} setDescripcionMercancia={setDescripcionMercancia}
          pesoKg={pesoKg} setPesoKg={setPesoKg}
          volumenM3={volumenM3} setVolumenM3={setVolumenM3}
          piezas={piezas} setPiezas={setPiezas}
          tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
          msdsArchivo={msdsArchivo} subiendoMsds={subiendoMsds}
          onMsdsUpload={handleMsdsUpload}
        />
      )}

      {currentStep === 2 && (
        <StepDatosRuta
          modo={modo}
          puertoOrigen={puertoOrigen} setPuertoOrigen={setPuertoOrigen}
          puertoDestino={puertoDestino} setPuertoDestino={setPuertoDestino}
          naviera={naviera} setNaviera={setNaviera}
          blMaster={blMaster} setBlMaster={setBlMaster}
          blHouse={blHouse} setBlHouse={setBlHouse}
          tipoServicio={tipoServicio} setTipoServicio={setTipoServicio}
          contenedor={contenedor} setContenedor={setContenedor}
          tipoContenedor={tipoContenedor} setTipoContenedor={setTipoContenedor}
          aeropuertoOrigen={aeropuertoOrigen} setAeropuertoOrigen={setAeropuertoOrigen}
          aeropuertoDestino={aeropuertoDestino} setAeropuertoDestino={setAeropuertoDestino}
          aerolinea={aerolinea} setAerolinea={setAerolinea}
          mawb={mawb} setMawb={setMawb}
          hawb={hawb} setHawb={setHawb}
          ciudadOrigen={ciudadOrigen} setCiudadOrigen={setCiudadOrigen}
          ciudadDestino={ciudadDestino} setCiudadDestino={setCiudadDestino}
          transportista={transportista} setTransportista={setTransportista}
          cartaPorte={cartaPorte} setCartaPorte={setCartaPorte}
          etd={etd} setEtd={setEtd}
          eta={eta} setEta={setEta}
        />
      )}

      {currentStep === 3 && (
        <StepCostosPrecios
          modo={modo}
          conceptosVenta={conceptosVenta}
          conceptosCosto={conceptosCosto}
          proveedoresDb={proveedoresDb}
          subtotalVenta={subtotalVenta}
          totalCosto={totalCosto}
          utilidadEstimada={utilidadEstimada}
          tipoCambioUSD={tipoCambioUSD} setTipoCambioUSD={setTipoCambioUSD}
          tipoCambioEUR={tipoCambioEUR} setTipoCambioEUR={setTipoCambioEUR}
          updateConceptoVenta={updateConceptoVenta}
          addConceptoVenta={addConceptoVenta}
          removeConceptoVenta={removeConceptoVenta}
          updateConceptoCosto={updateConceptoCosto}
          addConceptoCosto={addConceptoCosto}
          removeConceptoCosto={removeConceptoCosto}
        />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(paso => paso - 1) : navigate(`/embarques/${id}`)}>
          {currentStep === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        <Button
          disabled={updateEmbarque.isPending}
          onClick={() => {
            if (currentStep < TOTAL_STEPS) {
              setCurrentStep(paso => paso + 1);
            } else {
              handleSave();
            }
          }}
        >
          {updateEmbarque.isPending ? 'Guardando...' : currentStep === TOTAL_STEPS ? 'Guardar Cambios' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
