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
} from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, CheckCircle, Send, XCircle, Ship, UserPlus, Anchor } from "lucide-react";

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

  // Dialog para convertir prospecto a cliente
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
          {/* Borrador / Enviada */}
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

          {/* Aceptada: flujo de conversión */}
          {esAceptada && cotizacion.es_prospecto && (
            <Button size="sm" variant="secondary" onClick={abrirDialogConvertir}>
              <UserPlus className="h-4 w-4 mr-1" /> Convertir a Cliente
            </Button>
          )}
          {esAceptada && !cotizacion.es_prospecto && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm">
                  <Anchor className="h-4 w-4 mr-1" /> Crear Embarque
                </Button>
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
              <Link to={`/embarques/${cotizacion.embarque_id}`} className="font-medium underline">
                Ver embarque
              </Link>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Info de prospecto si aplica */}
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
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="col-span-2"><span className="text-muted-foreground">Descripción</span><p className="font-medium">{cotizacion.descripcion_mercancia}</p></div>
            <div><span className="text-muted-foreground">Peso</span><p className="font-medium">{cotizacion.peso_kg} kg</p></div>
            <div><span className="text-muted-foreground">Volumen</span><p className="font-medium">{cotizacion.volumen_m3} m³</p></div>
            <div><span className="text-muted-foreground">Piezas</span><p className="font-medium">{cotizacion.piezas}</p></div>
          </div>
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
          <DialogHeader>
            <DialogTitle>Convertir Prospecto a Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nombre de Empresa *</Label>
              <Input value={clienteForm.nombre} onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <Label>Contacto</Label>
              <Input value={clienteForm.contacto} onChange={e => setClienteForm(f => ({ ...f, contacto: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={clienteForm.email} onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={clienteForm.telefono} onChange={e => setClienteForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div>
              <Label>RFC</Label>
              <Input value={clienteForm.rfc} onChange={e => setClienteForm(f => ({ ...f, rfc: e.target.value }))} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={clienteForm.direccion} onChange={e => setClienteForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={clienteForm.ciudad} onChange={e => setClienteForm(f => ({ ...f, ciudad: e.target.value }))} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={clienteForm.estado} onChange={e => setClienteForm(f => ({ ...f, estado: e.target.value }))} />
            </div>
            <div>
              <Label>C.P.</Label>
              <Input value={clienteForm.cp} onChange={e => setClienteForm(f => ({ ...f, cp: e.target.value }))} />
            </div>
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
