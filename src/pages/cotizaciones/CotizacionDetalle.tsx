import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import TablaConceptosGenerico from "@/features/cotizacion/components/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/features/cotizacion/components/ResumenTotalesCotizacion";
import DialogConvertirProspecto from "@/features/cotizacion/components/DialogConvertirProspecto";
import SeccionMercanciaCotizacionDetalle from "@/features/cotizacion/components/SeccionMercanciaCotizacionDetalle";
import { CotizacionDetalleEmbarques, CotizacionDetalleAcciones } from "@/features/cotizacion/components/CotizacionDetalleSecciones";
import { CotizacionDatosGeneralesCard } from "@/features/cotizacion/components/detalle/CotizacionDatosGeneralesCard";
import { CotizacionDetalleHeader } from "@/features/cotizacion/components/detalle/CotizacionDetalleHeader";
import { DialogGenerarEmbarques } from "@/features/cotizacion/components/detalle/DialogGenerarEmbarques";
import { BloqueoEmbarqueSinCostosDialog } from "@/features/cotizacion/components/BloqueoEmbarqueSinCostosDialog";
import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";
import { useCotizacionDetalleState } from "@/features/cotizacion/hooks";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";
import CotizacionInformativaDetalle from "@/pages/cotizaciones/CotizacionInformativaDetalle";

// Lazy-loaded PDF generator (jsPDF + autotable are heavy; only load on demand)
const handleExportarPdf = async (cotizacion: Parameters<typeof import("@/generators/cotizacionPdf").generarPdfCotizacion>[0], tasaIva: number) => {
  const { generarPdfCotizacion } = await import("@/generators/cotizacionPdf");
  await generarPdfCotizacion(cotizacion, tasaIva);
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
    handleCambiarEstado, abrirDialogConvertir, handleConvertir, handleGenerarEmbarques, handleCrearBorrador,
    showBloqueoSinCostos, setShowBloqueoSinCostos, irACargarCostos,
    convertirProspecto, convertirAEmbarques, crearBorrador, navigate,
  } = useCotizacionDetalleState(id);
  useRegisterBreadcrumbLabel(id, cotizacion?.folio);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  if (cotizacion.tipo_documento === "informativa") {
    return <CotizacionInformativaDetalle cotizacion={cotizacion} onBack={() => navigate("/cotizaciones")} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CotizacionDetalleHeader
        cotizacion={cotizacion}
        nombreDestinatario={nombreDestinatario}
        onBack={() => navigate("/cotizaciones")}
        onExportarPdf={() => handleExportarPdf(cotizacion, tasaIva)}
      />

      {cotizacion.sin_desglose_costos && (
        <SinDesgloseBanner onCargarCostos={() => navigate(`/cotizaciones/${cotizacion.id}/editar`)} />
      )}

      {canEdit && (
        <CotizacionDetalleAcciones
          estado={cotizacion.estado}
          esProspecto={cotizacion.es_prospecto}
          numContenedores={cotizacion.num_contenedores}
          cotizacionId={id!}
          embarqueIdVinculado={cotizacion.embarque_id ?? null}
          isCreandoBorrador={crearBorrador.isPending}
          onCambiarEstado={handleCambiarEstado}
          onAbrirConvertir={abrirDialogConvertir}
          onAbrirGenerarEmbarques={() => setShowConfirmarConvertir(true)}
          onCrearBorrador={handleCrearBorrador}
        />
      )}

      {cotizacion.es_prospecto && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="p-4">
            <p className="text-sm font-medium [color:hsl(var(--warning))] mb-2">
              Datos del Prospecto — Convierte a cliente primero para poder generar embarques
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Empresa</span><p className="font-medium">{cotizacion.prospecto_empresa}</p></div>
              <div><span className="text-muted-foreground">Contacto</span><p className="font-medium">{cotizacion.prospecto_contacto}</p></div>
              <div><span className="text-muted-foreground">Email</span><p className="font-medium">{cotizacion.prospecto_email || '-'}</p></div>
              <div><span className="text-warning">Teléfono</span><p className="font-medium text-warning">{cotizacion.prospecto_telefono || '-'}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <CotizacionDatosGeneralesCard cotizacion={cotizacion} />
      <SeccionMercanciaCotizacionDetalle cotizacion={cotizacion} />

      <TablaConceptosGenerico moneda="USD" conceptos={conceptosVentaUSD} total={totalUSD} />
      <TablaConceptosGenerico moneda="MXN" conceptos={conceptosVentaMXN} subtotal={subtotalMXN} iva={ivaMXN} total={totalMXN} />
      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {canEdit && (
        <SeccionCostosInternosPLUnificado
          tipo="detalle"
          cotizacionId={cotizacion.id}
          conceptosUSD={conceptosVentaUSD}
          conceptosMXN={conceptosVentaMXN}
        />
      )}

      {cotizacion.comentario_cliente && (
        <Card className="border-info/50">
          <CardHeader><CardTitle className="text-lg">Comentario del Cliente</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap italic">"{cotizacion.comentario_cliente}"</p>
          </CardContent>
        </Card>
      )}

      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p>
          </CardContent>
        </Card>
      )}

      <CotizacionDetalleEmbarques
        embarques={embarquesVinculados}
        cotizacionEstado={cotizacion.estado}
      />

      <DialogConvertirProspecto
        open={showConvertir}
        onOpenChange={setShowConvertir}
        clienteForm={clienteForm}
        setClienteForm={setClienteForm}
        onConvertir={handleConvertir}
        isPending={convertirProspecto.isPending}
      />

      <DialogGenerarEmbarques
        open={showConfirmarConvertir}
        onOpenChange={setShowConfirmarConvertir}
        numContenedores={cotizacion.num_contenedores}
        isPending={convertirAEmbarques.isPending}
        onConfirmar={handleGenerarEmbarques}
      />

      <BloqueoEmbarqueSinCostosDialog
        open={showBloqueoSinCostos}
        onOpenChange={setShowBloqueoSinCostos}
        onIrACargarCostos={irACargarCostos}
      />
    </div>
  );
}
