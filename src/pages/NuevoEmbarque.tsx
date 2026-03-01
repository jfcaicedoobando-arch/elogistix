import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useClientesForSelect,
  useProveedoresForSelect,
  useCreateEmbarque,
} from "@/hooks/useEmbarques";
import { useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { getDocsForMode } from "@/data/embarqueConstants";
import { StepIndicator } from "@/components/embarque/StepIndicator";
import { StepDatosGenerales } from "@/components/embarque/StepDatosGenerales";
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
  const { data: rates } = useExchangeRates();

  const [currentStep, setCurrentStep] = useState(1);
  const [modo, setModo] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [clienteId, setClienteId] = useState<string>('');
  const [shipper, setShipper] = useState<string>('');
  const [shipperManual, setShipperManual] = useState('');
  const [consignatario, setConsignatario] = useState<string>('');
  const [consignatarioManual, setConsignatarioManual] = useState('');
  const [incoterm, setIncoterm] = useState<string>('');
  const [descripcionMercancia, setDescripcionMercancia] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [volumenM3, setVolumenM3] = useState('');
  const [piezas, setPiezas] = useState('');
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

  useEffect(() => {
    if (rates) {
      setTipoCambioUSD(String(rates.usdMxn));
      setTipoCambioEUR(String(rates.eurMxn));
    }
  }, [rates]);

  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  interface ConceptoVentaRow { id: number; concepto: string; cantidad: number; precioUnitario: number; moneda: string; }
  interface ConceptoCostoRow { id: number; proveedorId: string; concepto: string; monto: number; moneda: string; }
  const [conceptosVenta, setConceptosVenta] = useState<ConceptoVentaRow[]>([
    { id: 1, concepto: '', cantidad: 1, precioUnitario: 0, moneda: 'MXN' },
  ]);
  const [conceptosCosto, setConceptosCosto] = useState<ConceptoCostoRow[]>([
    { id: 1, proveedorId: '', concepto: '', monto: 0, moneda: 'MXN' },
  ]);
  const [nextVentaId, setNextVentaId] = useState(2);
  const [nextCostoId, setNextCostoId] = useState(2);

  const updateConceptoVenta = (id: number, field: keyof ConceptoVentaRow, value: string | number) => {
    setConceptosVenta(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const addConceptoVenta = () => {
    setConceptosVenta(prev => [...prev, { id: nextVentaId, concepto: '', cantidad: 1, precioUnitario: 0, moneda: 'MXN' }]);
    setNextVentaId(n => n + 1);
  };
  const removeConceptoVenta = (id: number) => setConceptosVenta(prev => prev.filter(c => c.id !== id));
  const updateConceptoCosto = (id: number, field: keyof ConceptoCostoRow, value: string | number) => {
    setConceptosCosto(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const addConceptoCosto = () => {
    setConceptosCosto(prev => [...prev, { id: nextCostoId, proveedorId: '', concepto: '', monto: 0, moneda: 'MXN' }]);
    setNextCostoId(n => n + 1);
  };
  const removeConceptoCosto = (id: number) => setConceptosCosto(prev => prev.filter(c => c.id !== id));

  const subtotalVenta = conceptosVenta.reduce((acc, c) => acc + (c.cantidad * c.precioUnitario), 0);
  const totalCosto = conceptosCosto.reduce((acc, c) => acc + c.monto, 0);
  const utilidadEstimada = subtotalVenta - totalCosto;

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const resolveShipper = () => {
    if (shipper === '__otro__') return shipperManual.trim();
    const ct = contactos.find(c => c.id === shipper);
    return ct ? `${ct.nombre} — ${ct.tipo} (${ct.pais})` : shipper;
  };
  const resolveConsignatario = () => {
    if (consignatario === '__otro__') return consignatarioManual.trim();
    const ct = contactos.find(c => c.id === consignatario);
    return ct ? `${ct.nombre} — ${ct.tipo} (${ct.pais})` : consignatario;
  };

  const isStep1Valid = () => {
    const shipperVal = shipper === '__otro__' ? shipperManual.trim() : shipper;
    const consigVal = consignatario === '__otro__' ? consignatarioManual.trim() : consignatario;
    return modo && tipo && clienteId && incoterm && shipperVal && consigVal && descripcionMercancia.trim() && pesoKg && volumenM3 && piezas;
  };

  const isStep2Valid = () => {
    if (modo === 'Marítimo' || !modo) {
      return puertoOrigen && puertoDestino && naviera && tipoServicio && contenedor && tipoContenedor && etd && eta;
    }
    return etd && eta;
  };

  const generateExpediente = () => {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `EXP-${year}-${rand}`;
  };

  const handleFinish = async () => {
    const expediente = generateExpediente();
    const docsForMode = getDocsForMode(modo);

    try {
      await createEmbarque.mutateAsync({
        embarque: {
          expediente,
          cliente_id: clienteId,
          cliente_nombre: selectedCliente?.nombre || '',
          modo: modo as any,
          tipo: tipo as any,
          shipper: resolveShipper(),
          consignatario: resolveConsignatario(),
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
          operador: user?.email || '',
        },
        conceptosVenta: conceptosVenta
          .filter(cv => cv.concepto)
          .map(cv => ({
            descripcion: cv.concepto,
            cantidad: cv.cantidad,
            precio_unitario: cv.precioUnitario,
            moneda: cv.moneda as any,
            total: cv.cantidad * cv.precioUnitario,
          })),
        conceptosCosto: conceptosCosto
          .filter(cc => cc.concepto)
          .map(cc => ({
            proveedor_id: cc.proveedorId || null,
            proveedor_nombre: proveedoresDb.find(p => p.id === cc.proveedorId)?.nombre || '',
            concepto: cc.concepto,
            monto: cc.monto,
            moneda: cc.moneda as any,
          })),
        documentos: docsForMode.map(d => ({ nombre: d })),
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
        <h1 className="text-2xl font-bold">Nuevo Embarque</h1>
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

      {currentStep === 3 && <StepDocumentos modo={modo} />}

      {currentStep === 4 && (
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
        <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : navigate("/embarques")}>
          {currentStep === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        <Button
          disabled={(currentStep === 1 && !isStep1Valid()) || (currentStep === 2 && !isStep2Valid()) || createEmbarque.isPending}
          onClick={() => {
            if (currentStep === 1 && !isStep1Valid()) {
              toast({ title: "Campos incompletos", description: "Completa todos los campos obligatorios (*) antes de continuar.", variant: "destructive" });
              return;
            }
            if (currentStep === 2 && !isStep2Valid()) {
              toast({ title: "Campos incompletos", description: "Completa todos los campos obligatorios (*) de la ruta antes de continuar.", variant: "destructive" });
              return;
            }
            currentStep < 4 ? setCurrentStep(s => s + 1) : handleFinish();
          }}
        >
          {createEmbarque.isPending ? 'Guardando...' : currentStep === 4 ? 'Crear Embarque' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
