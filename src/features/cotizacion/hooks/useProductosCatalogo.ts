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
import { queryKeys } from "@/lib/query";
  fetchProductosCatalogo,
  type ProductoCatalogo,
} from "@/features/cotizacion/services/productosCatalogoService";

export type { ProductoCatalogo };

export function tasaDesdeTipoIva(tipo: ProductoCatalogo["tipo_iva"]): number {
  if (tipo === "gravado_16") return 0.16;
  if (tipo === "tasa_0") return 0;
  return 0; // exento — no genera IVA; el flag aplica_iva se apaga.
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
