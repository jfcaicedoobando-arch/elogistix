import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useEmbarques";
import { useCreateCotizacion, ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/storage";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Trash2, ArrowLeft, Save, CalendarIcon } from "lucide-react";
import PortSelect from "@/components/PortSelect";

import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";

const MODOS = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS = ['Importación', 'Exportación', 'Nacional'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];
const MONEDAS = ['MXN', 'USD', 'EUR'];

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const crearCotizacion = useCreateCotizacion();
  const registrarActividad = useRegistrarActividad();

  // Destinatario
  const [esProspecto, setEsProspecto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [prospectoEmpresa, setProspectoEmpresa] = useState("");
  const [prospectoContacto, setProspectoContacto] = useState("");
  const [prospectoEmail, setProspectoEmail] = useState("");
  const [prospectoTelefono, setProspectoTelefono] = useState("");

  // Datos generales
  const [modo, setModo] = useState("Marítimo");
  const [tipo, setTipo] = useState("Importación");
  const [incoterm, setIncoterm] = useState("FOB");
  const [moneda, setMoneda] = useState("MXN");

  // Mercancía — compartidos
  const [tipoCarga, setTipoCarga] = useState("Carga General");
  const [sectorEconomico, setSectorEconomico] = useState("");
  const [descripcionAdicional, setDescripcionAdicional] = useState("");
  const [msdsFile, setMsdsFile] = useState<File | null>(null);

  // Mercancía — marítimo
  const [tipoEmbarque, setTipoEmbarque] = useState<"FCL" | "LCL">("FCL");
  const [tipoContenedor, setTipoContenedor] = useState("");
  const [tipoPeso, setTipoPeso] = useState("Peso Normal");
  const [dimensionesLCL, setDimensionesLCL] = useState<DimensionLCL[]>([
    { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 },
  ]);

  // Mercancía — aéreo
  const [dimensionesAereas, setDimensionesAereas] = useState<DimensionAerea[]>([
    { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 },
  ]);

  // Mercancía — no marítimo/aéreo
  const [pesoKg, setPesoKg] = useState(0);
  const [volumenM3, setVolumenM3] = useState(0);
  const [piezas, setPiezas] = useState(0);

  // Ruta
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tiempoTransitoDias, setTiempoTransitoDias] = useState<number | undefined>();
  const [frecuencia, setFrecuencia] = useState("");
  const [rutaTexto, setRutaTexto] = useState("");
  const [validezPropuesta, setValidezPropuesta] = useState<Date | undefined>();
  const [tipoMovimiento, setTipoMovimiento] = useState("");
  const [seguro, setSeguro] = useState(false);
  const [valorSeguroUsd, setValorSeguroUsd] = useState(0);
  const [diasLibresDestino, setDiasLibresDestino] = useState(0);
  const [diasAlmacenaje, setDiasAlmacenaje] = useState(0);
  const [cartaGarantia, setCartaGarantia] = useState(false);

  // Conceptos
  const [notas, setNotas] = useState("");
  const [conceptos, setConceptos] = useState<ConceptoVentaCotizacion[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0, moneda: 'MXN', total: 0 },
  ]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  const esMaritimo = modo === 'Marítimo';
  const esAereo = modo === 'Aéreo';

  const handleCambiarTipoEmbarque = (nuevoTipo: "FCL" | "LCL") => {
    setTipoEmbarque(nuevoTipo);
    // Reset campos del modo anterior
    setTipoContenedor("");
    setTipoPeso("Peso Normal");
    setDimensionesLCL([{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
    setTipoCarga("Carga General");
    setMsdsFile(null);
  };

  const actualizarConcepto = (index: number, campo: string, valor: any) => {
    setConceptos(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      copia[index].total = copia[index].cantidad * copia[index].precio_unitario;
      return copia;
    });
  };

  const agregarConcepto = () => {
    setConceptos(prev => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, moneda, total: 0 }]);
  };

  const eliminarConcepto = (index: number) => {
    if (conceptos.length <= 1) return;
    setConceptos(prev => prev.filter((_, i) => i !== index));
  };

  const subtotalConceptos = conceptos.reduce((sum, c) => sum + c.total, 0);
  const subtotal = subtotalConceptos + (seguro ? Number(valorSeguroUsd) || 0 : 0);

  // Calcular piezas y volumen totales para LCL
  const totalPiezasLCL = dimensionesLCL.reduce((sum, d) => sum + d.piezas, 0);
  const totalVolumenLCL = dimensionesLCL.reduce((sum, d) => sum + d.volumen_m3, 0);

  // Calcular totales aéreos
  const totalPiezasAereas = dimensionesAereas.reduce((sum, d) => sum + d.piezas, 0);
  const totalPesoVolAereo = dimensionesAereas.reduce((sum, d) => sum + d.peso_volumetrico_kg, 0);

  const handleGuardar = async () => {
    if (!esProspecto && !clienteId) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    if (esProspecto && !prospectoEmpresa.trim()) {
      toast({ title: "Ingresa el nombre de la empresa del prospecto", variant: "destructive" });
      return;
    }
    if (esProspecto && !prospectoContacto.trim()) {
      toast({ title: "Ingresa el nombre del contacto del prospecto", variant: "destructive" });
      return;
    }
    if (conceptos.some(c => !c.descripcion.trim())) {
      toast({ title: "Completa todos los conceptos de venta", variant: "destructive" });
      return;
    }

    try {
      let msdsArchivo: string | null = null;
      if (tipoCarga === 'Mercancía Peligrosa' && msdsFile) {
        const ext = msdsFile.name.split('.').pop() || 'pdf';
        const path = `cotizaciones/msds-${Date.now()}.${ext}`;
        await uploadFile(path, msdsFile);
        msdsArchivo = path;
      }

      // Determinar peso/volumen/piezas finales
      let pesoFinal = pesoKg;
      let volumenFinal = volumenM3;
      let piezasFinal = piezas;
      if (esMaritimo) {
        pesoFinal = 0;
        volumenFinal = tipoEmbarque === 'LCL' ? totalVolumenLCL : 0;
        piezasFinal = tipoEmbarque === 'LCL' ? totalPiezasLCL : 0;
      } else if (esAereo) {
        pesoFinal = totalPesoVolAereo;
        volumenFinal = 0;
        piezasFinal = totalPiezasAereas;
      }

      const cotizacion = await crearCotizacion.mutateAsync({
        es_prospecto: esProspecto,
        cliente_id: esProspecto ? null : clienteId,
        cliente_nombre: esProspecto ? prospectoEmpresa : (clienteSeleccionado?.nombre ?? ''),
        prospecto_empresa: esProspecto ? prospectoEmpresa : '',
        prospecto_contacto: esProspecto ? prospectoContacto : '',
        prospecto_email: esProspecto ? prospectoEmail : '',
        prospecto_telefono: esProspecto ? prospectoTelefono : '',
        modo,
        tipo,
        incoterm,
        descripcion_mercancia: sectorEconomico,
        peso_kg: pesoFinal,
        volumen_m3: volumenFinal,
        piezas: piezasFinal,
        origen,
        destino,
        conceptos_venta: conceptos,
        subtotal,
        moneda,
        vigencia_dias: validezPropuesta ? Math.max(1, Math.ceil((validezPropuesta.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 15,
        notas,
        operador: user?.email ?? '',
        tipo_carga: tipoCarga,
        msds_archivo: msdsArchivo,
        tipo_embarque: esMaritimo ? tipoEmbarque : 'FCL',
        tipo_contenedor: esMaritimo && tipoEmbarque === 'FCL' ? tipoContenedor : null,
        tipo_peso: esMaritimo && tipoEmbarque === 'FCL' ? tipoPeso : 'Peso Normal',
        descripcion_adicional: descripcionAdicional,
        sector_economico: sectorEconomico,
        dimensiones_lcl: esMaritimo && tipoEmbarque === 'LCL' ? dimensionesLCL : [],
        dimensiones_aereas: esAereo ? dimensionesAereas : [],
        dias_libres_destino: esMaritimo && tipoEmbarque === 'FCL' ? diasLibresDestino : 0,
        dias_almacenaje: esMaritimo && tipoEmbarque === 'LCL' ? diasAlmacenaje : 0,
        carta_garantia: esMaritimo && tipoEmbarque === 'FCL' ? cartaGarantia : false,
        tiempo_transito_dias: tiempoTransitoDias ?? null,
        frecuencia,
        ruta_texto: rutaTexto,
        validez_propuesta: validezPropuesta ? validezPropuesta.toISOString().split('T')[0] : null,
        tipo_movimiento: tipoMovimiento,
        seguro,
        valor_seguro_usd: seguro ? Number(valorSeguroUsd) || 0 : 0,
      });

      registrarActividad.mutate({
        accion: 'Crear cotización',
        modulo: 'Cotizaciones',
        entidad_id: cotizacion.id,
        entidad_nombre: cotizacion.folio,
      });
      toast({ title: `Cotización ${cotizacion.folio} creada` });
      navigate(`/cotizaciones/${cotizacion.id}`);
    } catch (err: any) {
      toast({ title: "Error al crear cotización", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Cotización</h1>
          <p className="text-sm text-muted-foreground">Completa los datos para crear una cotización</p>
        </div>
      </div>

      {/* Destinatario */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Destinatario</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="tipo-destinatario" checked={!esProspecto} onChange={() => setEsProspecto(false)} className="accent-primary" />
              <span className="text-sm font-medium">Cliente existente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="tipo-destinatario" checked={esProspecto} onChange={() => setEsProspecto(true)} className="accent-primary" />
              <span className="text-sm font-medium">Prospecto</span>
            </label>
          </div>
          {!esProspecto ? (
            <div>
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nombre de Empresa *</Label><Input value={prospectoEmpresa} onChange={e => setProspectoEmpresa(e.target.value)} placeholder="Ej. Importaciones ABC" /></div>
              <div><Label>Nombre de Contacto *</Label><Input value={prospectoContacto} onChange={e => setProspectoContacto(e.target.value)} placeholder="Ej. Juan Pérez" /></div>
              <div><Label>Email</Label><Input type="email" value={prospectoEmail} onChange={e => setProspectoEmail(e.target.value)} placeholder="contacto@empresa.com" /></div>
              <div><Label>Teléfono</Label><Input value={prospectoTelefono} onChange={e => setProspectoTelefono(e.target.value)} placeholder="+52 55 1234 5678" /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datos generales */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Modo de Transporte</Label>
            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Operación</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Incoterm</Label>
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mercancía</CardTitle>
        </CardHeader>
        <CardContent>
          {esMaritimo ? (
            <div className="space-y-4">
              {/* Selector FCL/LCL */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tipo-embarque" checked={tipoEmbarque === 'FCL'} onChange={() => handleCambiarTipoEmbarque('FCL')} className="accent-primary" />
                  <span className="text-sm font-medium">FCL (Contenedor completo)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tipo-embarque" checked={tipoEmbarque === 'LCL'} onChange={() => handleCambiarTipoEmbarque('LCL')} className="accent-primary" />
                  <span className="text-sm font-medium">LCL (Carga consolidada)</span>
                </label>
              </div>

              {tipoEmbarque === 'FCL' ? (
                <SeccionMercanciaMaritimaFCL
                  tipoContenedor={tipoContenedor} setTipoContenedor={setTipoContenedor}
                  tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                  sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                  descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                  tipoPeso={tipoPeso} setTipoPeso={setTipoPeso}
                  msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                />
              ) : (
                <SeccionMercanciaMaritimeLCL
                  tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                  sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                  descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                  msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                  dimensiones={dimensionesLCL} setDimensiones={setDimensionesLCL}
                />
              )}
            </div>
          ) : esAereo ? (
            <SeccionMercanciaAerea
              tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
              sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
              descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
              msdsFile={msdsFile} setMsdsFile={setMsdsFile}
              dimensiones={dimensionesAereas} setDimensiones={setDimensionesAereas}
            />
          ) : (
            <SeccionMercanciaGeneral
              tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
              sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
              descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
              pesoKg={pesoKg} setPesoKg={setPesoKg}
              volumenM3={volumenM3} setVolumenM3={setVolumenM3}
              piezas={piezas} setPiezas={setPiezas}
              msdsFile={msdsFile} setMsdsFile={setMsdsFile}
            />
          )}
        </CardContent>
      </Card>

      {/* Ruta */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Ruta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {esMaritimo || modo === 'Multimodal' ? (
            <>
              <div><Label>Origen</Label><PortSelect value={origen} onValueChange={setOrigen} placeholder="Buscar puerto de origen..." /></div>
              <div><Label>Destino</Label><PortSelect value={destino} onValueChange={setDestino} placeholder="Buscar puerto de destino..." /></div>
            </>
          ) : (
            <>
              <div><Label>Origen</Label><Input value={origen} onChange={e => setOrigen(e.target.value)} placeholder="Ej. Shanghai, China" /></div>
              <div><Label>Destino</Label><Input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej. Manzanillo, México" /></div>
            </>
           )}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label>Tiempo de tránsito (días)</Label>
              <Input type="number" min={0} value={tiempoTransitoDias ?? ''} onChange={e => setTiempoTransitoDias(e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej. 25" />
            </div>
            {esMaritimo && tipoEmbarque === 'FCL' && (
              <>
                <div>
                  <Label>Días libres en destino</Label>
                  <Input type="number" min={0} value={diasLibresDestino} onChange={e => setDiasLibresDestino(Number(e.target.value))} placeholder="Ej. 7" />
                </div>
                <div>
                  <Label>Carta garantía</Label>
                  <Select value={cartaGarantia ? 'si' : 'no'} onValueChange={(val) => setCartaGarantia(val === 'si')}>
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Sí</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {esMaritimo && tipoEmbarque === 'LCL' && (
              <div>
                <Label>Días libres de almacenaje</Label>
                <Input type="number" min={0} value={diasAlmacenaje} onChange={e => setDiasAlmacenaje(Number(e.target.value))} placeholder="Ej. 5" />
              </div>
            )}
            <div>
              <Label>Frecuencia</Label>
              <Select value={frecuencia} onValueChange={setFrecuencia}>
                <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diaria">Diaria</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Quincenal">Quincenal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Ruta</Label>
              <Input value={rutaTexto} onChange={e => setRutaTexto(e.target.value)} placeholder="Ej. Manzanillo → Los Angeles → Nueva York" />
            </div>
            <div>
              <Label>Validez de la propuesta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !validezPropuesta && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validezPropuesta ? format(validezPropuesta, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={validezPropuesta} onSelect={setValidezPropuesta} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Tipo de movimiento</Label>
              <Select value={tipoMovimiento} onValueChange={setTipoMovimiento}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CY-CY">CY-CY</SelectItem>
                  <SelectItem value="CY-DR">CY-DR</SelectItem>
                  <SelectItem value="DR-DR">DR-DR</SelectItem>
                  <SelectItem value="DR-CY">DR-CY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Seguro</Label>
              <Switch checked={seguro} onCheckedChange={setSeguro} />
              <span className="text-sm text-muted-foreground">{seguro ? 'Sí' : 'No'}</span>
            </div>
            {seguro && (
              <div>
                <Label>Valor del seguro (USD)</Label>
                <Input type="number" min={0} step={0.01} value={valorSeguroUsd} onChange={e => setValorSeguroUsd(Number(e.target.value))} placeholder="0.00" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conceptos de venta */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conceptos de Venta</CardTitle>
            <Button variant="outline" size="sm" onClick={agregarConcepto}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptos.map((concepto, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                {index === 0 && <Label className="text-xs">Descripción</Label>}
                <Input value={concepto.descripcion} onChange={e => actualizarConcepto(index, 'descripcion', e.target.value)} placeholder="Concepto" />
              </div>
              <div className="col-span-2">
                {index === 0 && <Label className="text-xs">Cantidad</Label>}
                <Input type="number" min={1} value={concepto.cantidad} onChange={e => actualizarConcepto(index, 'cantidad', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                {index === 0 && <Label className="text-xs">P. Unitario</Label>}
                <Input type="number" min={0} step={0.01} value={concepto.precio_unitario} onChange={e => actualizarConcepto(index, 'precio_unitario', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                {index === 0 && <Label className="text-xs">Total</Label>}
                <Input value={concepto.total.toFixed(2)} readOnly className="bg-muted" />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="icon" onClick={() => eliminarConcepto(index)} disabled={conceptos.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <span className="text-sm">Conceptos: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(subtotalConceptos)}</span>
            {seguro && <span className="text-sm">Seguro: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(Number(valorSeguroUsd) || 0)}</span>}
            <span className="text-sm font-semibold">Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(subtotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notas Adicionales */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Notas Adicionales</CardTitle></CardHeader>
        <CardContent>
          <Label>Notas</Label>
          <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/cotizaciones")}>Cancelar</Button>
        <Button onClick={handleGuardar} disabled={crearCotizacion.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {crearCotizacion.isPending ? 'Guardando...' : 'Guardar Cotización'}
        </Button>
      </div>
    </div>
  );
}
