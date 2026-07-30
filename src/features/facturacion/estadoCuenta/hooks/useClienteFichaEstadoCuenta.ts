/**
 * Ficha del cliente para el encabezado del Estado de cuenta (nombre, RFC y
 * condiciones de crédito). Reutiliza el servicio que ya alimenta el PDF.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchClienteFichaEstadoCuenta,
  type ClienteFichaEstadoCuenta,
} from "../services/clienteFicha";

export function useClienteFichaEstadoCuenta(clienteId: string | undefined) {
  return useQuery<ClienteFichaEstadoCuenta>({
    queryKey: ["cliente", "ficha-estado-cuenta", clienteId],
    queryFn: () => fetchClienteFichaEstadoCuenta(clienteId as string),
    enabled: Boolean(clienteId),
    staleTime: 5 * 60_000,
  });
}
