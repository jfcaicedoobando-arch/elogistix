/**
 * Agregados puros del reporte de compras: top proveedores y evolución mensual.
 *
 * Extraído de `ComprasReportes.tsx` (límite Power-of-10 de 200 líneas).
 */
import { aMxn } from "@/lib/financial/convertir";
import type { FacturaLite } from "@/features/compras/services/reportesFetch";

export interface TopProveedorAgregado {
  nombre: string;
  mxn: number;
  usd: number;
  eur: number;
  count: number;
  mxnEquiv: number;
}

export interface EvolucionMes {
  mes: string;
  mxn: number;
  usd: number;
  eur: number;
}

/**
 * El TC documental (campo histórico `tipo_cambio_usd`) tiene prioridad para
 * USD y EUR. Sólo sin un TC confiable se usa el respaldo de la misma moneda.
 */
export function agruparTopProveedores(
  rows: FacturaLite[],
  tcDof?: number,
  tcEurDof?: number,
): TopProveedorAgregado[] {
  const map = new Map<string, TopProveedorAgregado>();
  for (const r of rows) {
    const key = r.proveedor_id ?? r.proveedor_nombre ?? "—";
    const cur = map.get(key) ?? { nombre: r.proveedor_nombre ?? "—", mxn: 0, usd: 0, eur: 0, count: 0, mxnEquiv: 0 };
    cur.count += 1;

    const fallback = r.moneda === "USD" ? tcDof : r.moneda === "EUR" ? tcEurDof : null;
    const equiv = aMxn(r.total, r.moneda, r.tipo_cambio_usd, { fallback }).monto;

    if (r.moneda === "MXN") cur.mxn += r.total;
    else if (r.moneda === "USD") cur.usd += r.total;
    else cur.eur += r.total;

    cur.mxnEquiv += equiv;
    map.set(key, cur);
  }

  return Array.from(map.values())
    .sort((a, b) => b.mxnEquiv - a.mxnEquiv)
    .slice(0, 10);
}

export function agruparEvolucionMensual(rows: FacturaLite[]): EvolucionMes[] {
  const map = new Map<string, EvolucionMes>();
  for (const r of rows) {
    if (!r.fecha_emision) continue;
    const mes = r.fecha_emision.slice(0, 7);
    const cur = map.get(mes) ?? { mes, mxn: 0, usd: 0, eur: 0 };
    if (r.moneda === "MXN") cur.mxn += r.total;
    else if (r.moneda === "USD") cur.usd += r.total;
    else cur.eur += r.total;
    map.set(mes, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}
