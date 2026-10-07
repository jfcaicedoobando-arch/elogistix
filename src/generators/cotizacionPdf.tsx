/**
 * Adaptador thin: delega en CotizacionDocument (@react-pdf/renderer) y descarga
 * el blob resultante. Carga los datos del emisor desde `configuracion.empresa`
 * y el catálogo de tipos de contenedor (incluye inactivos) en paralelo para
 * resolver `tipo_contenedor` (UUID) a su nombre legible en el PDF.
 */
import type { CotizacionRow } from "@/features/cotizacion/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
// P12: CotizacionDocument se carga dinámicamente para no arrastrar @react-pdf en el bundle inicial.
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { cargarEmisorDocumento } from "@/pdf/emisor";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { fetchTiposContenedor } from "@/features/catalogos/services";
import { slugifyOrg } from "@/lib/filenames";

export async function generarPdfCotizacion(
  cotizacion: CotizacionRow,
  tasaIva: number = TASA_IVA,
): Promise<void> {
  const scope = captureAuthOperationScope();
  const [emisor, tiposContenedor, { CotizacionDocument }] = await Promise.all([
    cargarEmisorDocumento(cotizacion.organization_id),
    fetchTiposContenedor(true).catch(() => []),
    import("@/pdf/documents/CotizacionDocument"),
  ]);
  scope.assertCurrent();
  await descargarPdf(
    <CotizacionDocument
      cotizacion={cotizacion}
      tasaIva={tasaIva}
      emisor={emisor}
      tiposContenedor={tiposContenedor}
    />,
    `${slugifyOrg(emisor.organizacionNombre || emisor.razonSocial)}_${cotizacion.folio}-cotizacion`,
  );
}
