/**
 * Compone el resumen de tesorería a partir de cobranza (CxC) + CxP + saldos.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { useMemo } from "react";
import { useDiaNegocio } from "@/hooks/shared/useDiaNegocio";
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
  const diaNegocio = useDiaNegocio();

  const isLoading = cobranzaQ.isLoading || cxpQ.isLoading || cuentasQ.isLoading;
  const error = cobranzaQ.error ?? cxpQ.error ?? cuentasQ.error;
  const data = useMemo(() => {
    if (!Array.isArray(cobranzaQ.data) || !Array.isArray(cxpQ.data) || !Array.isArray(cuentasQ.data)) return undefined;
    return calcularResumenTesoreria({
      cuentas: cuentasQ.data,
      cobranza: cobranzaQ.data,
      cxp: cxpQ.data,
      hoy: new Date(`${diaNegocio}T00:00:00`),
      tipoCambioUsd: tcQ.data?.usdMxn,
      tipoCambioEur: tcQ.data?.eurMxn,
      tipoCambioFecha: tcQ.data?.fechaAplicada ?? null,
    });
  }, [cobranzaQ.data, cxpQ.data, cuentasQ.data, tcQ.data?.usdMxn, tcQ.data?.eurMxn, tcQ.data?.fechaAplicada, diaNegocio]);

  const isError = Boolean(error);
  const refetch = () => {
    void cobranzaQ.refetch();
    void cxpQ.refetch();
    void cuentasQ.refetch();
  };
  return { data, isLoading, isError, error, refetch };
}
