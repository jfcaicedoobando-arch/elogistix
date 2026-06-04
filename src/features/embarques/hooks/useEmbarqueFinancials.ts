import { useMemo } from 'react';
import { computeEmbarqueKpis, type ConceptoVentaKpi, type ConceptoCostoKpi } from '@/lib/financial/embarqueKpis';

interface UseEmbarqueFinancialsParams {
  conceptosVenta: ConceptoVentaKpi[];
  conceptosCosto: ConceptoCostoKpi[];
  tipoCambioUSD: number;
  tipoCambioEUR: number;
}

export function useEmbarqueFinancials({ conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR }: UseEmbarqueFinancialsParams) {
  return useMemo(
    () => computeEmbarqueKpis(conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR),
    [conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR],
  );
}
