import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchReportesResumen } from "@/features/reportes/services";
import { getSuperAdminOrg } from "@/services/organization";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

interface FiltrosRentabilidad {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

import type { RentabilidadCliente } from "@/types/rentabilidad";
;

/**
 * v8.173.0 (Ola B.4): consume el RPC `reportes_resumen` que devuelve filas +
 * KPIs agregados en una sola llamada. Antes la agregación se hacía
 * client-side a partir de `profit_por_cliente`.
 */
export function useRentabilidadClientes(filtros: FiltrosRentabilidad) {
  const { organizationId, loading: organizationLoading } = useOrganization();
  // Espera un commit del tenant antes de iniciar la query: en el arranque,
  // OrganizationProvider sincroniza el ámbito global durante sus efectos.
  const [committedOrgId, setCommittedOrgId] = useState<string | null>(null);
  useEffect(() => { setCommittedOrgId(organizationId); }, [organizationId]);
  const scopeReady = !organizationLoading && committedOrgId === organizationId;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.reportes.rentabilidadClientes(filtros, organizationId),
    enabled: Boolean(organizationId) && scopeReady,
    queryFn: async () => {
      const scope = captureAuthOperationScope();
      const serverOrg = await getSuperAdminOrg();
      const assertTenant = (resolvedOrg: string | null) => {
        scope.assertCurrent();
        if (!organizationId || scope.organizationId !== organizationId || resolvedOrg !== organizationId) {
          throw new Error("La organización del reporte aún no está sincronizada. Intenta de nuevo.");
        }
      };
      // reportes_resumen usa el tenant del servidor. No basta con cambiar el
      // encabezado local mientras setSuperAdminOrg todavía está pendiente.
      assertTenant(serverOrg);
      const result = await fetchReportesResumen(filtros);
      scope.assertCurrent();
      assertTenant(await getSuperAdminOrg());
      return { ...result, organizationId };
    },
  });
  const isDataReady = scopeReady && !isFetching && !isError
    && Boolean(organizationId) && data?.organizationId === organizationId;

  const clientes: RentabilidadCliente[] = useMemo(
    () => isDataReady ? data?.clientes ?? [] : [],
    [data, isDataReady],
  );

  const kpis = useMemo(
    () => (isDataReady ? data?.kpis : null) ?? { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0, embarquesSinTc: 0 },
    [data, isDataReady],
  );

  return { clientes, kpis, isLoading: !scopeReady || isLoading || isFetching, isError, refetch,
    isDataReady, dataOrganizationId: isDataReady ? data?.organizationId : null };
}
