/** Monto del cargo con IVA sumado, en su propia moneda (USD, MXN o EUR). */
import { calcularIVA, roundMoney } from "@/lib/financial/financialUtils";

export function montoConIva(monto: number, aplicaIva: boolean, tasa: number): number {
  return aplicaIva ? roundMoney(monto + calcularIVA(monto, tasa)) : roundMoney(monto);
}
