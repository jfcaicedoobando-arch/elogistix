import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";
import { consultarEstadoFacturasLote, errorEstadoFacturasLote } from "../services/pagoProveedorLotePreflight";
import type { FacturaLoteCandidata } from "../services/pagoProveedorLote";

export function usePagoLotePreflight(open: boolean, facturas: FacturaLoteCandidata[], proveedorId: string, moneda: string) {
  const { organizationId } = useOrganization();
  const ids = facturas.map((f) => f.factura_id).sort();
  const query = useQuery({
    queryKey: queryKeys.cxp.pagoLotePreflight(ids, organizationId),
    queryFn: () => consultarEstadoFacturasLote(ids, organizationId ?? ""),
    enabled: open && Boolean(organizationId) && ids.length > 0,
    staleTime: 0,
  });
  const estados = query.data ?? [];
  const error = !organizationId ? "Selecciona una organización antes de registrar pagos."
    : query.isError ? "No se pudo verificar la aprobación de las facturas. Reintenta la consulta."
    : query.isPending || query.isFetching ? "Verificando la aprobación de las facturas…"
    : errorEstadoFacturasLote(ids, estados, proveedorId, moneda);
  return {
    facturas: facturas.map((f) => ({ ...f, estado_aprobacion: estados.find((e) => e.id === f.factura_id)?.estado_aprobacion ?? null })),
    pendiente: !query.isSuccess,
    error,
    reintentar: query.refetch,
    fallo: query.isError,
  };
}
