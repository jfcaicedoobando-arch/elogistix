/**
 * Renderiza un Document de @react-pdf/renderer a Blob y dispara la descarga.
 * Reemplaza el flujo legacy `window.open + window.print()`.
 *
 * La descarga + revocación del Object URL se delega en `descargarBlob`
 * (patrón defensivo con `finally` + delay) centralizado en 12.61.8.
 */
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { descargarBlob } from "@/lib/downloadBlob";

export async function descargarPdf(
  elemento: ReactElement<DocumentProps>,
  nombreArchivo: string,
): Promise<void> {
  const blob = await pdf(elemento).toBlob();
  const finalName = nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`;
  descargarBlob(blob, finalName);
}
