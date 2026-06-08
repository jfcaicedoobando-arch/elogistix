import type { ConceptoVentaCotizacion } from '@/types/cotizacion';
import { calcularIVA, resolverTasaConcepto } from '@/lib/financial/financialUtils';

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

/**
 * Calcula totales agregados respetando la tasa por fila (`tasa_iva_aplicada`).
 * El `tasaIvaGlobal` se usa sólo como fallback para filas legacy sin tasa.
 */
export function calcularTotales(
  conceptos: ConceptoVentaCotizacion[],
  tasaIvaGlobal: number,
): ConceptosTotales {
  const { usd, mxn } = splitConceptos(conceptos);
  const subtotalUSD = usd.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaUSD = usd.reduce((s, c) => {
    const sub = c.cantidad * c.precio_unitario;
    return s + calcularIVA(sub, resolverTasaConcepto(c, tasaIvaGlobal));
  }, 0);
  const subtotalMXN = mxn.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaMXN = mxn.reduce((s, c) => {
    const sub = c.cantidad * c.precio_unitario;
    return s + calcularIVA(sub, resolverTasaConcepto(c, tasaIvaGlobal));
  }, 0);
  return {
    subtotalUSD,
    ivaUSD,
    totalUSD: subtotalUSD + ivaUSD,
    subtotalMXN,
    ivaMXN,
    totalMXN: subtotalMXN + ivaMXN,
  };
}
