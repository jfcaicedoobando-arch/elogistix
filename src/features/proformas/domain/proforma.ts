/**
 * Lógica de dominio pura para proformas. Sin dependencias de React, Supabase ni I/O.
 * Testeable de forma aislada.
 *
 * Power-of-10 (≤200 líneas): los helpers de agrupación viven en
 * `proformaAgrupacion.ts`; aquí mantenemos sólo el cálculo de totales y los tipos
 * compartidos del dominio.
 */
import {
  calcularIVA,
  resolverTasaConcepto,
  roundMoney,
  subtotalLinea,
  sumarMontos,
  sumarSubtotales,
} from "@/lib/financial/financialUtils";

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
 * Tasa de IVA de una fila de proforma.
 * - B-09: ya NO existe la regla "MXN siempre lleva IVA". MXN y USD se resuelven
 *   igual vía `resolverTasaConcepto` (tasa explícita de la fila → flag legacy
 *   `aplica_iva`; `aplica_iva=false` ⇒ tasa 0). Antes un concepto exento en
 *   pesos (flete internacional) se gravaba con la tasa global.
 * - Los overrides de usuario (sólo existen para USD) mandan sobre la fila.
 */
function tasaLineaProforma(
  c: ConceptoVentaLite,
  tasaIva: number,
  ivaOverridesUSD: Record<string, boolean>,
): number {
  if (c.moneda === "USD" && c.id in ivaOverridesUSD) {
    if (!ivaOverridesUSD[c.id]) return 0;
    return c.tasa_iva_aplicada != null && Number.isFinite(Number(c.tasa_iva_aplicada))
      ? Number(c.tasa_iva_aplicada)
      : tasaIva;
  }
  return resolverTasaConcepto(c, tasaIva);
}

/** Totales declarados (persistidos) de una proforma, para el chequeo B-08. */
export interface TotalesDeclaradosProforma {
  total_usd?: number | null;
  total_mxn?: number | null;
}

/** Medio centavo: por debajo de eso el "drift" es ruido de redondeo. */
const TOLERANCIA_DRIFT = 0.005;

/**
 * B-08: avisa (console.warn) si los totales persistidos difieren del cálculo del
 * dominio por más de medio centavo. No lanza: es un detector, no una validación.
 */
function advertirDriftTotales(
  totales: TotalesProforma,
  declarados: TotalesDeclaradosProforma,
): void {
  const diffs: string[] = [];
  const revisar = (label: string, declarado: number | null | undefined, calculado: number) => {
    if (declarado == null) return;
    if (Math.abs(roundMoney(declarado) - calculado) > TOLERANCIA_DRIFT) {
      diffs.push(`${label} declarado=${declarado} calculado=${calculado}`);
    }
  };
  revisar("total_usd", declarados.total_usd, totales.total_usd);
  revisar("total_mxn", declarados.total_mxn, totales.total_mxn);
  if (diffs.length > 0) {
    console.warn(`[proforma] El total calculado difiere del total declarado: ${diffs.join("; ")}`);
  }
}

/**
 * Calcula los totales (subtotal, IVA, total) por moneda para un conjunto de
 * conceptos. Política BL-12: redondeo POR LÍNEA con las primitivas de
 * `@/lib/financial/financialUtils` y total = `subtotal + iva` ya redondeados.
 */
export function calcularTotalesProforma(
  conceptos: ConceptoVentaLite[],
  tasaIva: number,
  ivaOverridesUSD: Record<string, boolean> = {},
  totalesDeclarados?: TotalesDeclaradosProforma,
): TotalesProforma {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");

  const subtotalDe = (c: ConceptoVentaLite) => ({
    cantidad: Number(c.cantidad),
    precioUnitario: Number(c.precio_unitario),
  });
  const ivaDe = (lista: ConceptoVentaLite[]) =>
    sumarMontos(
      lista.map((c) =>
        calcularIVA(
          subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)),
          tasaLineaProforma(c, tasaIva, ivaOverridesUSD),
        ),
      ),
    );

  const subtotal_usd = sumarSubtotales(usd, subtotalDe);
  const subtotal_mxn = sumarSubtotales(mxn, subtotalDe);
  const iva_usd = ivaDe(usd);
  const iva_mxn = ivaDe(mxn);

  const totales: TotalesProforma = {
    subtotal_usd,
    iva_usd,
    total_usd: sumarMontos([subtotal_usd, iva_usd]),
    subtotal_mxn,
    iva_mxn,
    total_mxn: sumarMontos([subtotal_mxn, iva_mxn]),
  };

  if (totalesDeclarados) advertirDriftTotales(totales, totalesDeclarados);

  return totales;
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
