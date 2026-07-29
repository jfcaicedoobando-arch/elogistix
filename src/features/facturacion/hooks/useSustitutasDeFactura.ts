/**
 * useSustitutasDeFactura — lista las facturas sustitutas disponibles para
 * cancelar por sustitución (motivo SAT "01"). Sólo se activa cuando el
 * diálogo está abierto y el motivo seleccionado lo requiere.
 */
import { useQuery } from "@tanstack/react-query";
import { listarSustitutas } from "@/features/facturacion/services/sustitutasDeFactura";
import { facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";

export function useSustitutasDeFactura(facturaId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: facturacionKeys.sustitutasDe(facturaId),
    queryFn: () => listarSustitutas(facturaId as string),
    enabled: !!facturaId && enabled,
    staleTime: 5_000,
  });
}
