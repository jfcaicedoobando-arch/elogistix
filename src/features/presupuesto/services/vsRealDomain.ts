/**
 * Tipos y helpers puros del comparativo Presupuesto vs Real.
 * Se extraen de `vsReal.ts` para respetar el límite de 200 líneas por archivo
 * (Power of 10) y poder testear la agregación sin tocar la red.
 */

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
export type CxpRow = {
  categoria_presupuesto_id: string | null;
  /** BL-07: base SIN IVA; los presupuestos se capturan como gasto neto. */
  subtotal: number | string;
  moneda: string | null;
  /** Paridad MXN por 1 USD (única columna de T/C que existe en CxP). */
  tipo_cambio_usd: number | string | null;
};
/** BL-07: NC de proveedor aplicada (monto + TC heredado de la factura padre). */
export type NcCxPRow = {
  categoria_presupuesto_id: string | null;
  monto: number | string;
  moneda: string | null;
  tipo_cambio_usd: number | string | null;
  /**
   * N9: true cuando la paridad viene de la NC misma (por lo tanto corresponde a
   * SU moneda). Si es false/omitido, la paridad se heredó de la factura padre y
   * sólo es válida para USD.
   */
  paridad_propia?: boolean;
};

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

export interface GastosAgregados {
  porCategoria: Map<string, number>;
  /** Gastos en moneda extranjera sin TC capturado (excluidos del real). */
  sinTc: number;
}

/**
 * N9 (backlog v4): la única paridad que guarda CxP es `tipo_cambio_usd`
 * (MXN por 1 USD). Aplicarla a EUR valuaba el gasto con la moneda equivocada,
 * así que sólo se acepta cuando la moneda del documento es USD — o cuando la
 * paridad fue capturada en el documento mismo (`paridadPropia`). Cualquier otra
 * divisa sin paridad válida se excluye del real y se reporta en
 * `gastos_sin_tc_count`, igual que un gasto sin T/C.
 */
function convertirAMxn(
  monto: number,
  moneda: string | null,
  tcCrudo: number | string | null,
  paridadPropia = false,
): number | null {
  const div = (moneda ?? "MXN").toUpperCase();
  if (div === "MXN") return monto;
  const tc = Number(tcCrudo ?? 0);
  if (!(tc > 0)) return null;
  if (div !== "USD" && !paridadPropia) return null;
  return monto * tc;
}

export function agregarGastosCxP(rows: CxpRow[]): GastosAgregados {
  const porCategoria = new Map<string, number>();
  let sinTc = 0;
  for (const g of rows) {
    if (!g.categoria_presupuesto_id) continue;
    const mxn = convertirAMxn(Number(g.subtotal), g.moneda, g.tipo_cambio_usd);
    if (mxn === null) {
      // Ola 5 · A7 + N9: sin paridad válida para esa divisa no se puede valuar;
      // excluir en vez de asumir 1:1 o usar el T/C del dólar.
      sinTc += 1;
      continue;
    }
    porCategoria.set(
      g.categoria_presupuesto_id,
      (porCategoria.get(g.categoria_presupuesto_id) ?? 0) + mxn,
    );
  }
  return { porCategoria, sinTc };
}

/**
 * BL-07: descuenta las NCs de proveedor aplicadas en el periodo del real por
 * categoría (misma conversión y criterio sin-TC que `agregarGastosCxP`).
 * Devuelve cuántas NCs quedaron fuera por falta de TC (cuentan en
 * `gastos_sin_tc_count` como la contraparte: no poder valuar tampoco debe
 * pasar desapercibido).
 */
export function restarNotasCreditoCxP(
  rows: NcCxPRow[],
  porCategoria: Map<string, number>,
): number {
  let sinTc = 0;
  for (const nc of rows) {
    if (!nc.categoria_presupuesto_id) continue;
    const mxn = convertirAMxn(
      Number(nc.monto), nc.moneda, nc.tipo_cambio_usd, nc.paridad_propia === true,
    );
    if (mxn === null) {
      sinTc += 1;
      continue;
    }
    porCategoria.set(
      nc.categoria_presupuesto_id,
      (porCategoria.get(nc.categoria_presupuesto_id) ?? 0) - mxn,
    );
  }
  return sinTc;
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
