/**
 * Compone el resumen de tesorería a partir de cobranza (CxC) + CxP + saldos.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { calcularResumenTesoreria, type ResumenTesoreria } from "@/features/tesoreria/domain";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useSaldosCuentas } from "./useTesoreriaCuentas";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";

export function useResumenTesoreria(): {
  data: ResumenTesoreria | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} {
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const cuentasQ = useSaldosCuentas();
  const tcQ = useExchangeRates();

  const isLoading = cobranzaQ.isLoading || cxpQ.isLoading || cuentasQ.isLoading;
  const error = cobranzaQ.error ?? cxpQ.error ?? cuentasQ.error;
  const ready = Array.isArray(cobranzaQ.data) && Array.isArray(cxpQ.data) && Array.isArray(cuentasQ.data);

  const data = ready
    ? calcularResumenTesoreria({
        cuentas: cuentasQ.data!,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
        tipoCambioUsd: tcQ.data?.usdMxn,
        tipoCambioEur: tcQ.data?.eurMxn,
        tipoCambioFecha: tcQ.data?.fechaAplicada ?? null,
      })
    : undefined;

  const isError = Boolean(error);
  const refetch = () => {
    void cobranzaQ.refetch();
    void cxpQ.refetch();
    void cuentasQ.refetch();
  };
  return { data, isLoading, isError, error, refetch };
}
