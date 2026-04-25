/**
 * Pure helpers for parsing/computing totals from a cotización's `conceptos_venta` JSON column.
 * Extracted from useCotizacionDetalleState to keep the hook focused on orchestration.
 */
import type { ConceptoVentaCotizacion } from "@/types/cotizacionTypes";
import { calcularIVA } from "@/lib/financialUtils";

export interface ConceptosTotales {
  conceptosVentaUSD: ConceptoVentaCotizacion[];
  conceptosVentaMXN: ConceptoVentaCotizacion[];
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

/** Parsea el JSON crudo de `cotizacion.conceptos_venta` a un array tipado. */
export function parseConceptos(raw: unknown): ConceptoVentaCotizacion[] {
  if (raw == null) return [];
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? (arr as ConceptoVentaCotizacion[]) : [];
}

/** Calcula los totales por moneda a partir de los conceptos parseados. */
export function calcularTotalesConceptos(
  conceptos: ConceptoVentaCotizacion[],
  tasaIva: number,
): ConceptosTotales {
  const conceptosVentaUSD = conceptos.filter(c => c.moneda === "USD");
  const conceptosVentaMXN = conceptos.filter(c => c.moneda === "MXN");
  const totalUSD = conceptosVentaUSD.reduce((s, c) => s + c.total, 0);
  const subtotalMXN = conceptosVentaMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaMXN = calcularIVA(subtotalMXN, tasaIva);
  const totalMXN = subtotalMXN + ivaMXN;
  return { conceptosVentaUSD, conceptosVentaMXN, totalUSD, subtotalMXN, ivaMXN, totalMXN };
}

/** Construye la etiqueta del destinatario (cliente o prospecto). */
export function getNombreDestinatario(cotizacion: {
  es_prospecto: boolean;
  prospecto_empresa: string;
  cliente_nombre: string;
} | undefined): string {
  if (!cotizacion) return "";
  return cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;
}
