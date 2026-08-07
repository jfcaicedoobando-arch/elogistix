/**
 * Hook del estado de cuenta bancario (v13.450.0).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchEstadoCuentaBancario } from "@/features/tesoreria/services/estadoCuenta";

export function useEstadoCuenta(
  cuentaBancariaId: string | null,
  desde: string,
  hasta: string,
) {
  return useQuery({
    queryKey: queryKeys.tesoreria.estadoCuenta(cuentaBancariaId, desde, hasta),
    queryFn: () => fetchEstadoCuentaBancario(cuentaBancariaId!, desde, hasta),
    enabled: !!cuentaBancariaId && !!desde && !!hasta,
    staleTime: 30_000,
  });
}
