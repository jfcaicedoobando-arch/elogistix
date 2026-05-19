import type { ConceptoVentaCotizacion } from '@/types/cotizacion';
import { calcularIVA } from '@/lib/financial/financialUtils';

export interface ConceptosTotales {
  subtotalUSD: number;
  ivaUSD: number;
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

export function splitConceptos(conceptos: ConceptoVentaCotizacion[]) {
  const usd = conceptos.filter((c) => c.moneda === 'USD');
  const mxn = conceptos.filter((c) => c.moneda === 'MXN');
  return { usd, mxn };
}

export function calcularTotales(conceptos: ConceptoVentaCotizacion[]): ConceptosTotales {
  const { usd, mxn } = splitConceptos(conceptos);
  const subtotalUSD = usd.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaUSD = usd.reduce((s, c) => (c.aplica_iva ? s + calcularIVA(c.cantidad * c.precio_unitario) : s), 0);
  const subtotalMXN = mxn.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaMXN = calcularIVA(subtotalMXN);
  return {
    subtotalUSD,
    ivaUSD,
    totalUSD: subtotalUSD + ivaUSD,
    subtotalMXN,
    ivaMXN,
    totalMXN: subtotalMXN + ivaMXN,
  };
}
