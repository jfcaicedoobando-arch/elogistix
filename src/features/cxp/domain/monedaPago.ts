/**
 * Reglas puras de moneda para pagos a proveedor (dominio neutral: sin hooks,
 * sin servicios). Lo consumen tanto el formulario como las validaciones.
 */

/**
 * MNY-NEW-09 — ¿el par de monedas es un cruce entre dos divisas extranjeras
 * (USD↔EUR)? No hay conversión canónica para ese cruce (el T/C capturado son
 * pesos por divisa), así que el formulario lo bloquea con mensaje explícito en
 * vez de asumir paridad 1:1.
 */
export function cruceMonedasNoSoportado(
  monedaFactura: string | null | undefined,
  monedaPago: string | null | undefined,
): boolean {
  if (!monedaFactura || !monedaPago) return false;
  return monedaFactura !== "MXN" && monedaPago !== "MXN" && monedaFactura !== monedaPago;
}
