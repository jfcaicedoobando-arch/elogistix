/**
 * Renderiza un Document de @react-pdf/renderer a Blob y dispara la descarga.
 * Reemplaza el flujo legacy `window.open + window.print()`.
 *
 * La descarga + revocación del Object URL se delega en `descargarBlob`
 * (patrón defensivo con `finally` + delay) centralizado en 12.61.8.
 *
 * Observabilidad: envuelto en `Sentry.startSpan({ op: 'pdf' })` para medir la
 * latencia real del render (la queja #1 históricamente). El nombre del archivo
 * va como atributo, sin datos sensibles del contenido.
 */
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import * as Sentry from "@sentry/react";
import type { ReactElement } from "react";
import { descargarBlob } from "@/lib/downloadBlob";

export async function descargarPdf(
  elemento: ReactElement<DocumentProps>,
  nombreArchivo: string,
): Promise<void> {
  const finalName = nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`;
  await Sentry.startSpan(
    { name: "pdf.render", op: "pdf", attributes: { filename: finalName } },
    async (span) => {
      const blob = await pdf(elemento).toBlob();
      span?.setAttribute("size_kb", Math.round(blob.size / 1024));
      descargarBlob(blob, finalName);
    },
  );
}
