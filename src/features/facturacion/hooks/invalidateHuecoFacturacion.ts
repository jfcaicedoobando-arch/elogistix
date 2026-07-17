/**
 * Helper compartido para invalidar el cache del "Hueco de Facturación".
 * Todas las mutaciones que puedan cambiar la relación embarque↔factura
 * (timbrar, cancelar, sustituir, crear manual, eliminar borrador, editar
 * conceptos) deben llamarlo para que la bandeja refresque.
 */
import type { QueryClient } from "@tanstack/react-query";
import { HUECO_QUERY_KEY_PREFIX } from "@/features/facturacion/services/huecoFacturacion/constants";

export function invalidateHuecoFacturacion(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: HUECO_QUERY_KEY_PREFIX });
}
