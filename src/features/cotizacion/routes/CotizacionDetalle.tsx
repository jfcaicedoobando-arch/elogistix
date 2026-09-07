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
import { usePdfExport } from "@/hooks/shared/usePdfExport";
import { notifyError } from "@/lib/ui/appFeedback";

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
    convertirProspecto, navigate, aceptar,
  } = useCotizacionDetalleState(id);

  // M14 (Ola 7): sin este guard, dos clics rápidos generaban dos PDF y
  // cualquier error del generador se perdía en consola sin avisar al usuario.
  const { isExporting, run } = usePdfExport({ method: "EXPORTAR_PDF_COTIZACION" });

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
              onExportarPdf={() => {
                // B-081: no generamos PDF en $0.00 (se enviaban cotizaciones vacías).
                if (totalUSD + totalMXN <= 0) {
                  notifyError(undefined, {
                    title: "La cotización no tiene importes",
                    description: "Los conceptos de venta suman $0.00. Revisa la sección de costos y sincroniza los conceptos de venta antes de descargar el PDF.",
                  });
                  return;
                }
                void run(() => handleExportarPdf(cotizacion, tasaIva));
              }}
              exportandoPdf={isExporting}
              onEnviarEmail={canEdit ? () => setEnviarOpen(true) : undefined}
              yaEnviada={envios.length > 0}
            />

            <CotizacionDetalleContenido
              cotizacion={cotizacion}
              id={id!}
              canEdit={canEdit}
              effectiveRole={effectiveRole as AppRole | null}
              embarquesVinculados={embarquesVinculados}
              envios={envios}
              totales={{
                tasaIva, conceptosVentaUSD, conceptosVentaMXN,
                totalUSD, subtotalMXN, ivaMXN, totalMXN, conceptosDescartados,
              }}
              dialogos={{ showConvertir, setShowConvertir, enviarOpen, setEnviarOpen }}
              acciones={{
                clienteForm, setClienteForm, handleCambiarEstado,
                abrirDialogConvertir, handleConvertir, convertirProspecto, navigate,
                aceptar,
              }}
            />
          </>
        )}
      </CargaGuard>
    </PageContainer>
  );
}
