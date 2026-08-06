/**
 * Documento del buzón CxP vinculado a una factura de proveedor. Sirve de
 * respaldo cuando la factura no tiene `archivo_pdf_url` / `archivo_xml_url`
 * (facturas capturadas antes del backfill de v13.427.0).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cxp } from "@/features/cxp/queryKeys";

export interface EntranteDeFactura {
  id: string;
  archivo_path: string | null;
  nombre_archivo: string | null;
  xml_path: string | null;
  xml_nombre: string | null;
}

async function fetchEntranteDeFactura(
  facturaId: string,
): Promise<EntranteDeFactura | null> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select("id, archivo_path, nombre_archivo, xml_path, xml_nombre")
    .eq("proveedor_factura_id", facturaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as EntranteDeFactura | null;
}

export function useEntranteDeFactura(facturaId: string | undefined, habilitado = true) {
  return useQuery({
    queryKey: [...cxp.facturasEntrantes, "de-factura", facturaId],
    queryFn: () => fetchEntranteDeFactura(facturaId!),
    enabled: Boolean(facturaId) && habilitado,
  });
}
