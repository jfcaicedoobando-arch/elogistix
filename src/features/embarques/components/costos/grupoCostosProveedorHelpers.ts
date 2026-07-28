/**
 * Helpers puros para `GrupoCostosProveedor` (extraídos para respetar el
 * límite de 200 líneas por archivo — Power of 10).
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
  /** B-057: cuántas filas aún no tienen factura del proveedor. */
  sinFactura: number;
};

export function calcularSubtotales(filas: FilaReconciliacion[]): SubtotalPorMoneda[] {
  const map = new Map<string, SubtotalPorMoneda>();
  for (const f of filas) {
    const cur = map.get(f.moneda) ?? {
      moneda: f.moneda, cotizado: 0, facturado: 0, cotizadoFacturable: 0, sinFactura: 0,
    };
    cur.cotizado += f.cotizado;
    cur.facturado += f.real_facturado;
    if (f.facturas.length > 0) cur.cotizadoFacturable += f.cotizado;
    else cur.sinFactura += 1;
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
    case "sin_match":
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function estatusLabel(estatus: FilaReconciliacion["estatus_renglon"]): string {
  switch (estatus) {
    case "conciliado": return "Conciliado";
    case "parcial": return "Parcial";
    case "excedente": return "Excedente";
    case "sin_match":
    default: return "Sin factura";
  }
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

export function fmtFecha(iso: string | null): string {
  if (!iso) return "s/f";
  try { return format(new Date(iso), "dd/MM/yyyy", { locale: es }); }
  catch { return iso; }
}
