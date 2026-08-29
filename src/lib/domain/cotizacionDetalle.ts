/**
 * Pure helpers for parsing/computing totals from a cotización's `conceptos_venta` JSON column.
 * Extracted from useCotizacionDetalleState to keep the hook focused on orchestration.
 */
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { calcularIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos, subtotalLinea } from "@/lib/financial/financialUtils";
import { logger } from "@/lib/observability/logger";
import { parseNumeroFiscal } from "@/lib/domain/facturaConceptos";

export interface ConceptosTotales {
  conceptosVentaUSD: ConceptoVentaCotizacion[];
  conceptosVentaMXN: ConceptoVentaCotizacion[];
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

/**
 * Fallback canónico congelado. Misma referencia en cada acceso → memos descendentes
 * permanecen estables cuando el payload está vacío o corrupto.
 */
const EMPTY_CONCEPTOS: ConceptoVentaCotizacion[] = Object.freeze<ConceptoVentaCotizacion[]>([]) as ConceptoVentaCotizacion[];

export const EMPTY_TOTALES: ConceptosTotales = Object.freeze({
  conceptosVentaUSD: EMPTY_CONCEPTOS,
  conceptosVentaMXN: EMPTY_CONCEPTOS,
  totalUSD: 0,
  subtotalMXN: 0,
  ivaMXN: 0,
  totalMXN: 0,
}) as ConceptosTotales;

/**
 * M11 — Normaliza una fila cruda a concepto tipado.
 * Antes se descartaba en silencio cualquier fila con `cantidad`/`precio_unitario`
 * en texto (`"1,200.00"`), lo que borraba dinero del total sin aviso. Ahora se
 * coerce con el parser fiscal canónico y sólo se descarta lo irrecuperable.
 */
function normalizarConcepto(x: unknown): ConceptoVentaCotizacion | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Record<string, unknown>;
  if (c.moneda !== "USD" && c.moneda !== "MXN") return null;
  const cantidad = parseNumeroFiscal(c.cantidad);
  const precio = parseNumeroFiscal(c.precio_unitario);
  if (cantidad == null || precio == null) return null;
  // SAFE-CAST: fila cruda ya validada (moneda + cantidad/precio numéricos) por este parser.
  return { ...c, cantidad, precio_unitario: precio } as unknown as ConceptoVentaCotizacion;
}

/** Resultado detallado del parseo: conceptos válidos + filas irrecuperables. */
export interface ParseConceptosResult {
  conceptos: ConceptoVentaCotizacion[];
  descartados: number;
}

/**
 * Parsea el JSON crudo de `cotizacion.conceptos_venta` a un array tipado.
 * Defensivo: tolera strings malformados, payloads no-array y filas inválidas.
 */
export function parseConceptosDetallado(raw: unknown): ParseConceptosResult {
  if (raw == null) return { conceptos: [], descartados: 0 };
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch (err) {
      logger.warn("cotizacionDetalle", "conceptos_venta: JSON inválido", err);
      return { conceptos: [], descartados: 0 };
    }
  }
  if (!Array.isArray(arr)) {
    if (typeof raw !== "string") {
      logger.warn("cotizacionDetalle", "conceptos_venta con formato inválido", { raw });
    }
    return { conceptos: [], descartados: 0 };
  }
  const conceptos: ConceptoVentaCotizacion[] = [];
  let descartados = 0;
  for (const item of arr) {
    const normalizado = normalizarConcepto(item);
    if (normalizado) conceptos.push(normalizado);
    else descartados++;
  }
  if (descartados > 0) {
    logger.warn("cotizacionDetalle", `${descartados} concepto(s) descartado(s) por schema inválido`);
  }
  return { conceptos, descartados };
}

/** Compatibilidad: devuelve sólo los conceptos válidos. */
export function parseConceptos(raw: unknown): ConceptoVentaCotizacion[] {
  return parseConceptosDetallado(raw).conceptos;
}


/** Calcula los totales por moneda a partir de los conceptos parseados. */
export function calcularTotalesConceptos(
  conceptos: ConceptoVentaCotizacion[],
  tasaIva: number,
): ConceptosTotales {
  if (!Array.isArray(conceptos) || conceptos.length === 0) return EMPTY_TOTALES;
  const conceptosVentaUSD = conceptos.filter(c => c.moneda === "USD");
  const conceptosVentaMXN = conceptos.filter(c => c.moneda === "MXN");
  const totalUSD = sumarMontos(conceptosVentaUSD.map((c) => c.total));
  const subtotalMXN = sumarSubtotales(conceptosVentaMXN, (c) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario }));
  const ivaMXN = sumarMontos(
    conceptosVentaMXN.map((c) => calcularIVA(subtotalLinea(c.cantidad, c.precio_unitario), resolverTasaConcepto(c, tasaIva))),
  );
  const totalMXN = subtotalMXN + ivaMXN;
  return { conceptosVentaUSD, conceptosVentaMXN, totalUSD, subtotalMXN, ivaMXN, totalMXN };
}

/**
 * Desglose subtotal/IVA/total de los conceptos de UNA moneda
 * (B-081/B-093, detalle del portal cliente). La tasa de IVA sale de cada fila
 * (`tasa_iva_aplicada` > `aplica_iva` + tasa global, vía `resolverTasaConcepto`);
 * con `ivaSiempre` se reproduce la regla histórica del portal para MXN
 * ("MXN siempre aplica IVA", ignora el flag `aplica_iva`).
 */
export function calcularDesgloseMoneda(
  conceptos: ConceptoVentaCotizacion[],
  tasaIva: number,
  ivaSiempre = false,
): { subtotal: number; iva: number; total: number } {
  const subtotal = sumarSubtotales(conceptos, (c) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario }));
  const iva = sumarMontos(
    conceptos.map((c) => {
      const tieneTasaFila = c.tasa_iva_aplicada != null && Number.isFinite(Number(c.tasa_iva_aplicada));
      const tasaFila = ivaSiempre && !tieneTasaFila ? tasaIva : resolverTasaConcepto(c, tasaIva);
      return calcularIVA(subtotalLinea(c.cantidad, c.precio_unitario), tasaFila);
    }),
  );
  return { subtotal, iva, total: subtotal + iva };
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
