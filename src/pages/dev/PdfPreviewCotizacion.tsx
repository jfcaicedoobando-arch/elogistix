/**
 * Ruta dev: /dev/pdf-preview/cotizacion/:id
 * Renderiza CotizacionDocument dentro de <PDFViewer> para validar layout
 * antes de cablear el botón de descarga en producción.
 */
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTasaIVA } from "@/hooks/catalogos/useTasaIVA";
import type { CotizacionRow } from "@/types/cotizacion";
import { PdfPreview } from "@/pdf/render/PdfPreview";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";

export default function PdfPreviewCotizacionPage() {
  const { id } = useParams<{ id: string }>();
  const tasaIva = useTasaIVA();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pdf-preview-cotizacion", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CotizacionRow | null;
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando cotización…</div>;
  if (error) return <div className="p-6 text-destructive">Error: {(error as Error).message}</div>;
  if (!data) return <div className="p-6">Cotización no encontrada.</div>;

  return (
    <div className="h-screen w-screen bg-muted/30">
      <PdfPreview doc={<CotizacionDocument cotizacion={data} tasaIva={tasaIva} />} height="100vh" />
    </div>
  );
}
