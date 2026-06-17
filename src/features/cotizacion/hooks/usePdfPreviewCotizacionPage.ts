/**
 * Wrapper hook para la página dev /dev/pdf-preview/cotizacion/:id.
 * Encapsula los 2 `useQuery` (cotización + emisor) que antes vivían inline en la página.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchCotizacionById } from "@/features/cotizacion/services";
import { cargarEmisorEmpresa } from "@/pdf/emisor";

const EMISOR_KEY = ["pdf-emisor"] as const;

export function usePdfPreviewCotizacionPage(id: string | undefined) {
  const cotizacion = useQuery({
    queryKey: queryKeys.pdfPreviewCotizacion(id ?? ""),
    enabled: !!id,
    queryFn: () => fetchCotizacionById(id!),
  });
  const emisor = useQuery({
    queryKey: EMISOR_KEY,
    queryFn: () => cargarEmisorEmpresa(),
    staleTime: 5 * 60 * 1000,
  });
  return { cotizacion, emisor };
}
