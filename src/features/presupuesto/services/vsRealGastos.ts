/**
 * Agregación pura de gastos del real (facturas y NCs de proveedor) para el
 * comparativo Presupuesto vs Real.
 *
 * Se extraen de `vsRealDomain.ts` para respetar el límite de 200 líneas por
 * archivo (Power of 10): aquí vive la conversión a MXN y el criterio de
 * exclusión de gastos sin tipo de cambio válido.
 */

import { baseNcProveedor } from "@/lib/financial/baseNcProveedor";

export type CxpRow = {
  categoria_presupuesto_id: string | null;
  /** BL-07: base SIN IVA; los presupuestos se capturan como gasto neto. */
  subtotal: number | string;
  moneda: string | null;
  /** Paridad MXN por una unidad de la moneda de la factura (nombre histórico). */
  tipo_cambio_usd: number | string | null;
};

/** Crédito total a deuda y base neta son magnitudes distintas. */
export type NcCxPRow = {
  subtotal: number | string | null;
  categoria_presupuesto_id: string | null;
  monto: number | string;
  moneda: string | null;
  tipo_cambio_usd: number | string | null;
  /** true si el mapper verificó que la paridad corresponde a la divisa de la NC. */
  paridad_propia?: boolean;
};

export interface GastosAgregados {
  porCategoria: Map<string, number>;
  /** Gastos en moneda extranjera sin TC capturado (excluidos del real). */
  sinTc: number;
}

/** Divisas extranjeras requieren una paridad válida para su propia moneda. */
function convertirAMxn(
  monto: number,
  moneda: string | null,
  tcCrudo: number | string | null,
  paridadPropia = false,
): number | null {
  const div = (moneda ?? "MXN").toUpperCase();
  if (div === "MXN") return monto;
  const tc = Number(tcCrudo ?? 0);
  if (!(tc > 0) || !Number.isFinite(tc) || !Number.isFinite(monto * tc)) return null;
  if (div !== "USD" && !paridadPropia) return null;
  return monto * tc;
}

export function agregarGastosCxP(rows: CxpRow[]): GastosAgregados {
  const porCategoria = new Map<string, number>();
  let sinTc = 0;
  for (const g of rows) {
    if (!g.categoria_presupuesto_id) continue;
    const mxn = convertirAMxn(Number(g.subtotal), g.moneda, g.tipo_cambio_usd, true);
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
    const subtotal = baseNcProveedor(nc.subtotal);
    if (subtotal === null) continue;
    const mxn = convertirAMxn(
      subtotal, nc.moneda, nc.tipo_cambio_usd, nc.paridad_propia === true,
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
