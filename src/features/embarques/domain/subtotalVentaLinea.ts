/**
 * R219-UI-01 — Subtotal de una fila de venta del wizard de embarques.
 *
 * La vista previa del Paso 4 mostraba sólo el precio unitario e ignoraba la
 * cantidad, así que el total y la utilidad no coincidían con lo que la
 * persistencia guardaba (`subtotalLinea(cantidad, precioUnitario)`).
 * Este helper centraliza la MISMA regla que el payload, con la cantidad
 * saneada a 1 cuando falta o es inválida (no inventa otros defaults).
 */
import { subtotalLinea } from "@/lib/financial/financialUtils";

export function cantidadVentaValida(cantidad: number | null | undefined): number {
  const n = Number(cantidad);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function subtotalVentaLinea(
  cantidad: number | null | undefined,
  precioUnitario: number,
): number {
  const pu = Number.isFinite(precioUnitario) ? precioUnitario : 0;
  return subtotalLinea(cantidadVentaValida(cantidad), pu);
}
