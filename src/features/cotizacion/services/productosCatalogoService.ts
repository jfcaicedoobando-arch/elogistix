/**
 * Servicio — Catálogo de productos/servicios por organización.
 *
 * Encapsula el acceso a `catalogo_claves_sat` para que los hooks/contexts
 * no importen el cliente Supabase directo (regla arquitectónica).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  clave_sat: string;
  tipo_iva: "gravado_16" | "tasa_0" | "exento";
  tasa_iva_default: number | null;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

export async function fetchProductosCatalogo(
  _organizationId: string,
): Promise<ProductoCatalogo[]> {
  const { data, error } = await supabase
    .from("catalogo_claves_sat")
    .select("id, patron, clave_sat, tipo_iva, tasa_iva_default, clave_unidad_sat, nombre_unidad, activo")
    .eq("activo", true)
    .order("patron", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.patron,
    clave_sat: r.clave_sat,
    tipo_iva: r.tipo_iva as ProductoCatalogo["tipo_iva"],
    tasa_iva_default: r.tasa_iva_default,
    clave_unidad_sat: r.clave_unidad_sat,
    nombre_unidad: r.nombre_unidad,
  }));
}
