/**
 * Tipos y helpers puros del comparativo Presupuesto vs Real.
 * Se extraen de `vsReal.ts` para respetar el límite de 200 líneas por archivo
 * (Power of 10) y poder testear la agregación sin tocar la red.
 *
 * La conversión a MXN de gastos y NCs de proveedor vive en `vsRealGastos.ts`.
 */

export type { CxpRow, NcCxPRow, GastosAgregados } from "./vsRealGastos";
export { agregarGastosCxP, restarNotasCreditoCxP } from "./vsRealGastos";

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
  /**
   * BL-07: true cuando alguna fuente del real tocó su límite de filas
   * (facturas/NCs/liquidaciones) y el comparativo puede estar subestimado.
   * La UI debe advertirlo (antes el truncamiento era silencioso).
   */
  real_truncado: boolean;
}

export type PresupRow = { categoria_id: string; periodo: string; monto_mxn: number | string };
export type LiqRow = { total_mxn: number | string; periodo: string };
export type CatRow = { id: string; nombre: string };

/**
 * Último día del periodo `YYYY-MM` en formato `YYYY-MM-DD`.
 *
 * N27 (Ola E2 · B): cálculo puro por componentes de calendario. Antes se creaba
 * un `Date` local y se leía en UTC, así que en zonas UTC+ el "último día" se
 * corría al día anterior (como leer el calendario de otro país).
 */
export function ultimoDia(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const dias = [31, esBisiesto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const ultimo = dias[m - 1] ?? 31;
  return `${y}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}


export function mapPresupuestoPorCategoria(rows: PresupRow[], periodo: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of rows) {
    if (p.periodo === periodo) out.set(p.categoria_id, Number(p.monto_mxn));
  }
  return out;
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
