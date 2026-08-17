/**
 * Avisos informativos (no bloqueantes) sobre incoherencias de la factura.
 * Extraído de pagoProveedorValidaciones.ts para respetar el límite de líneas.
 */
import { formatCurrency } from "@/lib/formatters";
import type { ValidarPagoInput } from "./pagoProveedorValidaciones";
import { descuadreTotalesFactura } from "./pagoProveedorValidaciones";

/** Incoherencias informativas de IVA/totales que conviene mostrar al usuario. */
export function calcularAvisosPago(a: ValidarPagoInput): string[] {
  const f = a.factura;
  if (!f) return [];
  const avisos: string[] = [];
  const descuadre = descuadreTotalesFactura(f);
  if (descuadre !== 0) {
    avisos.push(
      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${formatCurrency(descuadre, f.moneda)}. Revisa la captura antes de pagar.`,
    );
  }
  if (f.subtotal > 0 && f.iva > 0) {
    const tasa = (f.iva / f.subtotal) * 100;
    const esperadas = [0, 8, 16];
    if (!esperadas.some((t) => Math.abs(tasa - t) < 0.5)) {
      avisos.push(
        `El IVA de la factura equivale a ${tasa.toFixed(2)}% del subtotal (no es 0%, 8% ni 16%).`,
      );
    }
  }
  if (f.retenciones > f.subtotal) {
    avisos.push("Las retenciones son mayores que el subtotal de la factura.");
  }
  return avisos;
}
