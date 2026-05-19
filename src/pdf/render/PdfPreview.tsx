import { PDFViewer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

interface Props {
  doc: ReactElement<DocumentProps>;
  height?: string | number;
}

/**
 * Wrapper de <PDFViewer> para previsualizar un documento directamente en pantalla.
 * Útil en rutas /dev/pdf-preview para validar layout antes de descargar.
 */
export function PdfPreview({ doc, height = "85vh" }: Props) {
  return (
    <PDFViewer style={{ width: "100%", height, border: 0 }} showToolbar>
      {doc}
    </PDFViewer>
  );
}
