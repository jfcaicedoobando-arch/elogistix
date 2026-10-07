/**
 * Wrapper hook para la página dev /dev/pdf-preview/cotizacion/:id.
 * Encapsula los 2 `useQuery` (cotización + emisor) que antes vivían inline en la página.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchCotizacionById } from "@/features/cotizacion/services";
import { cargarEmisorDocumento } from "@/pdf/emisor";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export function usePdfPreviewCotizacionPage(id: string | undefined) {
  const { organizationId } = useOrgActiva();
  const cotizacion = useQuery({
    queryKey: queryKeys.cotizaciones.pdfPreview(id ?? "", organizationId),
    enabled: !!id && !!organizationId,
    queryFn: async () => {
      const scope = captureAuthOperationScope();
      const data = await fetchCotizacionById(id!);
      scope.assertCurrent();
      if (data && data.organization_id !== organizationId) {
        throw new Error("La organización del documento no coincide con la organización activa.");
      }
      return data;
    },
  });
  const documentoOrgId = cotizacion.data?.organization_id;
  const emisor = useQuery({
    queryKey: queryKeys.facturacion.emisorEmpresaPdf(documentoOrgId, organizationId),
    enabled: !!documentoOrgId && documentoOrgId === organizationId,
    queryFn: () => cargarEmisorDocumento(documentoOrgId!),
    staleTime: 5 * 60 * 1000,
  });
  return { cotizacion, emisor };
}
