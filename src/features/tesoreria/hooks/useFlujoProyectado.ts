import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFlujoProyectado } from "@/features/tesoreria/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useOrgFilter } from "@/hooks/shared";
import { useSaldosCuentas } from "./useTesoreriaCuentas";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";

export interface EstadoTasasFlujo {
  cargado: boolean;
  error: boolean;
  usdMxn?: number | null;
  eurMxn?: number | null;
  fecha?: string | null;
}

/**
 * MNY-NEW-05 — clave de caché de las tasas usadas por el flujo proyectado.
 *
 * Antes la query se keyeaba sólo por (días, organización): si el TC del DOF
 * todavía no había llegado, el flujo se calculaba y se cacheaba 60 s SIN las
 * monedas extranjeras aunque el TC llegara un instante después. La clave ahora
 * distingue USD/EUR/fecha y `null` cuando aún no hay respuesta estable, así
 * que la llegada del TC produce un cálculo nuevo (nunca paridad 1:1).
 */
export function claveTasasFlujo(estado: EstadoTasasFlujo): string | null {
  if (!estado.cargado) return null;
  if (estado.error) return "tc-error";
  const usd = estado.usdMxn ?? "sin";
  const eur = estado.eurMxn ?? "sin";
  const fecha = estado.fecha ?? "sin";
  return `usd:${usd}|eur:${eur}|f:${fecha}`;
}

export function useFlujoProyectado(dias = 90) {
  const { organizationId } = useOrgFilter();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const cuentasQ = useSaldosCuentas();
  const tcQ = useExchangeRates();

  // La respuesta del TC es "estable" cuando la consulta terminó (éxito o
  // error): con error se sigue adelante y las divisas quedan marcadas como
  // excluidas por la propia conversión canónica.
  const claveTc = claveTasasFlujo({
    cargado: tcQ.isSuccess || tcQ.isError,
    error: tcQ.isError,
    usdMxn: tcQ.data?.usdMxn,
    eurMxn: tcQ.data?.eurMxn,
    fecha: tcQ.data?.fechaAplicada ?? null,
  });

  const ready =
    Array.isArray(cobranzaQ.data) &&
    Array.isArray(cxpQ.data) &&
    Array.isArray(cuentasQ.data) &&
    claveTc !== null;

  return useQuery({
    queryKey: queryKeys.tesoreria.flujoProyectadoPorOrg(
      dias,
      organizationId ?? null,
      claveTc,
    ),
    queryFn: () =>
      fetchFlujoProyectado({
        cuentas: cuentasQ.data!,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
        dias,
        organizationId: organizationId ?? null,
        tipoCambioUsd: tcQ.data?.usdMxn,
        tipoCambioEur: tcQ.data?.eurMxn,
        tipoCambioFecha: tcQ.data?.fechaAplicada ?? null,
      }),
    enabled: ready && !!organizationId,
    staleTime: 60_000,
  });
}
