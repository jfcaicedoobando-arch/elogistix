import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchEmbarqueCostosDetalle,
  fetchEmbarqueVentasDetalle,
  fetchEmbarqueDocumentosDetalle,
  fetchEmbarqueFacturasDetalle,
  fetchEmbarqueNotasDetalle,
} from "@/features/embarques/services/queries/detalleSecciones";

export function useEmbarqueConceptosDetalle(embarqueId: string, enabled = true) {
  const ventas = useQuery({
    queryKey: queryKeys.embarques.conceptosVentaDetalle(embarqueId),
    queryFn: () => fetchEmbarqueVentasDetalle(embarqueId),
    enabled,
    staleTime: 30_000,
  });
  const costos = useQuery({
    queryKey: queryKeys.embarques.conceptosCostoDetalle(embarqueId),
    queryFn: () => fetchEmbarqueCostosDetalle(embarqueId),
    enabled,
    staleTime: 30_000,
  });
  return {
    conceptosVenta: ventas.data,
    conceptosCosto: costos.data,
    isLoading: ventas.isLoading || costos.isLoading,
    isError: ventas.isError || costos.isError,
    refetch: () => Promise.all([ventas.refetch(), costos.refetch()]),
  };
}

export function useEmbarqueDocumentosDetalle(embarqueId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.embarques.documentos(embarqueId),
    queryFn: () => fetchEmbarqueDocumentosDetalle(embarqueId),
    enabled,
    staleTime: 30_000,
  });
}

export function useEmbarqueNotasDetalle(embarqueId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.embarques.notas(embarqueId),
    queryFn: () => fetchEmbarqueNotasDetalle(embarqueId),
    enabled,
    staleTime: 30_000,
  });
}

export function useEmbarqueFacturasDetalle(embarqueId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.embarques.facturas(embarqueId),
    queryFn: () => fetchEmbarqueFacturasDetalle(embarqueId),
    enabled,
    staleTime: 30_000,
  });
}
