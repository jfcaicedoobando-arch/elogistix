import { lazy, Suspense, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

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
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Cargando visor PDF…</div>}>
      <LazyPDFViewer style={{ width: "100%", height, border: 0 }} showToolbar>
        {doc}
      </LazyPDFViewer>
    </Suspense>
  );
}
