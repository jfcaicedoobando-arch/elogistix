/**
 * Helpers puros para convertir los totales nativos de Cartera (por moneda) a
 * un equivalente único en MXN, sin mezclar buckets internamente.
 *
 * Contrato:
 *  - `MXN` suma directa.
 *  - `USD` suma × tcUsdMxn si tcUsdMxn > 1 (1 USD nunca es 1 MXN); si no,
 *    cuenta como `facturasSinTc`.
 *  - Otras monedas siempre `facturasSinTc` (no se convierten aquí).
 *
 * `facturasSinTc` es una **estimación por moneda** (cuenta 1 por cada bucket
 * no convertible con saldo > 0), no por factura individual: la UI lo usa como
 * indicador cualitativo ("hay saldo sin convertir"), no como conteo exacto.
 */

import { aMxn } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

export interface SaldosNativos {
  MXN: number;
  USD: number;
  otras: Record<string, number>;
}

export interface EquivalenteMxnResult {
  totalMxn: number;
  facturasSinTc: number;
}

const money = (n: number): number => roundMoney(n);

export function equivalenteMxn(
  nativos: SaldosNativos,
  tcUsdMxn: number,
): EquivalenteMxnResult {
  let totalMxn = money(nativos.MXN || 0);
  let facturasSinTc = 0;

  if ((nativos.USD || 0) > 0) {
    // FIX C6: el canon único decide si el TC es confiable (1 USD nunca es 1 MXN).
    const conv = aMxn(nativos.USD, "USD", tcUsdMxn);
    if (conv.completo) totalMxn = money(totalMxn + conv.monto);
    else facturasSinTc += 1;
  }

  for (const [, monto] of Object.entries(nativos.otras || {})) {
    if ((monto || 0) > 0) facturasSinTc += 1;
  }

  return { totalMxn, facturasSinTc };
}

/**
 * FIX 12.4 — El equivalente en MXN sólo aporta información cuando hay saldo en
 * otra moneda. Si todo está en MXN, mostrar "≈ $X MXN equivalente" repite el
 * mismo número y sólo agrega ruido.
 */
export function requiereEquivalente(nativos: SaldosNativos): boolean {
  if ((nativos.USD || 0) > 0) return true;
  return Object.values(nativos.otras || {}).some((monto) => (monto || 0) > 0);
}
