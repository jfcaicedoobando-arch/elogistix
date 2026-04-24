import * as pdfjsLib from "pdfjs-dist";
// Worker como URL (Vite resuelve el asset)
// @ts-expect-error - import de worker como URL
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extrae el folio de una factura CFDI buscando el patrón "FOLIO: XXX" en el PDF.
 * Devuelve el folio como string si lo encuentra, o null si no.
 */
export async function extraerFolioDesdePdf(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Recorrer todas las páginas (normalmente las facturas son 1 página)
    let textoCompleto = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? (item as { str: string }).str : ""))
        .join(" ");
      textoCompleto += " " + pageText;
    }

    // Buscar patrón FOLIO: XXX (case-insensitive, soporta espacios y guiones)
    // Probar varios patrones comunes en CFDI mexicanos
    const patrones = [
      /FOLIO\s*[:#]?\s*([A-Z]?\d+)/i,
      /FOLIO\s+FISCAL\s*[:#]?\s*([A-Z0-9-]+)/i,
      /N[ÚU]MERO\s+DE\s+FOLIO\s*[:#]?\s*([A-Z]?\d+)/i,
    ];

    for (const regex of patrones) {
      const match = textoCompleto.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  } catch (err) {
    console.error("Error al leer PDF para extraer folio:", err);
    return null;
  }
}
