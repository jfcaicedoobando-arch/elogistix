import { useState } from "react";
import { useParams } from "react-router-dom";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { EnviarCotizacionDialog } from "@/features/cotizacion/components/detalle/EnviarCotizacionDialog";
import { HistorialEnviosCard } from "@/features/cotizacion/components/detalle/HistorialEnviosCard";
import { useHistorialEnviosCotizacion } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import TablaConceptosGenerico from "@/features/cotizacion/components/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/features/cotizacion/components/ResumenTotalesCotizacion";
import DialogConvertirProspecto from "@/features/cotizacion/components/DialogConvertirProspecto";
import SeccionMercanciaCotizacionDetalle from "@/features/cotizacion/components/SeccionMercanciaCotizacionDetalle";
import { CotizacionDetalleEmbarques, CotizacionDetalleAcciones } from "@/features/cotizacion/components/CotizacionDetalleSecciones";
import { CotizacionDatosGeneralesCard } from "@/features/cotizacion/components/detalle/CotizacionDatosGeneralesCard";
import { CotizacionDetalleHeader } from "@/features/cotizacion/components/detalle/CotizacionDetalleHeader";
import { VersionesCotizacionCard } from "@/features/cotizacion/components/detalle/VersionesCotizacionCard";
import { CotizacionInactivaBanner } from "@/features/cotizacion/components/detalle/CotizacionInactivaBanner";
import { ProspectoBanner, ComentarioClienteCard, NotasCard } from "./detalle/CotizacionDetalleCards";
import { ReaprobacionTarifaBanner } from "@/features/cotizacion/components/revalidacion/ReaprobacionTarifaBanner";


import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";
import { useCotizacionDetalleState } from "@/features/cotizacion/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { PageContainer } from "@/components/shared/PageContainer";
import CotizacionInformativaDetalle from "./CotizacionInformativaDetalle";

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
    clienteForm, setClienteForm,
    handleCambiarEstado, abrirDialogConvertir, handleConvertir,
    convertirProspecto, navigate,
  } = useCotizacionDetalleState(id);

  const [enviarOpen, setEnviarOpen] = useState(false);
  const { data: envios = [] } = useHistorialEnviosCotizacion(cotizacion?.id);

  useRegisterBreadcrumbLabel(id, cotizacion?.folio);

  if (isLoading) {
    return <DetailSkeleton sections={1} />;
  }

  if (!cotizacion) {
    return (
      <DetailNotFound
        icon={FileX}
        title="Cotización no encontrada"
        description="La cotización no existe, fue eliminada o no tienes permiso para verla."
        backTo="/cotizaciones"
        backLabel="Volver a Cotizaciones"
      />
    );
  }


  if (cotizacion.tipo_documento === "informativa") {
    return <CotizacionInformativaDetalle cotizacion={cotizacion} />;
  }

  return (
    <PageContainer>
      <CotizacionDetalleHeader
        cotizacion={cotizacion}
        nombreDestinatario={nombreDestinatario}
        onBack={() => navigate("/cotizaciones")}
        onExportarPdf={() => handleExportarPdf(cotizacion, tasaIva)}
        onEnviarEmail={canEdit ? () => setEnviarOpen(true) : undefined}
        yaEnviada={envios.length > 0}
      />

      <CotizacionInactivaBanner
        cotizacionId={cotizacion.id}
        estado={cotizacion.estado}
        updatedAt={cotizacion.updated_at}
        canEdit={canEdit}
      />

      <ReaprobacionTarifaBanner
        cotizacionId={cotizacion.id}
        estado={(cotizacion as { estado_revalidacion?: string }).estado_revalidacion}
        deltaJsonb={(cotizacion as { revalidacion_delta_jsonb?: unknown }).revalidacion_delta_jsonb}
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
          version={(cotizacion as { version?: number }).version ?? 1}
          tieneEmbarquesVinculados={embarquesVinculados.length > 0 || !!cotizacion.embarque_id}
          onCambiarEstado={handleCambiarEstado}
          onAbrirConvertir={abrirDialogConvertir}
        />
      )}



      {cotizacion.es_prospecto && (
        <ProspectoBanner
          empresa={cotizacion.prospecto_empresa}
          contacto={cotizacion.prospecto_contacto}
          email={cotizacion.prospecto_email}
          telefono={cotizacion.prospecto_telefono}
        />
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

      {cotizacion.comentario_cliente && <ComentarioClienteCard texto={cotizacion.comentario_cliente} />}
      {cotizacion.notas && <NotasCard texto={cotizacion.notas} />}

      <CotizacionDetalleEmbarques
        embarques={embarquesVinculados}
        cotizacionEstado={cotizacion.estado}
      />

      <HistorialEnviosCard envios={envios} />

      <VersionesCotizacionCard cotizacionId={cotizacion.id} />


      <DialogConvertirProspecto
        open={showConvertir}
        onOpenChange={setShowConvertir}
        clienteForm={clienteForm}
        setClienteForm={setClienteForm}
        onConvertir={handleConvertir}
        isPending={convertirProspecto.isPending}
      />

      <EnviarCotizacionDialog
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        cotizacion={cotizacion}
        totalMxn={totalMXN}
        totalUsd={totalUSD}
        tasaIva={tasaIva}
        envioPrevio={envios[0]}
      />

    </PageContainer>
  );
}

