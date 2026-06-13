/**
 * Adaptador thin: delega en CotizacionDocument (@react-pdf/renderer) y descarga
 * el blob resultante. Carga los datos del emisor desde `configuracion.empresa`.
 */
import type { CotizacionRow } from "@/features/cotizacion/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { cargarEmisorEmpresa } from "@/pdf/emisor";

export async function generarPdfCotizacion(
  cotizacion: CotizacionRow,
  tasaIva: number = TASA_IVA,
): Promise<void> {
  const emisor = await cargarEmisorEmpresa();
  await descargarPdf(
    <CotizacionDocument cotizacion={cotizacion} tasaIva={tasaIva} emisor={emisor} />,
    `${cotizacion.folio}-cotizacion`,
  );
}
