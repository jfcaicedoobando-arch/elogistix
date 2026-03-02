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
import { useCreateCotizacion, ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/storage";
import { Plus, Trash2, ArrowLeft, Save, Upload } from "lucide-react";

const MODOS = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS = ['Importación', 'Exportación', 'Nacional'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];
const MONEDAS = ['MXN', 'USD', 'EUR'];
const TIPOS_CARGA = ['Carga General', 'Mercancía Peligrosa'];
const DESCRIPCIONES_MERCANCIA = [
  'Automotriz', 'Médica', 'Alimentos', 'Carga Proyecto',
  'Construcción', 'Industrial', 'General', 'Tecnología', 'Arte y Moda',
];

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const crearCotizacion = useCreateCotizacion();
  const registrarActividad = useRegistrarActividad();

  // Tipo de destinatario
  const [esProspecto, setEsProspecto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [prospectoEmpresa, setProspectoEmpresa] = useState("");
  const [prospectoContacto, setProspectoContacto] = useState("");
  const [prospectoEmail, setProspectoEmail] = useState("");
  const [prospectoTelefono, setProspectoTelefono] = useState("");

  const [modo, setModo] = useState("Marítimo");
  const [tipo, setTipo] = useState("Importación");
  const [incoterm, setIncoterm] = useState("FOB");
  const [mercancia, setMercancia] = useState("");
  const [tipoCarga, setTipoCarga] = useState("Carga General");
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [pesoKg, setPesoKg] = useState(0);
  const [volumenM3, setVolumenM3] = useState(0);
  const [piezas, setPiezas] = useState(0);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [vigenciaDias, setVigenciaDias] = useState(15);
  const [notas, setNotas] = useState("");
  const [conceptos, setConceptos] = useState<ConceptoVentaCotizacion[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0, moneda: 'MXN', total: 0 },
  ]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

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

  const subtotal = conceptos.reduce((sum, c) => sum + c.total, 0);

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
    if (!mercancia.trim()) {
      toast({ title: "Ingresa la descripción de mercancía", variant: "destructive" });
      return;
    }
    if (conceptos.some(c => !c.descripcion.trim())) {
      toast({ title: "Completa todos los conceptos de venta", variant: "destructive" });
      return;
    }

    try {
      // Subir MSDS si aplica
      let msdsArchivo: string | null = null;
      if (tipoCarga === 'Mercancía Peligrosa' && msdsFile) {
        const ext = msdsFile.name.split('.').pop() || 'pdf';
        const path = `cotizaciones/msds-${Date.now()}.${ext}`;
        await uploadFile(path, msdsFile);
        msdsArchivo = path;
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
        descripcion_mercancia: mercancia,
        peso_kg: pesoKg,
        volumen_m3: volumenM3,
        piezas,
        origen,
        destino,
        conceptos_venta: conceptos,
        subtotal,
        moneda,
        vigencia_dias: vigenciaDias,
        notas,
        operador: user?.email ?? '',
        tipo_carga: tipoCarga,
        msds_archivo: msdsArchivo,
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
              <input
                type="radio"
                name="tipo-destinatario"
                checked={!esProspecto}
                onChange={() => setEsProspecto(false)}
                className="accent-primary"
              />
              <span className="text-sm font-medium">Cliente existente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo-destinatario"
                checked={esProspecto}
                onChange={() => setEsProspecto(true)}
                className="accent-primary"
              />
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
              <div>
                <Label>Nombre de Empresa *</Label>
                <Input value={prospectoEmpresa} onChange={e => setProspectoEmpresa(e.target.value)} placeholder="Ej. Importaciones ABC" />
              </div>
              <div>
                <Label>Nombre de Contacto *</Label>
                <Input value={prospectoContacto} onChange={e => setProspectoContacto(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={prospectoEmail} onChange={e => setProspectoEmail(e.target.value)} placeholder="contacto@empresa.com" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={prospectoTelefono} onChange={e => setProspectoTelefono(e.target.value)} placeholder="+52 55 1234 5678" />
              </div>
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
        <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Carga</Label>
            <Select value={tipoCarga} onValueChange={setTipoCarga}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_CARGA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripción de Mercancía *</Label>
            <Select value={mercancia} onValueChange={setMercancia}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>{DESCRIPCIONES_MERCANCIA.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {tipoCarga === 'Mercancía Peligrosa' && (
            <div className="md:col-span-2">
              <Label>Hoja de Seguridad (MSDS)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={e => setMsdsFile(e.target.files?.[0] || null)}
                />
                {msdsFile && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="h-3 w-3" /> {msdsFile.name}
                  </span>
                )}
              </div>
            </div>
          )}
          <div>
            <Label>Peso (kg)</Label>
            <Input type="number" min={0} value={pesoKg} onChange={e => setPesoKg(Number(e.target.value))} />
          </div>
          <div>
            <Label>Volumen (m³)</Label>
            <Input type="number" min={0} step={0.01} value={volumenM3} onChange={e => setVolumenM3(Number(e.target.value))} />
          </div>
          <div>
            <Label>Piezas</Label>
            <Input type="number" min={0} value={piezas} onChange={e => setPiezas(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      {/* Ruta */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Ruta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Origen</Label>
            <Input value={origen} onChange={e => setOrigen(e.target.value)} placeholder="Ej. Shanghai, China" />
          </div>
          <div>
            <Label>Destino</Label>
            <Input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej. Manzanillo, México" />
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
                <Input
                  value={concepto.descripcion}
                  onChange={e => actualizarConcepto(index, 'descripcion', e.target.value)}
                  placeholder="Concepto"
                />
              </div>
              <div className="col-span-2">
                {index === 0 && <Label className="text-xs">Cantidad</Label>}
                <Input
                  type="number"
                  min={1}
                  value={concepto.cantidad}
                  onChange={e => actualizarConcepto(index, 'cantidad', Number(e.target.value))}
                />
              </div>
              <div className="col-span-2">
                {index === 0 && <Label className="text-xs">P. Unitario</Label>}
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={concepto.precio_unitario}
                  onChange={e => actualizarConcepto(index, 'precio_unitario', Number(e.target.value))}
                />
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
          <div className="flex justify-end pt-2 border-t">
            <span className="text-sm font-semibold">Subtotal: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(subtotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Vigencia y Notas */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Vigencia y Notas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Vigencia (días)</Label>
            <Input type="number" min={1} value={vigenciaDias} onChange={e => setVigenciaDias(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
          </div>
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
