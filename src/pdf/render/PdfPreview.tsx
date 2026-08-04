import { lazy, Suspense, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  doc: ReactElement<DocumentProps>;
  height?: string | number;
}

// Lazy: @react-pdf/renderer pesa ~250-450 KB. Evita incluirlo en el bundle
// de cualquier ruta que sólo importe el tipo de wrapper.
const LazyPDFViewer = lazy(() =>
  import("@react-pdf/renderer").then((m) => ({ default: m.PDFViewer })),
);

/**
 * Wrapper de <PDFViewer> para previsualizar un documento directamente en pantalla.
 * Útil en rutas /dev/pdf-preview para validar layout antes de descargar.
 */
export function PdfPreview({ doc, height = "85vh" }: Props) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" className="p-4 space-y-2">
          <span className="sr-only">Cargando visor PDF…</span>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <LazyPDFViewer style={{ width: "100%", height, border: 0 }} showToolbar>
        {doc}
      </LazyPDFViewer>
    </Suspense>
  );
}
