import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFlujoProyectado } from "@/features/tesoreria/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useSaldosCuentas } from "./index";

export function useFlujoProyectado(dias = 90) {
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const cuentasQ = useSaldosCuentas();

  const ready = !!cobranzaQ.data && !!cxpQ.data && !!cuentasQ.data;

  return useQuery({
    queryKey: queryKeys.tesoreria.flujoProyectado(dias),
    queryFn: () =>
      fetchFlujoProyectado({
        cuentas: cuentasQ.data!,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
        dias,
      }),
    enabled: ready,
    staleTime: 60_000,
  });
}
