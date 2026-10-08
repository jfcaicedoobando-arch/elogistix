/**
 * Ruta dev: /dev/pdf-preview/cotizacion/:id
 * Renderiza CotizacionDocument dentro de <PDFViewer> para validar layout
 * antes de cablear el botón de descarga en producción.
 */
import { useParams } from "react-router";
import { useTasaIVA, useTiposContenedor } from "@/features/catalogos/hooks";
import { usePdfPreviewCotizacionPage } from "@/features/cotizacion/hooks/usePdfPreviewCotizacionPage";
import { PdfPreview } from "@/pdf/render/PdfPreview";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { LoadingState } from "@/components/shared/states/LoadingState";

export default function PdfPreviewCotizacionPage() {
  const { id } = useParams<{ id: string }>();
  const tasaIva = useTasaIVA();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const { cotizacion: { data, isLoading, error }, emisor: { data: emisor, isLoading: emisorLoading, error: emisorError } } =
    usePdfPreviewCotizacionPage(id);

  if (isLoading || emisorLoading) return <LoadingState label="Cargando cotización…" />;
  if (error || emisorError) return <div className="p-6 text-destructive">Error: {((error || emisorError) as Error).message}</div>;
  if (!data) return <div className="p-6">Cotización no encontrada.</div>;

  return (
    <div className="h-dvh w-dvw bg-muted/30">
      <PdfPreview
        doc={<CotizacionDocument cotizacion={data} tasaIva={tasaIva} emisor={emisor} tiposContenedor={tiposContenedor} />}
        height="100vh"
      />
    </div>
  );
}
