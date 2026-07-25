/**
 * Renderiza un Document de @react-pdf/renderer a Blob y dispara la descarga.
 * Reemplaza el flujo legacy `window.open + window.print()`.
 *
 * P12 (perf 2026-07-25): `@react-pdf/renderer` (~1.4 MB) se importa vía
 * `dynamic import` para que solo entre al bundle cuando el usuario dispara
 * una descarga. El `type DocumentProps` se importa como `type-only` para no
 * arrastrar runtime al chunk que consume esta función.
 */
import type { DocumentProps } from "@react-pdf/renderer";
import * as Sentry from "@sentry/react";
import type { ReactElement } from "react";
import { descargarBlob } from "@/lib/downloadBlob";

export async function descargarPdf(
  elemento: ReactElement<DocumentProps>,
  nombreArchivo: string,
): Promise<void> {
  const finalName = nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`;
  const { pdf } = await import("@react-pdf/renderer");
  await Sentry.startSpan(
    { name: "pdf.render", op: "pdf", attributes: { filename: finalName } },
    async (span) => {
      const blob = await pdf(elemento).toBlob();
      const sizeKb = Math.round(blob.size / 1024);
      span?.setAttribute("size_kb", sizeKb);
      // P3: métrica agregable de negocio (sin nombre de cliente/RFC, sólo prefijo).
      try {
        Sentry.metrics?.distribution?.("pdf.size_kb", sizeKb, {
          unit: "kilobyte",
          attributes: { prefix: finalName.split("-")[0] ?? "unknown" },
        });
      } catch { /* metrics es best-effort, no romper la descarga */ }
      descargarBlob(blob, finalName);
    },
  );
}
