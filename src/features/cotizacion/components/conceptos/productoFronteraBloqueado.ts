import type { ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { tipoIvaSeleccionable } from "@/lib/financial/ivaFrontera";

export function productoFronteraBloqueado(
  producto: Pick<ProductoCatalogo, "tipo_iva">,
  fronteraHabilitada: boolean,
): boolean {
  return !tipoIvaSeleccionable(producto.tipo_iva, fronteraHabilitada);
}