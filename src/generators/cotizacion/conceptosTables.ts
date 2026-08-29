import type { ConceptoVentaCotizacion } from '@/features/cotizacion/types';
import { calcularIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos, subtotalLinea } from '@/lib/financial/financialUtils';

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
 *
 * Todas las multiplicaciones `cantidad × precio_unitario` se redondean a 2
 * decimales con `currency.js` antes de acumularse al subtotal padre, para
 * garantizar coincidencia exacta con los registros de pago en facturación.
 */
export function calcularTotales(
  conceptos: ConceptoVentaCotizacion[],
  tasaIvaGlobal: number,
): ConceptosTotales {
  const { usd, mxn } = splitConceptos(conceptos);
  const getter = (c: ConceptoVentaCotizacion) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario });
  const subtotalUSD = sumarSubtotales(usd, getter);
  const ivaUSD = sumarMontos(
    usd.map((c) => calcularIVA(subtotalLinea(c.cantidad, c.precio_unitario), resolverTasaConcepto(c, tasaIvaGlobal))),
  );
  const subtotalMXN = sumarSubtotales(mxn, getter);
  const ivaMXN = sumarMontos(
    mxn.map((c) => calcularIVA(subtotalLinea(c.cantidad, c.precio_unitario), resolverTasaConcepto(c, tasaIvaGlobal))),
  );
  return {
    subtotalUSD,
    ivaUSD,
    totalUSD: subtotalUSD + ivaUSD,
    subtotalMXN,
    ivaMXN,
    totalMXN: subtotalMXN + ivaMXN,
  };
}
