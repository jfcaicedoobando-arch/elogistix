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
import { CotizacionDatosGeneralesCard } from "@/components/cotizacion/detalle/CotizacionDatosGeneralesCard";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { toTitleCase } from "@/lib/formatters";
import { ArrowLeft, FileDown } from "lucide-react";
import { useCotizacionDetalleState } from "@/hooks/cotizacion";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

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
  useRegisterBreadcrumbLabel(id, cotizacion?.folio);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")} aria-label="Volver a cotizaciones">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{cotizacion.folio}</h1>
          <p className="text-sm text-muted-foreground truncate">{toTitleCase(nombreDestinatario)}</p>
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
      <CotizacionDatosGeneralesCard cotizacion={cotizacion} />

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
