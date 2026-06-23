/**
 * 13.116.0 (Sprint A) — Helpers puros de CxP extraídos para testear bordes.
 *
 * El umbral `<= 0.01` resuelve el clásico problema de "Pagada con $0.001 de
 * diferencia". Antes vivía hardcoded dentro de `pagosProveedor.ts` sin tests
 * en los bordes — un cambio a `< 0.01` (estricto) dejaría facturas con
 * saldo de exactamente 1 centavo marcadas como Vigentes para siempre.
 */

export const SALDO_TOLERANCIA_MXN = 0.01;

export type EstadoFacturaProveedor = "Pagada" | "Vigente" | "Cancelada" | "Borrador";

/**
 * Decide el nuevo estado de una factura proveedor según su saldo restante.
 * - Facturas Canceladas/Borrador NUNCA se mueven (regla de negocio: no reabrir).
 * - Saldo ≤ tolerancia → Pagada (cubre redondeos de centavos).
 * - Saldo > tolerancia → Vigente.
 */
export function decidirEstadoFactura(
  estadoActual: EstadoFacturaProveedor,
  saldo: number,
): EstadoFacturaProveedor {
  if (estadoActual === "Cancelada" || estadoActual === "Borrador") return estadoActual;
  if (!Number.isFinite(saldo)) return estadoActual; // datos corruptos: no tocar
  return saldo <= SALDO_TOLERANCIA_MXN ? "Pagada" : "Vigente";
}
