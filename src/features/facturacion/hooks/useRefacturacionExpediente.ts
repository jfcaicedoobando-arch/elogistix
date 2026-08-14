/**
 * Carga el expediente de trazabilidad del caso de refacturación y lo deja
 * listo para pintar (eventos ya traducidos y ordenados).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  obtenerExpedienteRefacturacion,
  obtenerUltimoCasoIdRefacturacion,
} from "@/features/facturacion/services/refacturacionExpediente";
import { mapearEventos } from "@/features/facturacion/domain/refacturacionEventos";

/** Id del último caso ligado a una factura (como original o como nueva). */
export function useUltimoCasoRefacturacion(facturaId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.facturacion.refacturacionUltimoCaso(facturaId),
    queryFn: () => obtenerUltimoCasoIdRefacturacion(facturaId!),
    enabled: enabled && !!facturaId,
    staleTime: 60_000,
  });
}

export function useRefacturacionExpediente(casoId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.facturacion.refacturacionExpediente(casoId),
    queryFn: () => obtenerExpedienteRefacturacion(casoId!),
    enabled: enabled && !!casoId,
  });

  const eventos = useMemo(
    () => mapearEventos(query.data?.eventos ?? []),
    [query.data?.eventos],
  );

  return {
    expediente: query.data ?? null,
    eventos,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
