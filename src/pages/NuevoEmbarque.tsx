import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { clientes, proveedores } from "@/data/mockData";
import type { ModoTransporte, TipoOperacion, Incoterm } from "@/data/types";
import { containerTypes } from "@/data/containerTypes";
import { toast } from "@/hooks/use-toast";
import PortSelect from "@/components/PortSelect";
import ShippingLineSelect from "@/components/ShippingLineSelect";

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
  const [currentStep, setCurrentStep] = useState(1);
  const [modo, setModo] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [clienteId, setClienteId] = useState<string>('');
  const [shipper, setShipper] = useState<string>('');
  const [shipperManual, setShipperManual] = useState('');
  const [consignatario, setConsignatario] = useState<string>('');
  const [consignatarioManual, setConsignatarioManual] = useState('');
  const [puertoOrigen, setPuertoOrigen] = useState('');
  const [puertoDestino, setPuertoDestino] = useState('');
  const [naviera, setNaviera] = useState('');

  const selectedCliente = clientes.find(c => c.id === clienteId);
  const contactos = selectedCliente?.contactos || [];

  const handleFinish = () => {
    toast({ title: "Embarque creado", description: "El nuevo embarque se ha registrado correctamente." });
    navigate("/embarques");
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
                <Label>Incoterm</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Shipper (Exportador)</Label>
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
                <Label>Consignatario</Label>
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
                <Label>Descripción de la Mercancía</Label>
                <Input placeholder="Descripción detallada" />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Volumen (m³)</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Piezas</Label>
                <Input type="number" placeholder="0" />
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
                <div className="space-y-2"><Label>Puerto Origen</Label><PortSelect value={puertoOrigen} onValueChange={setPuertoOrigen} placeholder="Seleccionar puerto origen" /></div>
                <div className="space-y-2"><Label>Puerto Destino</Label><PortSelect value={puertoDestino} onValueChange={setPuertoDestino} placeholder="Seleccionar puerto destino" /></div>
                <div className="space-y-2"><Label>Naviera</Label><ShippingLineSelect value={naviera} onValueChange={setNaviera} /></div>
                <div className="space-y-2"><Label># BL Master</Label><Input placeholder="Número de BL" /></div>
                <div className="space-y-2"><Label># BL House</Label><Input /></div>
                <div className="space-y-2">
                  <Label>Tipo de Servicio</Label>
                  <Select><SelectTrigger><SelectValue placeholder="FCL / LCL" /></SelectTrigger>
                    <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label># Contenedor</Label><Input /></div>
                <div className="space-y-2">
                  <Label>Tipo Contenedor</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>{containerTypes.map(ct => <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>)}
              {modo === 'Aéreo' && (<>
                <div className="space-y-2"><Label>Aeropuerto Origen</Label><Input placeholder="Ej: Incheon (ICN)" /></div>
                <div className="space-y-2"><Label>Aeropuerto Destino</Label><Input placeholder="Ej: AICM (MEX)" /></div>
                <div className="space-y-2"><Label>Aerolínea</Label><Input /></div>
                <div className="space-y-2"><Label># MAWB</Label><Input /></div>
                <div className="space-y-2"><Label># HAWB</Label><Input /></div>
              </>)}
              {modo === 'Terrestre' && (<>
                <div className="space-y-2"><Label>Ciudad Origen</Label><Input placeholder="Ej: Houston, TX" /></div>
                <div className="space-y-2"><Label>Ciudad Destino</Label><Input placeholder="Ej: León, Guanajuato" /></div>
                <div className="space-y-2"><Label>Transportista</Label><Input /></div>
                <div className="space-y-2"><Label># Carta Porte</Label><Input /></div>
              </>)}
              <div className="space-y-2"><Label>ETD (Fecha Salida)</Label><Input type="date" /></div>
              <div className="space-y-2"><Label>ETA (Fecha Llegada Estimada)</Label><Input type="date" /></div>
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
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground">
                  <span>Concepto</span><span>Cantidad</span><span>P. Unitario</span><span>Moneda</span><span>Total</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <Input placeholder="Flete marítimo" className="text-sm" />
                  <Input type="number" placeholder="1" className="text-sm" />
                  <Input type="number" placeholder="0.00" className="text-sm" />
                  <Select><SelectTrigger className="text-sm"><SelectValue placeholder="MXN" /></SelectTrigger>
                    <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select>
                  <Input readOnly placeholder="$0.00" className="text-sm bg-muted" />
                </div>
                <Button variant="outline" size="sm">+ Agregar concepto</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground">
                  <span>Proveedor</span><span>Concepto</span><span>Monto</span><span>Moneda</span><span>Total</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <Select><SelectTrigger className="text-sm"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                    <SelectContent>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Flete" className="text-sm" />
                  <Input type="number" placeholder="0.00" className="text-sm" />
                  <Select><SelectTrigger className="text-sm"><SelectValue placeholder="MXN" /></SelectTrigger>
                    <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select>
                  <Input readOnly placeholder="$0.00" className="text-sm bg-muted" />
                </div>
                <Button variant="outline" size="sm">+ Agregar costo</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-muted-foreground">Tipo de Cambio USD</p><Input type="number" defaultValue="17.25" className="text-center mt-1" /></div>
                <div><p className="text-xs text-muted-foreground">Tipo de Cambio EUR</p><Input type="number" defaultValue="18.50" className="text-center mt-1" /></div>
                <div><p className="text-xs text-muted-foreground">Utilidad Estimada</p><p className="text-xl font-bold text-success mt-2">$0.00</p></div>
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
        <Button onClick={() => currentStep < 4 ? setCurrentStep(s => s + 1) : handleFinish()}>
          {currentStep === 4 ? 'Crear Embarque' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
