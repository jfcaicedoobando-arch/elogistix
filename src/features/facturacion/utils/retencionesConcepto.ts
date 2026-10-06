import { roundMoney } from "@/lib/financial/financialUtils";

interface Impuesto { type?: string; rate?: number; withholding?: boolean }
export interface RetencionesConcepto {
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
  tasa_ret_isr?: number | null;
  tasa_ret_iva?: number | null;
  monto_ret_isr?: number | null;
  monto_ret_iva?: number | null;
  product?: { taxes?: Impuesto[] };
  taxes?: Impuesto[];
}

function baseConcepto(c: RetencionesConcepto): number {
  return c.importe ?? c.total ?? roundMoney((c.cantidad ?? 1) * (c.precio_unitario ?? c.precio ?? 0));
}

/** Conserva importes persistidos; snapshots antiguos usan sus retenciones fiscales. */
export function retencionesConcepto(c: RetencionesConcepto) {
  const taxes = c.product?.taxes ?? c.taxes ?? [];
  const tasaIsr = c.tasa_ret_isr ?? taxes.find((t) => t.withholding && t.type === "ISR")?.rate ?? 0;
  const tasaIva = c.tasa_ret_iva ?? taxes.find((t) => t.withholding && t.type === "IVA")?.rate ?? 0;
  const base = baseConcepto(c);
  return {
    tasaIsr, tasaIva,
    isr: c.monto_ret_isr ?? roundMoney(base * tasaIsr),
    iva: c.monto_ret_iva ?? roundMoney(base * tasaIva),
  };
}
