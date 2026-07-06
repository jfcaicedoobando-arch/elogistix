/**
 * Valida que el desglose de un CFDI (subtotal, IVA, IEPS por concepto)
 * cuadre con los totales declarados en el comprobante antes de registrarlo
 * como gasto en CxP.
 *
 * Reglas (tolerancia = ±0.02 MXN por redondeo de centavos):
 *  1. Σ importes de conceptos ≈ subtotal
 *  2. Σ IVA por concepto ≈ iva_trasladado
 *  3. Σ IEPS por concepto ≈ ieps_trasladado
 *  4. subtotal + iva + ieps - retenciones ≈ total
 *
 * Si algo no cuadra devolvemos `ok: false` con los errores para bloquear
 * el registro y mostrarlos al usuario.
 */
import type { CfdiParsedResponse } from "./parseCfdi.types";

export const CUADRE_CFDI_TOLERANCIA = 0.02;

export interface CuadreCfdiResultado {
  ok: boolean;
  errores: string[];
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function suma(nums: number[]): number {
  return nums.reduce((s, n) => s + (Number(n) || 0), 0);
}

export function validarCuadreCfdi(cfdi: CfdiParsedResponse["cfdi"]): CuadreCfdiResultado {
  const errores: string[] = [];
  const tol = CUADRE_CFDI_TOLERANCIA;
  const conceptos = cfdi.conceptos ?? [];

  if (conceptos.length === 0) {
    errores.push("El CFDI no trae conceptos: no se puede validar el desglose.");
    return { ok: false, errores };
  }

  const sumSub = suma(conceptos.map((c) => Number(c.importe) || 0));
  const sumIva = suma(conceptos.map((c) => Number(c.iva) || 0));
  const sumIeps = suma(conceptos.map((c) => Number(c.ieps) || 0));

  if (Math.abs(sumSub - Number(cfdi.subtotal)) > tol) {
    errores.push(
      `Los importes por concepto suman ${money(sumSub)} pero el subtotal del CFDI es ${money(cfdi.subtotal)}.`,
    );
  }
  if (Math.abs(sumIva - Number(cfdi.iva_trasladado)) > tol) {
    errores.push(
      `El IVA por concepto suma ${money(sumIva)} pero el IVA trasladado del CFDI es ${money(cfdi.iva_trasladado)}.`,
    );
  }
  if (Math.abs(sumIeps - Number(cfdi.ieps_trasladado)) > tol) {
    errores.push(
      `El IEPS por concepto suma ${money(sumIeps)} pero el IEPS trasladado del CFDI es ${money(cfdi.ieps_trasladado)}.`,
    );
  }

  const totalCalc =
    Number(cfdi.subtotal) +
    Number(cfdi.iva_trasladado) +
    Number(cfdi.ieps_trasladado) -
    Number(cfdi.retenciones);
  if (Math.abs(totalCalc - Number(cfdi.total)) > tol) {
    errores.push(
      `Subtotal + IVA + IEPS − retenciones = ${money(totalCalc)}, pero el total del CFDI es ${money(cfdi.total)}.`,
    );
  }

  return { ok: errores.length === 0, errores };
}
