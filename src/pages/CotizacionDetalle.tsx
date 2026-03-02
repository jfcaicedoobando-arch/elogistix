import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCotizacion, useUpdateEstadoCotizacion,
  useCrearEmbarqueDesdeCotizacion, useConvertirProspectoACliente,
  DimensionLCL, DimensionAerea,
} from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { getSignedUrl } from "@/lib/storage";
import { ArrowLeft, CheckCircle, Send, XCircle, Ship, UserPlus, Anchor, FileDown, AlertTriangle } from "lucide-react";

const estadoColor: Record<string, string> = {
  Borrador: 'bg-muted text-muted-foreground',
  Enviada: 'bg-blue-100 text-blue-800',
  Aceptada: 'bg-amber-100 text-amber-800',
  Confirmada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Vencida: 'bg-orange-100 text-orange-800',
};

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const actualizarEstado = useUpdateEstadoCotizacion();
  const crearEmbarque = useCrearEmbarqueDesdeCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const { canEdit } = usePermissions();

  const [showConvertir, setShowConvertir] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nombre: '', contacto: '', email: '', telefono: '',
    rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  const esBorradorOEnviada = cotizacion.estado === 'Borrador' || cotizacion.estado === 'Enviada';
  const esAceptada = cotizacion.estado === 'Aceptada';
  const esConfirmada = cotizacion.estado === 'Confirmada';
  const esMaritimo = cotizacion.modo === 'Marítimo';
  const esAereo = cotizacion.modo === 'Aéreo';

  const handleCambiarEstado = async (estado: string) => {
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      toast({ title: `Estado actualizado a "${estado}"` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCrearEmbarque = async () => {
    try {
      const embarque = await crearEmbarque.mutateAsync(cotizacion);
      toast({ title: `Embarque ${embarque.expediente} creado desde cotización.` });
      navigate(`/embarques/${embarque.id}`);
    } catch (err: any) {
      toast({ title: "Error al crear embarque", description: err.message, variant: "destructive" });
    }
  };

  const abrirDialogConvertir = () => {
    setClienteForm({
      nombre: cotizacion.prospecto_empresa || '',
      contacto: cotizacion.prospecto_contacto || '',
      email: cotizacion.prospecto_email || '',
      telefono: cotizacion.prospecto_telefono || '',
      rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
    });
    setShowConvertir(true);
  };

  const handleConvertir = async () => {
    if (!clienteForm.nombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    try {
      const cliente = await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      toast({ title: `Cliente "${cliente.nombre}" creado exitosamente` });
      setShowConvertir(false);
    } catch (err: any) {
      toast({ title: "Error al convertir prospecto", description: err.message, variant: "destructive" });
    }
  };

  const nombreDestinatario = cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;

  const dimensiones: DimensionLCL[] = Array.isArray(cotizacion.dimensiones_lcl) ? cotizacion.dimensiones_lcl : [];
  const dimensionesAereas: DimensionAerea[] = Array.isArray((cotizacion as any).dimensiones_aereas) ? (cotizacion as any).dimensiones_aereas : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cotizacion.folio}</h1>
          <p className="text-sm text-muted-foreground">{nombreDestinatario}</p>
        </div>
        <Badge className={estadoColor[cotizacion.estado] || ''}>{cotizacion.estado}</Badge>
      </div>

      {/* Acciones según estado */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {cotizacion.estado === 'Borrador' && (
            <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Enviada')}>
              <Send className="h-4 w-4 mr-1" /> Marcar como Enviada
            </Button>
          )}
          {esBorradorOEnviada && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Rechazada')}>
                <XCircle className="h-4 w-4 mr-1" /> Rechazar
              </Button>
              <Button size="sm" onClick={() => handleCambiarEstado('Aceptada')}>
                <CheckCircle className="h-4 w-4 mr-1" /> Aceptar
              </Button>
            </>
          )}
          {esAceptada && cotizacion.es_prospecto && (
            <Button size="sm" variant="secondary" onClick={abrirDialogConvertir}>
              <UserPlus className="h-4 w-4 mr-1" /> Convertir a Cliente
            </Button>
          )}
          {esAceptada && !cotizacion.es_prospecto && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm"><Anchor className="h-4 w-4 mr-1" /> Crear Embarque</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Crear embarque desde esta cotización?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se creará un embarque nuevo con los datos de esta cotización y pasará a estado "Confirmada".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCrearEmbarque} disabled={crearEmbarque.isPending}>
                    {crearEmbarque.isPending ? 'Creando...' : 'Crear Embarque'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Link a embarque si confirmada */}
      {esConfirmada && cotizacion.embarque_id && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Ship className="h-5 w-5 text-green-700" />
            <span className="text-sm text-green-800">
              Embarque creado:{' '}
              <Link to={`/embarques/${cotizacion.embarque_id}`} className="font-medium underline">Ver embarque</Link>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Info de prospecto */}
      {cotizacion.es_prospecto && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">Datos del Prospecto</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-amber-600">Empresa</span><p className="font-medium text-amber-900">{cotizacion.prospecto_empresa}</p></div>
              <div><span className="text-amber-600">Contacto</span><p className="font-medium text-amber-900">{cotizacion.prospecto_contacto}</p></div>
              <div><span className="text-amber-600">Email</span><p className="font-medium text-amber-900">{cotizacion.prospecto_email || '-'}</p></div>
              <div><span className="text-amber-600">Teléfono</span><p className="font-medium text-amber-900">{cotizacion.prospecto_telefono || '-'}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Datos generales */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Modo</span><p className="font-medium">{cotizacion.modo}</p></div>
            <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{cotizacion.tipo}</p></div>
            <div><span className="text-muted-foreground">Incoterm</span><p className="font-medium">{cotizacion.incoterm}</p></div>
            <div><span className="text-muted-foreground">Moneda</span><p className="font-medium">{cotizacion.moneda}</p></div>
            <div><span className="text-muted-foreground">Origen</span><p className="font-medium">{cotizacion.origen || '-'}</p></div>
            <div><span className="text-muted-foreground">Destino</span><p className="font-medium">{cotizacion.destino || '-'}</p></div>
            <div><span className="text-muted-foreground">Vigencia</span><p className="font-medium">{cotizacion.vigencia_dias} días ({cotizacion.fecha_vigencia ? formatDate(cotizacion.fecha_vigencia) : '-'})</p></div>
            <div><span className="text-muted-foreground">Operador</span><p className="font-medium">{cotizacion.operador || '-'}</p></div>
            {(cotizacion as any).tiempo_transito_dias != null && (
              <div><span className="text-muted-foreground">Tiempo de tránsito</span><p className="font-medium">{(cotizacion as any).tiempo_transito_dias} días</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (cotizacion as any).dias_libres_destino > 0 && (
              <div><span className="text-muted-foreground">Días libres en destino</span><p className="font-medium">{(cotizacion as any).dias_libres_destino} días</p></div>
            )}
            {(cotizacion as any).frecuencia && (
              <div><span className="text-muted-foreground">Frecuencia</span><p className="font-medium">{(cotizacion as any).frecuencia}</p></div>
            )}
            {(cotizacion as any).ruta_texto && (
              <div className="col-span-2"><span className="text-muted-foreground">Ruta</span><p className="font-medium">{(cotizacion as any).ruta_texto}</p></div>
            )}
            {(cotizacion as any).validez_propuesta && (
              <div><span className="text-muted-foreground">Validez propuesta</span><p className="font-medium">{formatDate((cotizacion as any).validez_propuesta)}</p></div>
            )}
            {(cotizacion as any).tipo_movimiento && (
              <div><span className="text-muted-foreground">Tipo de movimiento</span><p className="font-medium">{(cotizacion as any).tipo_movimiento}</p></div>
            )}
            <div><span className="text-muted-foreground">Seguro</span><p className="font-medium">{(cotizacion as any).seguro ? `Sí — $${Number((cotizacion as any).valor_seguro_usd || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USD` : 'No'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {esMaritimo && (
              <div>
                <span className="text-muted-foreground">Tipo de Embarque</span>
                <p className="font-medium">{cotizacion.tipo_embarque}</p>
              </div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
              <>
                <div>
                  <span className="text-muted-foreground">Tipo de Contenedor</span>
                  <p className="font-medium">{cotizacion.tipo_contenedor || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Peso</span>
                  <p className="font-medium">{cotizacion.tipo_peso}</p>
                </div>
              </>
            )}
            <div>
              <span className="text-muted-foreground">Tipo de Carga</span>
              <p className="font-medium flex items-center gap-1">
                {cotizacion.tipo_carga === 'Mercancía Peligrosa' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {cotizacion.tipo_carga || 'Carga General'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Sector Económico</span>
              <p className="font-medium">{cotizacion.sector_economico || cotizacion.descripcion_mercancia || '-'}</p>
            </div>
            {!esMaritimo && !esAereo && (
              <>
                <div><span className="text-muted-foreground">Peso</span><p className="font-medium">{cotizacion.peso_kg} kg</p></div>
                <div><span className="text-muted-foreground">Volumen</span><p className="font-medium">{cotizacion.volumen_m3} m³</p></div>
                <div><span className="text-muted-foreground">Piezas</span><p className="font-medium">{cotizacion.piezas}</p></div>
              </>
            )}
            {cotizacion.msds_archivo && (
              <div>
                <span className="text-muted-foreground">MSDS</span>
                <Button
                  variant="link" size="sm" className="p-0 h-auto text-sm"
                  onClick={async () => {
                    const url = await getSignedUrl(cotizacion.msds_archivo!);
                    window.open(url, '_blank');
                  }}
                >
                  <FileDown className="h-3 w-3 mr-1" /> Descargar
                </Button>
              </div>
            )}
          </div>

          {cotizacion.descripcion_adicional && (
            <div className="text-sm">
              <span className="text-muted-foreground">Descripción Adicional</span>
              <p className="font-medium whitespace-pre-wrap">{cotizacion.descripcion_adicional}</p>
            </div>
          )}

          {/* Tabla dimensiones LCL */}
          {esMaritimo && cotizacion.tipo_embarque === 'LCL' && dimensiones.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
              <div className="border rounded-md overflow-auto mt-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Alto (cm)</TableHead>
                      <TableHead>Largo (cm)</TableHead>
                      <TableHead>Ancho (cm)</TableHead>
                      <TableHead>Volumen m³</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dimensiones.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell>{d.piezas}</TableCell>
                        <TableCell>{d.alto_cm}</TableCell>
                        <TableCell>{d.largo_cm}</TableCell>
                        <TableCell>{d.ancho_cm}</TableCell>
                        <TableCell>{d.volumen_m3.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
                <span>Total piezas: {cotizacion.piezas}</span>
                <span>Volumen total: {cotizacion.volumen_m3} m³</span>
              </div>
            </div>
          )}

          {/* Tabla dimensiones Aéreas */}
          {esAereo && dimensionesAereas.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
              <div className="border rounded-md overflow-auto mt-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Alto (cm)</TableHead>
                      <TableHead>Largo (cm)</TableHead>
                      <TableHead>Ancho (cm)</TableHead>
                      <TableHead>Peso vol. (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dimensionesAereas.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell>{d.piezas}</TableCell>
                        <TableCell>{d.alto_cm}</TableCell>
                        <TableCell>{d.largo_cm}</TableCell>
                        <TableCell>{d.ancho_cm}</TableCell>
                        <TableCell>{d.peso_volumetrico_kg.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
                <span>Total piezas: {cotizacion.piezas}</span>
                <span>Peso volumétrico total: {cotizacion.peso_kg} kg</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conceptos de venta */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">P. Unitario</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotizacion.conceptos_venta.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.descripcion}</TableCell>
                  <TableCell className="text-right">{c.cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.precio_unitario, c.moneda || cotizacion.moneda)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.total, c.moneda || cotizacion.moneda)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell colSpan={3} className="text-right">Subtotal</TableCell>
                <TableCell className="text-right">{formatCurrency(cotizacion.subtotal, cotizacion.moneda)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notas */}
      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p></CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Creada: {formatDate(cotizacion.created_at)} · Actualizada: {formatDate(cotizacion.updated_at)}
      </div>

      {/* Dialog: Convertir Prospecto a Cliente */}
      <Dialog open={showConvertir} onOpenChange={setShowConvertir}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Convertir Prospecto a Cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Label>Nombre de Empresa *</Label><Input value={clienteForm.nombre} onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><Label>Contacto</Label><Input value={clienteForm.contacto} onChange={e => setClienteForm(f => ({ ...f, contacto: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={clienteForm.email} onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Teléfono</Label><Input value={clienteForm.telefono} onChange={e => setClienteForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            <div><Label>RFC</Label><Input value={clienteForm.rfc} onChange={e => setClienteForm(f => ({ ...f, rfc: e.target.value }))} /></div>
            <div><Label>Dirección</Label><Input value={clienteForm.direccion} onChange={e => setClienteForm(f => ({ ...f, direccion: e.target.value }))} /></div>
            <div><Label>Ciudad</Label><Input value={clienteForm.ciudad} onChange={e => setClienteForm(f => ({ ...f, ciudad: e.target.value }))} /></div>
            <div><Label>Estado</Label><Input value={clienteForm.estado} onChange={e => setClienteForm(f => ({ ...f, estado: e.target.value }))} /></div>
            <div><Label>C.P.</Label><Input value={clienteForm.cp} onChange={e => setClienteForm(f => ({ ...f, cp: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertir(false)}>Cancelar</Button>
            <Button onClick={handleConvertir} disabled={convertirProspecto.isPending}>
              {convertirProspecto.isPending ? 'Guardando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
