/**
 * Renderiza un Document de @react-pdf/renderer a Blob y dispara la descarga.
 * Reemplaza el flujo legacy `window.open + window.print()`.
 */
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

export async function descargarPdf(
  elemento: ReactElement<DocumentProps>,
  nombreArchivo: string,
): Promise<void> {
  const blob = await pdf(elemento).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Pequeño delay para que el navegador inicie la descarga antes de revocar.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
