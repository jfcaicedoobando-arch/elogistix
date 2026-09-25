/**
 * Helpers puros para `GrupoCostosProveedor` (extraídos para respetar el
 * límite de 200 líneas por archivo — Power of 10).
 */
import { formatFechaDia } from "@/lib/formatters";
import type {
  FilaReconciliacion,
  FacturaVinculada,
} from "@/features/embarques/services/reconciliacionCostos";

export type SubtotalPorMoneda = {
  moneda: string;
  cotizado: number;
  facturado: number;
  /** B-057: cotizado sólo de filas con factura ligada — base para % de ajuste. */
  cotizadoFacturable: number;
  /** P1-1: facturado sólo de filas comparables (con factura y sin vínculos sin TC). */
  facturadoFacturable: number;
  /** B-057: cuántas filas aún no tienen factura del proveedor. */
  sinFactura: number;
  /** P1-1: filas con facturas pendientes de tipo de cambio (fuera del ajuste). */
  noComparables: number;
};

/** Fila con factura ligada cuyo ajuste es definitivo (sin vínculos sin TC). */
export function esFilaComparable(f: FilaReconciliacion): boolean {
  return f.facturas.length > 0 && (f.vinculos_excluidos ?? 0) === 0;
}

export function calcularSubtotales(filas: FilaReconciliacion[]): SubtotalPorMoneda[] {
  const map = new Map<string, SubtotalPorMoneda>();
  for (const f of filas) {
    const cur = map.get(f.moneda) ?? {
      moneda: f.moneda, cotizado: 0, facturado: 0, cotizadoFacturable: 0,
      facturadoFacturable: 0, sinFactura: 0, noComparables: 0,
    };
    cur.cotizado += f.cotizado;
    cur.facturado += f.real_facturado;
    if (f.facturas.length === 0) cur.sinFactura += 1;
    else if (!esFilaComparable(f)) cur.noComparables += 1;
    else {
      cur.cotizadoFacturable += f.cotizado;
      cur.facturadoFacturable += f.real_facturado;
    }
    map.set(f.moneda, cur);
  }
  return Array.from(map.values());
}

/**
 * Orden dentro del grupo: primero renglones con mayor |desviación| (para
 * que los ajustes relevantes queden arriba), después "sin factura", y al
 * final los conciliados exactos.
 */
export function ordenarFilasPorAjuste(filas: FilaReconciliacion[]): FilaReconciliacion[] {
  const bucket = (f: FilaReconciliacion): number => {
    if (f.facturas.length === 0) return 1;             // sin factura
    if (!esFilaComparable(f)) return 1;                // pendiente de TC
    if (Math.abs(f.diferencia) < 0.01) return 2;       // sin ajuste
    return 0;                                          // con ajuste
  };
  return [...filas].sort((a, b) => {
    const ba = bucket(a); const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    return Math.abs(b.diferencia) - Math.abs(a.diferencia);
  });
}

export function estatusBadgeClass(estatus: FilaReconciliacion["estatus_renglon"]): string {
  switch (estatus) {
    case "conciliado": return "bg-success/15 text-success border-success/30";
    case "parcial": return "bg-warning/15 text-warning border-warning/30";
    case "excedente": return "bg-destructive/15 text-destructive border-destructive/30";
    case "no_comparable": return "bg-warning/10 text-warning border-warning/30";
    case "sin_match":
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function estatusLabel(estatus: FilaReconciliacion["estatus_renglon"]): string {
  switch (estatus) {
    case "conciliado": return "Conciliado";
    case "parcial": return "Parcial";
    case "excedente": return "Excedente";
    case "no_comparable": return "Pendiente de tipo de cambio";
    case "sin_match":
    default: return "Sin factura";
  }
}

/**
 * v13.823.370 (P2-4) — Resumen de conteos del grupo. Antes se imprimía siempre
 * "N con ajuste", así que un grupo sin ajustes mostraba el imposible
 * "MXN 0 con ajuste, 1 sin factura". Ahora se omite toda categoría en cero.
 */
export function etiquetaConteos(conAjuste: number, sinFactura: number): string | null {
  const partes: string[] = [];
  if (conAjuste > 0) partes.push(`${conAjuste} con ajuste`);
  if (sinFactura > 0) partes.push(`${sinFactura} concepto${sinFactura === 1 ? "" : "s"} sin factura`);
  return partes.length > 0 ? partes.join(", ") : null;
}

export function pagoBadgeClass(estado: string | null): string {
  const v = (estado ?? "").toLowerCase();
  if (v === "pagada") return "bg-success/15 text-success border-success/30";
  if (v === "vencida") return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "vigente") return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

/** Devuelve el "peor" estado de pago cuando hay varias facturas ligadas. */
export function peorEstadoPago(facturas: FacturaVinculada[]): string | null {
  if (facturas.length === 0) return null;
  const orden = ["vencida", "vigente", "pagada"];
  let peor: string | null = null;
  for (const f of facturas) {
    const v = (f.estatus_pago ?? "").toLowerCase();
    if (!peor) { peor = v; continue; }
    if (orden.indexOf(v) < orden.indexOf(peor)) peor = v;
  }
  return peor ? peor.charAt(0).toUpperCase() + peor.slice(1) : null;
}

/** Ola C · UI-04: delega en el formateador canónico; conserva el fallback "s/f". */
export function fmtFecha(iso: string | null): string {
  return iso ? formatFechaDia(iso, iso) : "s/f";
}
