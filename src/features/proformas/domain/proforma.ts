/**
 * Lógica de dominio pura para proformas. Sin dependencias de React, Supabase ni I/O.
 * Testeable de forma aislada.
 *
 * Power-of-10 (≤200 líneas): los helpers de agrupación viven en
 * `proformaAgrupacion.ts`; aquí mantenemos sólo el cálculo de totales y los tipos
 * compartidos del dominio.
 */
import { calcularIVA } from "@/lib/financial/financialUtils";

export type Moneda = "USD" | "MXN";

export interface ConceptoVentaLite {
  id: string;
  cantidad: number | string;
  precio_unitario: number | string;
  moneda: string;
  aplica_iva?: boolean | null;
  tasa_iva_aplicada?: number | null;
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
    if (!aplica) return s;
    // Cuando el override fuerza aplicar IVA, respetamos `tasa_iva_aplicada`
    // de la fila o caemos al `tasaIva` global (ignorando `aplica_iva` original).
    const tasa = c.tasa_iva_aplicada != null && Number.isFinite(c.tasa_iva_aplicada)
      ? Number(c.tasa_iva_aplicada)
      : tasaIva;
    return s + calcularIVA(sub, tasa);
  }, 0);

  const subtotal_mxn = mxn.reduce(
    (s, c) => s + Number(c.cantidad) * Number(c.precio_unitario),
    0,
  );
  // MXN siempre lleva IVA: si la fila trae `tasa_iva_aplicada`, se respeta;
  // de lo contrario se aplica la tasa global (ignorando `aplica_iva`).
  const iva_mxn = mxn.reduce((s, c) => {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    const tasa = c.tasa_iva_aplicada != null && Number.isFinite(c.tasa_iva_aplicada)
      ? Number(c.tasa_iva_aplicada)
      : tasaIva;
    return s + calcularIVA(sub, tasa);
  }, 0);

  return {
    subtotal_usd,
    iva_usd,
    total_usd: subtotal_usd + iva_usd,
    subtotal_mxn,
    iva_mxn,
    total_mxn: subtotal_mxn + iva_mxn,
  };
}

// Re-export para compatibilidad con imports existentes que esperan estos símbolos
// en `@/features/proformas/domain/proforma`.
export {
  MULTI_CONTENEDOR,
  agruparProformasPendientes,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
  type ProformaPendienteLite,
  
  
} from "./proformaAgrupacion";
