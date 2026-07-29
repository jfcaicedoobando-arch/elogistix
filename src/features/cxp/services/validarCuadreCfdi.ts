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
import { roundMoney } from "@/lib/financial/financialUtils";

export const CUADRE_CFDI_TOLERANCIA = 0.02;

export interface CuadreCfdiResultado {
  ok: boolean;
  errores: string[];
}

const money = (n: number) => roundMoney(n).toFixed(2);

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

  const subtotal = Number(cfdi.subtotal) || 0;
  const ivaTras = Number(cfdi.iva_trasladado) || 0;
  const iepsTras = Number(cfdi.ieps_trasladado) || 0;
  const retenciones = Number(cfdi.retenciones) || 0;
  const total = Number(cfdi.total) || 0;

  const sumSub = suma(conceptos.map((c) => Number(c.importe) || 0));
  const sumIva = suma(conceptos.map((c) => Number(c.iva) || 0));
  const sumIeps = suma(conceptos.map((c) => Number(c.ieps) || 0));

  if (Math.abs(sumSub - subtotal) > tol) {
    errores.push(
      `Los importes por concepto suman ${money(sumSub)} pero el subtotal del CFDI es ${money(subtotal)}.`,
    );
  }
  if (Math.abs(sumIva - ivaTras) > tol) {
    errores.push(
      `El IVA por concepto suma ${money(sumIva)} pero el IVA trasladado del CFDI es ${money(ivaTras)}.`,
    );
  }
  if (Math.abs(sumIeps - iepsTras) > tol) {
    errores.push(
      `El IEPS por concepto suma ${money(sumIeps)} pero el IEPS trasladado del CFDI es ${money(iepsTras)}.`,
    );
  }

  // Retenciones: no negativas y con base fiscal razonable.
  if (retenciones < -tol) {
    errores.push(
      `Las retenciones del CFDI son negativas (${money(retenciones)}); deben ser ≥ 0.`,
    );
  }
  // Techo defensivo: en fletes/forwarders la retención máxima esperada
  // es 16% IVA + 4% ISR ≈ 20% del subtotal. Damos margen a 50% para no
  // bloquear CFDIs poco comunes pero atajar errores de captura evidentes.
  if (retenciones > subtotal * 0.5 + tol) {
    errores.push(
      `Las retenciones (${money(retenciones)}) superan el 50% del subtotal (${money(subtotal)}): revisa el XML.`,
    );
  }
  // Redundancia útil: si hay retenciones, el total debe ser menor a
  // subtotal + IVA + IEPS. Bloquea CFDIs donde el emisor declaró
  // retenciones pero no las descontó del total.
  if (retenciones > tol && total > subtotal + ivaTras + iepsTras + tol) {
    errores.push(
      `El CFDI declara retenciones por ${money(retenciones)} pero el total (${money(total)}) no las descuenta.`,
    );
  }

  const totalCalc = subtotal + ivaTras + iepsTras - retenciones;
  if (Math.abs(totalCalc - total) > tol) {
    errores.push(
      `Subtotal + IVA + IEPS − retenciones = ${money(totalCalc)}, pero el total del CFDI es ${money(total)}.`,
    );
  }

  return { ok: errores.length === 0, errores };
}
