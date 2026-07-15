/**
 * Helper compartido entre `proyeccion/fetchSources.ts` y
 * `huecoFacturacion/fetchSources.ts`: trae las facturas externas (con PDF
 * cargado) para un set de expedientes. Evita divergencia silenciosa entre
 * los dos módulos cuando se añaden columnas o filtros.
 *
 * Fase 3 (crítico #3): acepta `organizationId` para defensa en profundidad.
 * Sin él, dos organizaciones que compartan número de expediente podrían
 * marcar como "Facturado" un expediente ajeno.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FacturaPorExpediente {
  expediente: string | null;
  factura_pdf_url: string | null;
}

export async function fetchFacturasPorExpedientes(
  expedientes: string[],
  organizationId?: string | null,
): Promise<FacturaPorExpediente[]> {
  if (expedientes.length === 0) return [];
  let q = supabase
    .from("facturas")
    .select("expediente, factura_pdf_url")
    .in("expediente", expedientes)
    .not("factura_pdf_url", "is", null);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
