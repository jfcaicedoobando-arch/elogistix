/**
 * Esquema de validación del diálogo "Aplicar anticipo".
 * Vive fuera del componente para poder probarlo y por la regla de fast-refresh
 * (un archivo de componentes no exporta funciones).
 */
import { z } from "zod";
import { formatCurrency } from "@/lib/formatters";

export function buildSchema(saldoDisponible: number, monedaAnticipo: string) {
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
  }).refine((v) => v.monto <= v.saldoFactura + 0.01, {
    message: "El monto no puede exceder el saldo de la factura",
    path: ["monto"],
  });
}

