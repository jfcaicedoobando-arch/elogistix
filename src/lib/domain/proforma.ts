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

/**
 * Suma los totales (USD y MXN) de un conjunto de proformas.
 * Usado para construir la proforma consolidada.
 */
export interface TotalesSumables {
  subtotal_usd: number | string | null;
  iva_usd: number | string | null;
  total_usd: number | string | null;
  subtotal_mxn: number | string | null;
  iva_mxn: number | string | null;
  total_mxn: number | string | null;
}

export function sumarTotalesProformas(items: TotalesSumables[]): TotalesProforma {
  const sum = (key: keyof TotalesSumables) =>
    items.reduce((acc, p) => acc + Number(p[key] ?? 0), 0);
  return {
    subtotal_usd: sum("subtotal_usd"),
    iva_usd: sum("iva_usd"),
    total_usd: sum("total_usd"),
    subtotal_mxn: sum("subtotal_mxn"),
    iva_mxn: sum("iva_mxn"),
    total_mxn: sum("total_mxn"),
  };
}

/**
 * Construye el snapshot de conceptos para una proforma consolidada,
 * adjuntando metadatos de contenedor del embarque de cada proforma origen.
 */
export interface ConceptoOrigen {
  descripcion: string;
  cantidad: number | string;
  precio_unitario: number | string;
  moneda: string;
  aplica_iva?: boolean | null;
  proforma_id: string;
}

export interface MetaEmbarqueProforma {
  embarque_id: string | null;
  contenedor: string | null;
  tipo_contenedor: string | null;
}

export interface ConceptoConsolidadoSnap {
  proforma_id: string;
  embarque_id: string | null;
  contenedor: string | null;
  tipo_contenedor: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  moneda: string;
  aplica_iva: boolean;
  iva: number;
  organization_id: string;
}

export function construirSnapshotConsolidado(opts: {
  conceptos: ConceptoOrigen[];
  metaPorProforma: Map<string, MetaEmbarqueProforma>;
  proformaConsolidadaId: string;
  organizationId: string;
  tasaIva: number;
}): ConceptoConsolidadoSnap[] {
  const { conceptos, metaPorProforma, proformaConsolidadaId, organizationId, tasaIva } = opts;
  return conceptos.map((c) => {
    const meta = metaPorProforma.get(c.proforma_id) ?? {
      embarque_id: null,
      contenedor: null,
      tipo_contenedor: null,
    };
    const totalLinea = Number(c.cantidad) * Number(c.precio_unitario);
    const aplicaIva = !!c.aplica_iva;
    return {
      proforma_id: proformaConsolidadaId,
      embarque_id: meta.embarque_id,
      contenedor: meta.contenedor,
      tipo_contenedor: meta.tipo_contenedor,
      descripcion: c.descripcion,
      cantidad: Number(c.cantidad),
      precio_unitario: Number(c.precio_unitario),
      total: totalLinea,
      moneda: c.moneda,
      aplica_iva: aplicaIva,
      iva: aplicaIva ? calcularIVA(totalLinea, tasaIva) : 0,
      organization_id: organizationId,
    };
  });
}
