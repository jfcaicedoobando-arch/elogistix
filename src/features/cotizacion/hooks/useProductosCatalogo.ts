/**
 * Hook — Catálogo de productos/servicios por organización.
 *
 * Devuelve los productos activos disponibles para capturar en cotizaciones.
 * Es la fuente única de verdad: el wizard de cotización sólo puede usar
 * productos dados de alta aquí (política "solo del catálogo").
 *
 * Fuente: tabla `catalogo_claves_sat` (nombre histórico), donde:
 *   - `patron` = nombre visible del producto.
 *   - `clave_sat`, `tipo_iva`, `tasa_iva_default`, `clave_unidad_sat`,
 *     `nombre_unidad` viajan al concepto al seleccionarlo.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function tasaDesdeTipoIva(tipo: ProductoCatalogo["tipo_iva"]): number {
  if (tipo === "gravado_16") return 0.16;
  if (tipo === "tasa_0") return 0;
  return 0; // exento — no genera IVA; el flag aplica_iva se apaga.
}

export function useProductosCatalogo(organizationId: string | null | undefined) {
  const query = useQuery<ProductoCatalogo[]>({
    queryKey: ["productos_catalogo", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
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
    },
  });

  const porNombre = useMemo(() => {
    const map = new Map<string, ProductoCatalogo>();
    for (const p of query.data ?? []) map.set(p.nombre.toLowerCase(), p);
    return map;
  }, [query.data]);

  return { ...query, productos: query.data ?? [], porNombre };
}
