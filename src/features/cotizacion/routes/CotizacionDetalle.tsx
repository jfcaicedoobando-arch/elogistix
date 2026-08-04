import { useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";
import { useParams } from "react-router-dom";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { CotizacionDetalleContenido } from "@/features/cotizacion/components/detalle/CotizacionDetalleContenido";
import { useCotizacionDetalleState } from "@/features/cotizacion/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { FileX } from "lucide-react";

import { CotizacionDetalleHeader } from "@/features/cotizacion/components/detalle/CotizacionDetalleHeader";
import { useHistorialEnviosCotizacion } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";
import CotizacionInformativaDetalle from "./CotizacionInformativaDetalle";

// Lazy-loaded PDF generator (jsPDF + autotable are heavy; only load on demand)
const handleExportarPdf = async (cotizacion: Parameters<typeof import("@/generators/cotizacionPdf").generarPdfCotizacion>[0], tasaIva: number) => {
  const { generarPdfCotizacion } = await import("@/generators/cotizacionPdf");
  await generarPdfCotizacion(cotizacion, tasaIva);
};

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const { effectiveRole } = useAuth();

  const {
    cotizacion, isLoading, error, refetch, canEdit, tasaIva, embarquesVinculados,
    conceptosVentaUSD, conceptosVentaMXN,
    totalUSD, subtotalMXN, ivaMXN, totalMXN, conceptosDescartados,
    nombreDestinatario,
    showConvertir, setShowConvertir,
    clienteForm, setClienteForm,
    handleCambiarEstado, abrirDialogConvertir, handleConvertir,
    convertirProspecto, navigate,
  } = useCotizacionDetalleState(id);

  const [enviarOpen, setEnviarOpen] = useState(false);
  const { data: envios = [] } = useHistorialEnviosCotizacion(cotizacion?.id);

  useRegisterBreadcrumbLabel(id, cotizacion?.folio);

  if (!isLoading && !error && !cotizacion) {
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

  if (cotizacion?.tipo_documento === "informativa") {
    return <CotizacionInformativaDetalle cotizacion={cotizacion} />;
  }

  return (
    <PageContainer>
      <CargaGuard
        isLoading={isLoading}
        isError={!!error}
        onRetry={() => refetch()}
        errorTitle="No pudimos cargar la cotización"
        errorDescription="Revisa tu conexión e intenta de nuevo."
      >
        {isLoading || !cotizacion ? (
          <DetailSkeleton sections={1} />
        ) : (
          <>
            <CotizacionDetalleHeader
              cotizacion={cotizacion}
              nombreDestinatario={nombreDestinatario}
              onBack={() => navigate("/cotizaciones")}
              onExportarPdf={() => handleExportarPdf(cotizacion, tasaIva)}
              onEnviarEmail={canEdit ? () => setEnviarOpen(true) : undefined}
              yaEnviada={envios.length > 0}
            />

            <CotizacionDetalleContenido
              cotizacion={cotizacion}
              id={id!}
              canEdit={canEdit}
              tasaIva={tasaIva}
              embarquesVinculados={embarquesVinculados}
              conceptosVentaUSD={conceptosVentaUSD}
              conceptosVentaMXN={conceptosVentaMXN}
              totalUSD={totalUSD}
              subtotalMXN={subtotalMXN}
              ivaMXN={ivaMXN}
              totalMXN={totalMXN}
              conceptosDescartados={conceptosDescartados}
              showConvertir={showConvertir}
              setShowConvertir={setShowConvertir}
              clienteForm={clienteForm}
              setClienteForm={setClienteForm}
              handleCambiarEstado={handleCambiarEstado}
              abrirDialogConvertir={abrirDialogConvertir}
              handleConvertir={handleConvertir}
              convertirProspecto={convertirProspecto}
              navigate={navigate}
              effectiveRole={effectiveRole as AppRole | null}
              envios={envios}
              enviarOpen={enviarOpen}
              setEnviarOpen={setEnviarOpen}
            />
          </>
        )}
      </CargaGuard>
    </PageContainer>
  );
}
