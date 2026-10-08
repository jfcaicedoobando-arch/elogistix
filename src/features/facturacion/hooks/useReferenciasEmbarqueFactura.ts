/** Referencias verificables por concepto, aisladas por factura y organización. */
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { fetchReferenciasFacturaPreview } from "../services/referenciasEmbarque";
import type { FacturaReferenciasInput } from "../domain/referenciasFacturaPreview";
import { queryKeys } from "@/lib/query";

// Compatibilidad de helpers existentes; el dominio no depende de React.
export { computeReferenciasFallback, hasAlgunaReferencia, formatearPrefijoReferencias } from "../domain/referenciasFacturaPreview";

export function useReferenciasEmbarqueFactura(factura: FacturaReferenciasInput | null | undefined) {
  const { organizationId, orgListo } = useOrgFilter();
  const scopeValido = Boolean(orgListo && organizationId && factura?.id && factura.organization_id === organizationId);
  const query = useQuery({
    queryKey: queryKeys.facturacion.referenciasEmbarque(organizationId, factura),
    enabled: scopeValido,
    staleTime: 0,
    retry: false,
    queryFn: () => fetchReferenciasFacturaPreview(factura!, organizationId!),
  });
  return { ...query, data: scopeValido ? query.data : undefined, scopeValido };
}
