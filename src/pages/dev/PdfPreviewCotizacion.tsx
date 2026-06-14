/**
 * Ruta dev: /dev/pdf-preview/cotizacion/:id
 * Renderiza CotizacionDocument dentro de <PDFViewer> para validar layout
 * antes de cablear el botón de descarga en producción.
 */
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { fetchCotizacionById } from "@/features/cotizacion/services";
import { PdfPreview } from "@/pdf/render/PdfPreview";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { queryKeys } from "@/lib/query";

export default function PdfPreviewCotizacionPage() {
  const { id } = useParams<{ id: string }>();
  const tasaIva = useTasaIVA();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.pdfPreviewCotizacion(id ?? ""),
    enabled: !!id,
    queryFn: () => fetchCotizacionById(id!),
  });
  const { data: emisor } = useQuery({
    queryKey: ["pdf-emisor"],
    queryFn: () => cargarEmisorEmpresa(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando cotización…</div>;
  if (error) return <div className="p-6 text-destructive">Error: {(error as Error).message}</div>;
  if (!data) return <div className="p-6">Cotización no encontrada.</div>;

  return (
    <div className="h-screen w-screen bg-muted/30">
      <PdfPreview
        doc={<CotizacionDocument cotizacion={data} tasaIva={tasaIva} emisor={emisor} />}
        height="100vh"
      />
    </div>
  );
}
