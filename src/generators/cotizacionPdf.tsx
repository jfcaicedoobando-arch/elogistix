/**
 * Adaptador thin: delega en CotizacionDocument (@react-pdf/renderer) y descarga
 * el blob resultante. Preserva la firma pública usada por CotizacionDetalle.
 */
import type { CotizacionRow } from "@/types/cotizacion";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";

export function generarPdfCotizacion(cotizacion: CotizacionRow, tasaIva: number = TASA_IVA): void {
  void descargarPdf(
    <CotizacionDocument cotizacion={cotizacion} tasaIva={tasaIva} />,
    `${cotizacion.folio}-cotizacion`,
  );
}
