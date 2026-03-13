import { useMemo } from 'react';
import { convertirAMXN, calcularUtilidad, calcularMargen, type Moneda } from '@/lib/financialUtils';

interface ConceptoVenta {
  total: number;
  moneda: Moneda;
}

interface ConceptoCosto {
  monto: number;
  moneda: Moneda;
}

interface UseEmbarqueFinancialsParams {
  conceptosVenta: ConceptoVenta[];
  conceptosCosto: ConceptoCosto[];
  tipoCambioUSD: number;
  tipoCambioEUR: number;
}

export function useEmbarqueFinancials({ conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR }: UseEmbarqueFinancialsParams) {
  const totalVenta = useMemo(
    () => conceptosVenta.reduce((sum, c) => sum + convertirAMXN(Number(c.total), c.moneda, tipoCambioUSD, tipoCambioEUR), 0),
    [conceptosVenta, tipoCambioUSD, tipoCambioEUR]
  );
  const totalCosto = useMemo(
    () => conceptosCosto.reduce((sum, c) => sum + convertirAMXN(Number(c.monto), c.moneda, tipoCambioUSD, tipoCambioEUR), 0),
    [conceptosCosto, tipoCambioUSD, tipoCambioEUR]
  );
  const utilidad = useMemo(() => calcularUtilidad(totalVenta, totalCosto), [totalVenta, totalCosto]);
  const margen = useMemo(() => calcularMargen(totalVenta, totalCosto), [totalVenta, totalCosto]);

  return { totalVenta, totalCosto, utilidad, margen };
}
