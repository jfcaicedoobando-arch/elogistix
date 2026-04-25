/**
 * Lógica de dominio pura para proformas. Sin dependencias de React, Supabase ni I/O.
 * Testeable de forma aislada.
 */
import { calcularIVA } from "@/lib/financialUtils";

export type Moneda = "USD" | "MXN";

export interface ConceptoVentaLite {
  id: string;
  cantidad: number | string;
  precio_unitario: number | string;
  moneda: string;
  aplica_iva?: boolean | null;
}

export interface TotalesProforma {
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
}

/**
 * Calcula los totales (subtotal, IVA, total) por moneda para un conjunto de conceptos.
 * - MXN siempre lleva IVA.
 * - USD usa el override del usuario o el flag del concepto.
 */
export function calcularTotalesProforma(
  conceptos: ConceptoVentaLite[],
  tasaIva: number,
  ivaOverridesUSD: Record<string, boolean> = {},
): TotalesProforma {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");

  const subtotal_usd = usd.reduce(
    (s, c) => s + Number(c.cantidad) * Number(c.precio_unitario),
    0,
  );
  const iva_usd = usd.reduce((s, c) => {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    const aplica = c.id in ivaOverridesUSD ? ivaOverridesUSD[c.id] : !!c.aplica_iva;
    return aplica ? s + calcularIVA(sub, tasaIva) : s;
  }, 0);

  const subtotal_mxn = mxn.reduce(
    (s, c) => s + Number(c.cantidad) * Number(c.precio_unitario),
    0,
  );
  const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);

  return {
    subtotal_usd,
    iva_usd,
    total_usd: subtotal_usd + iva_usd,
    subtotal_mxn,
    iva_mxn,
    total_mxn: subtotal_mxn + iva_mxn,
  };
}
