/**
 * Helper compartido entre `proyeccion/fetchSources.ts` y
 * `huecoFacturacion/fetchSources.ts`: trae las facturas externas (con PDF
 * cargado) para un set de expedientes. Evita divergencia silenciosa entre
 * los dos módulos cuando se añaden columnas o filtros.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FacturaPorExpediente {
  expediente: string | null;
  factura_pdf_url: string | null;
}

export async function fetchFacturasPorExpedientes(
  expedientes: string[],
): Promise<FacturaPorExpediente[]> {
  if (expedientes.length === 0) return [];
  const { data, error } = await supabase
    .from("facturas")
    .select("expediente, factura_pdf_url")
    .in("expediente", expedientes)
    .not("factura_pdf_url", "is", null);
  if (error) throw error;
  return data ?? [];
}
