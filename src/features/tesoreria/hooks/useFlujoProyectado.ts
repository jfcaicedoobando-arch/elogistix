import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFlujoProyectado } from "@/features/tesoreria/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useOrgFilter } from "@/hooks/shared";
import { useSaldosCuentas } from "./index";

export function useFlujoProyectado(dias = 90) {
  const { organizationId } = useOrgFilter();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const cuentasQ = useSaldosCuentas();

  const ready =
    Array.isArray(cobranzaQ.data) && Array.isArray(cxpQ.data) && Array.isArray(cuentasQ.data);

  return useQuery({
    queryKey: queryKeys.tesoreria.flujoProyectadoPorOrg(dias, organizationId ?? null),
    queryFn: () =>
      fetchFlujoProyectado({
        cuentas: cuentasQ.data!,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
        dias,
        organizationId: organizationId ?? null,
      }),
    enabled: ready,
    staleTime: 60_000,
  });
}
