import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { containerTypes } from "@/data/containerTypes";
import { toast } from "@/hooks/use-toast";
import PortSelect from "@/components/PortSelect";
import ShippingLineSelect from "@/components/ShippingLineSelect";
import {
  useClientesForSelect,
  useProveedoresForSelect,
  useContactosCliente,
  useCreateEmbarque,
} from "@/hooks/useEmbarques";
import { useAuth } from "@/contexts/AuthContext";
import type { ModoTransporte, TipoOperacion, Incoterm } from "@/data/types";

const MODOS: ModoTransporte[] = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS: TipoOperacion[] = ['Importación', 'Exportación', 'Nacional'];
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];

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

  const CONCEPTOS_MARITIMOS = ['Flete marítimo', 'Revalidación'];

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
    const docsForMode = modo === 'Marítimo' || !modo
      ? ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros']
      : modo === 'Aéreo'
        ? ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial']
        : ['Carta Porte', 'Factura', 'Lista de Empaque'];

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

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep > step.num ? 'bg-success text-success-foreground' :
                currentStep === step.num ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {currentStep > step.num ? <Check className="h-4 w-4" /> : step.num}
              </div>
              <span className={`text-sm hidden sm:inline ${currentStep === step.num ? 'font-medium' : 'text-muted-foreground'}`}>
                {step.title}
              </span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-3 ${currentStep > step.num ? 'bg-success' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader><CardTitle>Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modo de Transporte *</Label>
                <Select value={modo} onValueChange={setModo}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar modo" /></SelectTrigger>
                  <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Operación *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incoterm *</Label>
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Shipper (Exportador) *</Label>
                <Select value={shipper} onValueChange={(v) => { setShipper(v); if (v !== '__otro__') setShipperManual(''); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar shipper" /></SelectTrigger>
                  <SelectContent>
                    {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                    <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
                  </SelectContent>
                </Select>
                {shipper === '__otro__' && <Input placeholder="Nombre del exportador" value={shipperManual} onChange={e => setShipperManual(e.target.value)} className="mt-2" />}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Consignatario *</Label>
                <Select value={consignatario} onValueChange={(v) => { setConsignatario(v); if (v !== '__otro__') setConsignatarioManual(''); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar consignatario" /></SelectTrigger>
                  <SelectContent>
                    {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                    <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
                  </SelectContent>
                </Select>
                {consignatario === '__otro__' && <Input placeholder="Nombre del consignatario" value={consignatarioManual} onChange={e => setConsignatarioManual(e.target.value)} className="mt-2" />}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción de la Mercancía *</Label>
                <Input placeholder="Descripción detallada" value={descripcionMercancia} onChange={e => setDescripcionMercancia(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg) *</Label>
                <Input type="number" placeholder="0" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Volumen (m³) *</Label>
                <Input type="number" placeholder="0" value={volumenM3} onChange={e => setVolumenM3(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Piezas *</Label>
                <Input type="number" placeholder="0" value={piezas} onChange={e => setPiezas(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <Card>
          <CardHeader><CardTitle>Datos de Ruta {modo && `— ${modo}`}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(modo === 'Marítimo' || !modo) && (<>
                <div className="space-y-2"><Label>Puerto Origen *</Label><PortSelect value={puertoOrigen} onValueChange={setPuertoOrigen} placeholder="Seleccionar puerto origen" /></div>
                <div className="space-y-2"><Label>Puerto Destino *</Label><PortSelect value={puertoDestino} onValueChange={setPuertoDestino} placeholder="Seleccionar puerto destino" /></div>
                <div className="space-y-2"><Label>Naviera *</Label><ShippingLineSelect value={naviera} onValueChange={setNaviera} /></div>
                <div className="space-y-2"><Label># BL Master</Label><Input placeholder="Número de BL" value={blMaster} onChange={e => setBlMaster(e.target.value)} /></div>
                <div className="space-y-2"><Label># BL House</Label><Input value={blHouse} onChange={e => setBlHouse(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Tipo de Servicio *</Label>
                  <Select value={tipoServicio} onValueChange={setTipoServicio}><SelectTrigger><SelectValue placeholder="FCL / LCL" /></SelectTrigger>
                    <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label># Contenedor *</Label><Input value={contenedor} onChange={e => setContenedor(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Tipo Contenedor *</Label>
                  <Select value={tipoContenedor} onValueChange={setTipoContenedor}><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>{containerTypes.map(ct => <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>)}
              {modo === 'Aéreo' && (<>
                <div className="space-y-2"><Label>Aeropuerto Origen</Label><Input placeholder="Ej: Incheon (ICN)" value={aeropuertoOrigen} onChange={e => setAeropuertoOrigen(e.target.value)} /></div>
                <div className="space-y-2"><Label>Aeropuerto Destino</Label><Input placeholder="Ej: AICM (MEX)" value={aeropuertoDestino} onChange={e => setAeropuertoDestino(e.target.value)} /></div>
                <div className="space-y-2"><Label>Aerolínea</Label><Input value={aerolinea} onChange={e => setAerolinea(e.target.value)} /></div>
                <div className="space-y-2"><Label># MAWB</Label><Input value={mawb} onChange={e => setMawb(e.target.value)} /></div>
                <div className="space-y-2"><Label># HAWB</Label><Input value={hawb} onChange={e => setHawb(e.target.value)} /></div>
              </>)}
              {modo === 'Terrestre' && (<>
                <div className="space-y-2"><Label>Ciudad Origen</Label><Input placeholder="Ej: Houston, TX" value={ciudadOrigen} onChange={e => setCiudadOrigen(e.target.value)} /></div>
                <div className="space-y-2"><Label>Ciudad Destino</Label><Input placeholder="Ej: León, Guanajuato" value={ciudadDestino} onChange={e => setCiudadDestino(e.target.value)} /></div>
                <div className="space-y-2"><Label>Transportista</Label><Input value={transportista} onChange={e => setTransportista(e.target.value)} /></div>
                <div className="space-y-2"><Label># Carta Porte</Label><Input value={cartaPorte} onChange={e => setCartaPorte(e.target.value)} /></div>
              </>)}
              <div className="space-y-2"><Label>ETD (Fecha Salida) *</Label><Input type="date" value={etd} onChange={e => setEtd(e.target.value)} /></div>
              <div className="space-y-2"><Label>ETA (Fecha Llegada Estimada) *</Label><Input type="date" value={eta} onChange={e => setEta(e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {currentStep === 3 && (
        <Card>
          <CardHeader><CardTitle>Documentos Requeridos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(modo === 'Marítimo' || !modo ? ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'] :
                modo === 'Aéreo' ? ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'] :
                ['Carta Porte', 'Factura', 'Lista de Empaque']
              ).map((doc) => (
                <div key={doc} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-destructive" />
                    <span className="text-sm font-medium">{doc}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                    <Button variant="outline" size="sm">Subir</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px_100px_90px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Concepto</span><span>Cantidad</span><span>P. Unitario</span><span>Moneda</span><span>Total</span><span></span>
                </div>
                {conceptosVenta.map(cv => (
                  <div key={cv.id} className="grid grid-cols-[1fr_80px_100px_90px_100px_40px] gap-2 items-center">
                    {modo === 'Marítimo' ? (
                      <Select value={cv.concepto} onValueChange={v => updateConceptoVenta(cv.id, 'concepto', v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>{CONCEPTOS_MARITIMOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input placeholder="Concepto" className="text-sm" value={cv.concepto} onChange={e => updateConceptoVenta(cv.id, 'concepto', e.target.value)} />
                    )}
                    <Input type="number" min={1} className="text-sm" value={cv.cantidad} onChange={e => updateConceptoVenta(cv.id, 'cantidad', Number(e.target.value))} />
                    <Input type="number" min={0} step="0.01" className="text-sm" value={cv.precioUnitario || ''} onChange={e => updateConceptoVenta(cv.id, 'precioUnitario', Number(e.target.value))} />
                    <Select value={cv.moneda} onValueChange={v => updateConceptoVenta(cv.id, 'moneda', v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                    </Select>
                    <Input readOnly value={`$${(cv.cantidad * cv.precioUnitario).toFixed(2)}`} className="text-sm bg-muted" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoVenta(cv.id)} disabled={conceptosVenta.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addConceptoVenta}>+ Agregar concepto</Button>
                <div className="border-t pt-3 mt-3 text-sm text-right">
                  <div className="flex justify-end gap-4"><span className="font-semibold">Subtotal (Sin IVA):</span><span className="font-bold w-28 text-right">${subtotalVenta.toFixed(2)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_1fr_100px_90px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Proveedor</span><span>Concepto</span><span>Monto</span><span>Moneda</span><span>Total</span><span></span>
                </div>
                {conceptosCosto.map(cc => (
                  <div key={cc.id} className="grid grid-cols-[1fr_1fr_100px_90px_100px_40px] gap-2 items-center">
                    <Select value={cc.proveedorId} onValueChange={v => updateConceptoCosto(cc.id, 'proveedorId', v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                      <SelectContent>{proveedoresDb.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    {modo === 'Marítimo' ? (
                      <Select value={cc.concepto} onValueChange={v => updateConceptoCosto(cc.id, 'concepto', v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>{CONCEPTOS_MARITIMOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input placeholder="Concepto" className="text-sm" value={cc.concepto} onChange={e => updateConceptoCosto(cc.id, 'concepto', e.target.value)} />
                    )}
                    <Input type="number" min={0} step="0.01" className="text-sm" value={cc.monto || ''} onChange={e => updateConceptoCosto(cc.id, 'monto', Number(e.target.value))} />
                    <Select value={cc.moneda} onValueChange={v => updateConceptoCosto(cc.id, 'moneda', v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                    </Select>
                    <Input readOnly value={`$${cc.monto.toFixed(2)}`} className="text-sm bg-muted" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoCosto(cc.id)} disabled={conceptosCosto.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addConceptoCosto}>+ Agregar costo</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-muted-foreground">Tipo de Cambio USD</p><Input type="number" value={tipoCambioUSD} onChange={e => setTipoCambioUSD(e.target.value)} className="text-center mt-1" /></div>
                <div><p className="text-xs text-muted-foreground">Tipo de Cambio EUR</p><Input type="number" value={tipoCambioEUR} onChange={e => setTipoCambioEUR(e.target.value)} className="text-center mt-1" /></div>
                <div><p className="text-xs text-muted-foreground">Utilidad Estimada</p><p className={`text-xl font-bold mt-2 ${utilidadEstimada >= 0 ? 'text-success' : 'text-destructive'}`}>${utilidadEstimada.toFixed(2)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
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
