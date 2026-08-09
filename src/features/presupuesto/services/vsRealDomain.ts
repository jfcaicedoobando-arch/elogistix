/**
 * Tipos y helpers puros del comparativo Presupuesto vs Real.
 * Se extraen de `vsReal.ts` para respetar el límite de 200 líneas por archivo
 * (Power of 10) y poder testear la agregación sin tocar la red.
 */
import { isoUtcDay } from "@/lib/date/mx";

export interface FilaVsReal {
  categoria_id: string;
  categoria_nombre: string;
  presupuesto_mxn: number;
  real_mxn: number;
  variacion_mxn: number;
  cumplimiento_pct: number;
}

export interface ResumenVsReal {
  periodo: string;
  filas: FilaVsReal[];
  total_presupuesto_mxn: number;
  total_real_mxn: number;
  variacion_neta_mxn: number;
  /** Fase J: cantidad de categorías con cumplimiento_pct > 110%. */
  categorias_en_exceso: number;
  /** Fase J: top 5 categorías con mayor exceso absoluto (variacion_mxn desc). */
  top_exceso: FilaVsReal[];
  /**
   * Ola 5 · A7 — gastos en moneda extranjera SIN tipo de cambio capturado.
   * No se convierten 1:1 a pesos (eso inflaba/desinflaba el real): se excluyen
   * del comparativo y se reportan aquí para que la UI lo advierta.
   */
  gastos_sin_tc_count: number;
}

export type PresupRow = { categoria_id: string; periodo: string; monto_mxn: number | string };
export type CxpRow = {
  categoria_presupuesto_id: string | null;
  total: number | string;
  moneda: string | null;
  tipo_cambio_usd: number | string | null;
};
export type LiqRow = { total_mxn: number | string; periodo: string };
export type CatRow = { id: string; nombre: string };

/** Último día del periodo `YYYY-MM` en ISO (UTC). */
export function ultimoDia(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m, 0);
  return isoUtcDay(d);
}

export function mapPresupuestoPorCategoria(rows: PresupRow[], periodo: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of rows) {
    if (p.periodo === periodo) out.set(p.categoria_id, Number(p.monto_mxn));
  }
  return out;
}

export interface GastosAgregados {
  porCategoria: Map<string, number>;
  /** Gastos en moneda extranjera sin TC capturado (excluidos del real). */
  sinTc: number;
}

export function agregarGastosCxP(rows: CxpRow[]): GastosAgregados {
  const porCategoria = new Map<string, number>();
  let sinTc = 0;
  for (const g of rows) {
    if (!g.categoria_presupuesto_id) continue;
    const monto = Number(g.total);
    const esMxn = (g.moneda ?? "MXN").toUpperCase() === "MXN";
    const tc = Number(g.tipo_cambio_usd ?? 0);
    if (!esMxn && !(tc > 0)) {
      // Ola 5 · A7: sin TC no se puede valuar; excluir en vez de asumir 1:1.
      sinTc += 1;
      continue;
    }
    const mxn = esMxn ? monto : monto * tc;
    porCategoria.set(
      g.categoria_presupuesto_id,
      (porCategoria.get(g.categoria_presupuesto_id) ?? 0) + mxn,
    );
  }
  return { porCategoria, sinTc };
}

export function aplicarLiquidacionesComisiones(
  realPorCat: Map<string, number>,
  cats: CatRow[],
  liq: LiqRow[],
): void {
  const comisionesCat = cats.find((c) => c.nombre.toLowerCase() === "comisiones");
  if (!comisionesCat) return;
  const totalLiq = liq.reduce((acc, l) => acc + Number(l.total_mxn), 0);
  if (totalLiq > 0) {
    realPorCat.set(comisionesCat.id, (realPorCat.get(comisionesCat.id) ?? 0) + totalLiq);
  }
}

export function construirFila(
  c: CatRow,
  presupPorCat: Map<string, number>,
  realPorCat: Map<string, number>,
): FilaVsReal {
  const presupuesto = presupPorCat.get(c.id) ?? 0;
  const real = realPorCat.get(c.id) ?? 0;
  const variacion = real - presupuesto;
  const cumplimiento = presupuesto > 0 ? (real / presupuesto) * 100 : 0;
  return {
    categoria_id: c.id,
    categoria_nombre: c.nombre,
    presupuesto_mxn: presupuesto,
    real_mxn: real,
    variacion_mxn: variacion,
    cumplimiento_pct: cumplimiento,
  };
}

/** Fila sintética con el gasto real cuya categoría ya no existe/está inactiva. */
export function construirFilaHuerfanos(
  realPorCat: Map<string, number>,
  catIds: Set<string>,
): FilaVsReal | null {
  let realHuerfano = 0;
  for (const [catId, monto] of realPorCat) {
    if (!catIds.has(catId)) realHuerfano += monto;
  }
  if (realHuerfano <= 0) return null;
  return {
    categoria_id: "__huerfanas__",
    categoria_nombre: "Sin categoría / inactivas",
    presupuesto_mxn: 0,
    real_mxn: realHuerfano,
    variacion_mxn: realHuerfano,
    cumplimiento_pct: 0,
  };
}
