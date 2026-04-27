import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SeccionCostosInternosPLUnificado from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import TablaConceptosGenerico from "@/components/cotizacion/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/components/cotizacion/ResumenTotalesCotizacion";
import DialogConvertirProspecto from "@/components/cotizacion/DialogConvertirProspecto";
import SeccionMercanciaCotizacionDetalle from "@/components/cotizacion/SeccionMercanciaCotizacionDetalle";
import { CotizacionDetalleEmbarques, CotizacionDetalleAcciones } from "@/components/cotizacion/CotizacionDetalleSecciones";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { formatDate, formatCurrency, toTitleCase, nombreDesdeEmail } from "@/lib/formatters";
import { ArrowLeft, FileDown } from "lucide-react";
import { useCotizacionDetalleState } from "@/hooks/cotizacion/useCotizacionDetalleState";

// Lazy-loaded PDF generator (jsPDF + autotable are heavy; only load on demand)
const handleExportarPdf = async (cotizacion: Parameters<typeof import("@/generators/cotizacionPdf").generarPdfCotizacion>[0], tasaIva: number) => {
  const { generarPdfCotizacion } = await import("@/generators/cotizacionPdf");
  generarPdfCotizacion(cotizacion, tasaIva);
};

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();

  const {
    cotizacion, isLoading, canEdit, tasaIva, embarquesVinculados,
    conceptosVentaUSD, conceptosVentaMXN,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,
    nombreDestinatario,
    showConvertir, setShowConvertir,
    showConfirmarConvertir, setShowConfirmarConvertir,
    clienteForm, setClienteForm,
    handleCambiarEstado, abrirDialogConvertir, handleConvertir, handleGenerarEmbarques,
    convertirProspecto, convertirAEmbarques, navigate,
  } = useCotizacionDetalleState(id);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  const esMaritimo = cotizacion.modo === 'Marítimo';

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
        <Button variant="outline" size="sm" onClick={() => handleExportarPdf(cotizacion, tasaIva)}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {/* Acciones según estado */}
      {canEdit && (
        <CotizacionDetalleAcciones
          estado={cotizacion.estado}
          esProspecto={cotizacion.es_prospecto}
          numContenedores={cotizacion.num_contenedores}
          cotizacionId={id!}
          onCambiarEstado={handleCambiarEstado}
          onAbrirConvertir={abrirDialogConvertir}
          onAbrirGenerarEmbarques={() => setShowConfirmarConvertir(true)}
        />
      )}

      {/* Info de prospecto */}
      {cotizacion.es_prospecto && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="p-4">
            <p className="text-sm font-medium [color:hsl(var(--warning))] mb-2">Datos del Prospecto</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Empresa</span><p className="font-medium">{cotizacion.prospecto_empresa}</p></div>
              <div><span className="text-muted-foreground">Contacto</span><p className="font-medium">{cotizacion.prospecto_contacto}</p></div>
              <div><span className="text-muted-foreground">Email</span><p className="font-medium">{cotizacion.prospecto_email || '-'}</p></div>
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

      {/* Comentario del cliente */}
      {cotizacion.comentario_cliente && (
        <Card className="border-info/50">
          <CardHeader><CardTitle className="text-lg">Comentario del Cliente</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap italic">"{cotizacion.comentario_cliente}"</p>
          </CardContent>
        </Card>
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
      <CotizacionDetalleEmbarques
        embarques={embarquesVinculados}
        cotizacionEstado={cotizacion.estado}
      />

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
              onClick={handleGenerarEmbarques}
            >
              {convertirAEmbarques.isPending ? 'Generando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
