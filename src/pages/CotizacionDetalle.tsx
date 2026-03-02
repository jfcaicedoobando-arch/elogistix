import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCotizacion, useConfirmarCotizacion, useUpdateEstadoCotizacion } from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, CheckCircle, Send, XCircle, Ship } from "lucide-react";

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const confirmar = useConfirmarCotizacion();
  const actualizarEstado = useUpdateEstadoCotizacion();
  const { canEdit } = usePermissions();

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  const puedeConfirmar = canEdit && (cotizacion.estado === 'Borrador' || cotizacion.estado === 'Enviada');
  const puedeEnviar = canEdit && cotizacion.estado === 'Borrador';
  const puedeRechazar = canEdit && (cotizacion.estado === 'Borrador' || cotizacion.estado === 'Enviada');

  const handleConfirmar = async () => {
    try {
      const embarque = await confirmar.mutateAsync(cotizacion);
      toast({ title: `Cotización confirmada. Embarque ${embarque.expediente} creado.` });
      navigate(`/embarques/${embarque.id}`);
    } catch (err: any) {
      toast({ title: "Error al confirmar", description: err.message, variant: "destructive" });
    }
  };

  const handleCambiarEstado = async (estado: string) => {
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      toast({ title: `Estado actualizado a "${estado}"` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const estadoColor: Record<string, string> = {
    Borrador: 'bg-muted text-muted-foreground',
    Enviada: 'bg-blue-100 text-blue-800',
    Confirmada: 'bg-green-100 text-green-800',
    Rechazada: 'bg-red-100 text-red-800',
    Vencida: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cotizacion.folio}</h1>
          <p className="text-sm text-muted-foreground">{cotizacion.cliente_nombre}</p>
        </div>
        <Badge className={estadoColor[cotizacion.estado] || ''}>{cotizacion.estado}</Badge>
      </div>

      {/* Acciones */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {puedeEnviar && (
            <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Enviada')}>
              <Send className="h-4 w-4 mr-1" /> Marcar como Enviada
            </Button>
          )}
          {puedeRechazar && (
            <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Rechazada')}>
              <XCircle className="h-4 w-4 mr-1" /> Rechazar
            </Button>
          )}
          {puedeConfirmar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm">
                  <CheckCircle className="h-4 w-4 mr-1" /> Confirmar y Crear Embarque
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Confirmar cotización?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se creará un embarque nuevo con los datos de esta cotización. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmar} disabled={confirmar.isPending}>
                    {confirmar.isPending ? 'Creando...' : 'Confirmar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Link a embarque si ya fue confirmada */}
      {cotizacion.estado === 'Confirmada' && cotizacion.embarque_id && (
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
    </div>
  );
}
