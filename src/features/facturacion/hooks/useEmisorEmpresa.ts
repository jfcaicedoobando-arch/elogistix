/**
 * useEmisorEmpresa — datos del emisor (razón social, RFC) de la empresa
 * configurados para timbrado fiscal.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEmisorEmpresa } from "@/features/configuracion/services";
import { queryKeys } from "@/lib/query";

export function useEmisorEmpresa() {
  return useQuery({
    queryKey: queryKeys.facturacion.emisorEmpresa,
    queryFn: fetchEmisorEmpresa,
    staleTime: 5 * 60 * 1000,
  });
}
