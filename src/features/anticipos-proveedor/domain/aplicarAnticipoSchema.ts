/**
 * Esquema de validación del diálogo "Aplicar anticipo".
 * Vive fuera del componente para poder probarlo y por la regla de fast-refresh
 * (un archivo de componentes no exporta funciones).
 */
import { z } from "zod";
import { formatCurrency } from "@/lib/formatters";

/**
 * @param saldoDisponible saldo a favor del anticipo (en su moneda)
 * @param monedaAnticipo moneda en la que se captura el monto
 * @param topeFactura saldo de la factura YA convertido a la moneda del anticipo
 *        (`null` = no hay tipo de cambio; `undefined` = sin conversión: sólo se
 *        acepta cuando anticipo y factura comparten moneda).
 */
export function buildSchema(
  saldoDisponible: number,
  monedaAnticipo: string,
  topeFactura?: number | null,
) {
  return z.object({
    facturaId: z.string().uuid({ message: "Selecciona una factura" }),
    saldoFactura: z.number(),
    monedaFactura: z.string(),
    monto: z.coerce.number()
      .positive({ message: "El monto debe ser mayor a cero" })
      // MNY: el monto viaja a la RPC en la moneda del ANTICIPO; el límite y el
      // mensaje se formatean en esa misma moneda (antes decía siempre MXN).
      .max(saldoDisponible, { message: `No puede exceder el saldo disponible del anticipo (${formatCurrency(saldoDisponible, monedaAnticipo)})` }),
    fechaAplicacion: z.string().min(1, "La fecha es requerida"),
  }).superRefine((v, ctx) => {
    const mismaMoneda =
      (v.monedaFactura || "MXN").toUpperCase() === (monedaAnticipo || "MXN").toUpperCase();
    // MNY P1.3: nunca comparar monedas distintas como si valieran lo mismo.
    const limite = topeFactura === undefined ? (mismaMoneda ? v.saldoFactura : null) : topeFactura;
    if (limite === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monto"],
        message: `No hay tipo de cambio para convertir el saldo de la factura (${v.monedaFactura}) a ${monedaAnticipo}; captúralo en Catálogos → Tipos de cambio antes de aplicar.`,
      });
      return;
    }
    if (v.monto > limite + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monto"],
        message: `El monto no puede exceder el saldo de la factura (${formatCurrency(limite, monedaAnticipo)} en ${monedaAnticipo})`,
      });
    }
  });
}
