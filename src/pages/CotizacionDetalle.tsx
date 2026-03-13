import { useState, useMemo } from "react";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import SeccionCostosInternosPLUnificado from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import TablaConceptosGenerico from "@/components/cotizacion/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/components/cotizacion/ResumenTotalesCotizacion";
import DialogConvertirProspecto from "@/components/cotizacion/DialogConvertirProspecto";
import SeccionMercanciaCotizacionDetalle from "@/components/cotizacion/SeccionMercanciaCotizacionDetalle";
import type { ClienteFormData } from "@/components/cotizacion/DialogConvertirProspecto";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCotizacion, useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
  useEmbarquesVinculados,
} from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, ArrowRight, CheckCircle, Send, XCircle, UserPlus, FileDown, Pencil } from "lucide-react";
import { generarPdfCotizacion } from "@/lib/cotizacionPdf";

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const { canEdit } = usePermissions();
  const convertirAEmbarques = useConvertirCotizacionAEmbarques();

  const { data: embarquesVinculados = [] } = useEmbarquesVinculados(cotizacion?.id);

  const [showConvertir, setShowConvertir] = useState(false);
  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
  const [clienteForm, setClienteForm] = useState<ClienteFormData>({
    nombre: '', contacto: '', email: '', telefono: '',
    rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
  });

  const conceptosVentaUSD = useMemo(() =>
    cotizacion ? (cotizacion.conceptos_venta as unknown as ConceptoVentaCotizacion[]).filter(c => c.moneda === 'USD') : [], [cotizacion]);
  const conceptosVentaMXN = useMemo(() =>
    cotizacion ? (cotizacion.conceptos_venta as unknown as ConceptoVentaCotizacion[]).filter(c => c.moneda === 'MXN') : [], [cotizacion]);

  // Totales calculados
  const totalUSD = useMemo(() => conceptosVentaUSD.reduce((s, c) => s + c.total, 0), [conceptosVentaUSD]);
  const subtotalMXN = useMemo(() => conceptosVentaMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0), [conceptosVentaMXN]);
  const tasaIva = useTasaIVA();
  const ivaMXN = calcularIVA(subtotalMXN, tasaIva);
  const totalMXN = subtotalMXN + ivaMXN;

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  const esBorradorOEnviada = cotizacion.estado === 'Borrador' || cotizacion.estado === 'Enviada';
  const esAceptada = cotizacion.estado === 'Aceptada';
  const esMaritimo = cotizacion.modo === 'Marítimo';

  const handleCambiarEstado = async (estado: string) => {
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      toast({ title: `Estado actualizado a "${estado}"` });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error al convertir prospecto", description: msg, variant: "destructive" });
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
        <Badge className={getEstadoColor(cotizacion.estado)}>{cotizacion.estado}</Badge>
        <Button variant="outline" size="sm" onClick={() => generarPdfCotizacion(cotizacion, tasaIva)}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {/* Acciones según estado */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {cotizacion.estado === 'Borrador' && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate(`/cotizaciones/${id}/editar`)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Enviada')}>
                <Send className="h-4 w-4 mr-1" /> Marcar como Enviada
              </Button>
            </>
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
          {esAceptada && (
            <Button size="sm" onClick={() => setShowConfirmarConvertir(true)}>
              <ArrowRight className="h-4 w-4 mr-1" />
              Generar Embarques
              <Badge className="ml-2">{cotizacion.num_contenedores}</Badge>
            </Button>
          )}
        </div>
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
            <div><span className="text-muted-foreground">Origen</span><p className="font-medium">{cotizacion.origen || '-'}</p></div>
            <div><span className="text-muted-foreground">Destino</span><p className="font-medium">{cotizacion.destino || '-'}</p></div>
            <div><span className="text-muted-foreground">Vigencia</span><p className="font-medium">{cotizacion.vigencia_dias} días ({cotizacion.fecha_vigencia ? formatDate(cotizacion.fecha_vigencia) : '-'})</p></div>
            <div><span className="text-muted-foreground">Operador</span><p className="font-medium">{cotizacion.operador || '-'}</p></div>
            {cotizacion.tiempo_transito_dias != null && (
              <div><span className="text-muted-foreground">Tiempo de tránsito</span><p className="font-medium">{cotizacion.tiempo_transito_dias} días</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && cotizacion.dias_libres_destino > 0 && (
              <div><span className="text-muted-foreground">Días libres en destino</span><p className="font-medium">{cotizacion.dias_libres_destino} días</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
              <div><span className="text-muted-foreground">Carta garantía</span><p className="font-medium">{cotizacion.carta_garantia ? 'Sí' : 'No'}</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'LCL' && cotizacion.dias_almacenaje > 0 && (
              <div><span className="text-muted-foreground">Días libres de almacenaje</span><p className="font-medium">{cotizacion.dias_almacenaje} días</p></div>
            )}
            {cotizacion.frecuencia && (
              <div><span className="text-muted-foreground">Frecuencia</span><p className="font-medium">{cotizacion.frecuencia}</p></div>
            )}
            {cotizacion.ruta_texto && (
              <div className="col-span-2"><span className="text-muted-foreground">Ruta</span><p className="font-medium">{cotizacion.ruta_texto}</p></div>
            )}
            {cotizacion.validez_propuesta && (
              <div><span className="text-muted-foreground">Validez propuesta</span><p className="font-medium">{formatDate(cotizacion.validez_propuesta)}</p></div>
            )}
            {cotizacion.tipo_movimiento && (
              <div><span className="text-muted-foreground">Tipo de movimiento</span><p className="font-medium">{cotizacion.tipo_movimiento}</p></div>
            )}
            <div><span className="text-muted-foreground">Seguro</span><p className="font-medium">{cotizacion.seguro ? `Sí — ${formatCurrency(Number(cotizacion.valor_seguro_usd || 0), 'USD')}` : 'No'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <SeccionMercanciaCotizacionDetalle cotizacion={cotizacion} />

      {/* Conceptos de venta */}
      <TablaConceptosGenerico moneda="USD" conceptos={conceptosVentaUSD} total={totalUSD} />
      <TablaConceptosGenerico moneda="MXN" conceptos={conceptosVentaMXN} subtotal={subtotalMXN} iva={ivaMXN} total={totalMXN} />
      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {/* Costos Internos P&L */}
      {canEdit && (
        <SeccionCostosInternosPLUnificado
          tipo="detalle"
          cotizacionId={cotizacion.id}
          conceptosUSD={conceptosVentaUSD}
          conceptosMXN={conceptosVentaMXN}
        />
      )}

      {/* Notas */}
      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Embarques Generados */}
      {(cotizacion.estado === 'Embarcada' || embarquesVinculados.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Embarques Generados</CardTitle></CardHeader>
          <CardContent>
            {embarquesVinculados.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {embarquesVinculados.map((emb) => (
                  <div
                    key={emb.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/embarques/${emb.id}`)}
                  >
                    <span className="font-medium text-primary">{emb.expediente}</span>
                    <div className="flex items-center gap-3">
                      <Badge className={getEstadoColor(emb.estado)}>{emb.estado}</Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(emb.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Convertir Prospecto */}
      <DialogConvertirProspecto
        open={showConvertir}
        onOpenChange={setShowConvertir}
        clienteForm={clienteForm}
        setClienteForm={setClienteForm}
        onConvertir={handleConvertir}
        isPending={convertirProspecto.isPending}
      />

      {/* AlertDialog Confirmar Conversión a Embarques */}
      <AlertDialog open={showConfirmarConvertir} onOpenChange={setShowConfirmarConvertir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar embarques?</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán {cotizacion.num_contenedores} embarque{cotizacion.num_contenedores > 1 ? 's' : ''} desde esta cotización.
              Los conceptos por Contenedor se copiarán a cada embarque.
              Los conceptos por BL solo al primer embarque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={convertirAEmbarques.isPending}
              onClick={async () => {
                try {
                  await convertirAEmbarques.mutateAsync(cotizacion);
                  toast({ title: `Se generaron ${cotizacion.num_contenedores} embarques exitosamente` });
                  setShowConfirmarConvertir(false);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Error desconocido";
                  toast({ title: "Error al generar embarques", description: msg, variant: "destructive" });
                }
              }}
            >
              {convertirAEmbarques.isPending ? 'Generando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
