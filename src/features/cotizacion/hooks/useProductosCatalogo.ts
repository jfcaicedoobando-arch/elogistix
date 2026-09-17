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
import {
  fetchProductosCatalogo,
  type ProductoCatalogo,
} from "@/features/cotizacion/services/productosCatalogoService";
import { queryKeys } from "@/lib/query";
import { tasaParaTotales } from "@/lib/financial/tipoIvaSat";

export type { ProductoCatalogo };

/**
 * Tasa numérica del producto para cálculos. Exento y "no objeto" devuelven 0;
 * el tratamiento exacto viaja aparte en `tipo_iva` (no se infiere de la tasa).
 */
export function tasaDesdeTipoIva(tipo: ProductoCatalogo["tipo_iva"]): number {
  return tasaParaTotales(tipo);
}

export function useProductosCatalogo(organizationId: string | null | undefined) {
  const query = useQuery<ProductoCatalogo[]>({
    queryKey: queryKeys.productosCatalogo(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchProductosCatalogo(organizationId as string),
  });

  const porNombre = useMemo(() => {
    const map = new Map<string, ProductoCatalogo>();
    for (const p of query.data ?? []) map.set(p.nombre.toLowerCase(), p);
    return map;
  }, [query.data]);

  return { ...query, productos: query.data ?? [], porNombre };
}
