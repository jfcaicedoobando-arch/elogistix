/**
 * Resolución server-side de búsqueda libre para listados de Compras que
 * necesitan filtrar por proveedor/folio, pero esos campos viven en
 * `proveedor_facturas`/`proveedores` (tablas embebidas). PostgREST no
 * soporta un único `.or()` que mezcle columnas de la tabla raíz con
 * columnas de tablas embebidas distintas, así que resolvemos primero los
 * `proveedor_factura_id` candidatos con dos queries acotadas y luego el
 * caller los combina con `.or()` sobre sus propias columnas (ver
 * pagosGlobal.ts / notasCreditoGlobal.ts).
 */
import { supabase } from "@/integrations/supabase/client";
import { CAP_POSTGREST } from "@/constants/queryCaps";
import { ilikePattern, orIlike } from "@/lib/search/ilike";

export async function resolverFacturaIdsPorBusqueda(search: string): Promise<string[]> {
  const like = ilikePattern(search);

  const [facturasRes, proveedoresRes] = await Promise.all([
    supabase
      .from("proveedor_facturas")
      .select("id")
      .is("deleted_at", null)
      .or(orIlike(["folio_interno", "folio_proveedor"], search))
      .limit(CAP_POSTGREST),
    supabase.from("proveedores").select("id").ilike("nombre", like).limit(CAP_POSTGREST),
  ]);
  if (facturasRes.error) throw facturasRes.error;
  if (proveedoresRes.error) throw proveedoresRes.error;

  const idsDirectos = (facturasRes.data ?? []).map((r) => (r as { id: string }).id);
  const proveedorIds = (proveedoresRes.data ?? []).map((r) => (r as { id: string }).id);

  let idsPorProveedor: string[] = [];
  if (proveedorIds.length > 0) {
    const { data, error } = await supabase
      .from("proveedor_facturas")
      .select("id")
      .is("deleted_at", null)
      .in("proveedor_id", proveedorIds)
      .limit(CAP_POSTGREST);
    if (error) throw error;
    idsPorProveedor = (data ?? []).map((r) => (r as { id: string }).id);
  }

  return Array.from(new Set([...idsDirectos, ...idsPorProveedor]));
}
