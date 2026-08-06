/**
 * Documento del buzón CxP vinculado a una factura de proveedor. Sirve de
 * respaldo cuando la factura no tiene `archivo_pdf_url` / `archivo_xml_url`
 * (facturas capturadas antes del backfill de v13.427.0).
 */
import { useQuery } from "@tanstack/react-query";
import { cxp } from "@/features/cxp/queryKeys";
import {
  fetchEntranteDeFactura,
  type EntranteDeFactura,
} from "@/features/cxp/services/entranteDeFactura";

export type { EntranteDeFactura };

export function useEntranteDeFactura(facturaId: string | undefined, habilitado = true) {
  return useQuery({
    queryKey: cxp.facturasEntrantesDeFactura(facturaId),
    queryFn: () => fetchEntranteDeFactura(facturaId!),
    enabled: Boolean(facturaId) && habilitado,
  });
}
