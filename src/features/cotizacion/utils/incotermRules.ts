/**
 * Reglas de negocio por Incoterm.
 *
 * Incoterms grupo "C" (CFR, CIF, CPT, CIP) y "D" (DAP, DPU/DAT, DDP):
 *  - El vendedor en origen ya pagó (y a veces aseguró) el flete principal
 *    hasta el puerto/lugar de destino.
 *  - Libre Carga, como forwarder local del importador, NO cotiza el flete
 *    internacional ni el seguro: sólo gastos locales destino.
 *
 * Para "EXW", "FCA", "FOB": el comprador (cliente de Libre Carga) contrata
 * el flete internacional, así que el wizard sí debe pedir tarifa marítima.
 *
 * El helper se centraliza aquí para que el wizard, el detalle de embarque y
 * el PDF deriven el comportamiento de un único punto.
 */

export const INCOTERMS_SIN_FLETE_VENTA = [
  "CIF",
  "CFR",
  "CIP",
  "CPT",
  "DAP",
  "DDP",
  "DAT",
] as const;

export type IncotermSinFleteVenta = (typeof INCOTERMS_SIN_FLETE_VENTA)[number];

/**
 * Indica si, bajo este incoterm + modo, el flete internacional viene
 * incluido por el shipper en origen y NO debe cotizarse al cliente.
 */
export function esIncotermSinFleteVenta(
  incoterm: string | null | undefined,
  modo: string | null | undefined
): boolean {
  if (!incoterm || !modo) return false;
  const esMaritimo = modo.toLowerCase().startsWith("mar");
  if (!esMaritimo) return false;
  return (INCOTERMS_SIN_FLETE_VENTA as readonly string[]).includes(incoterm);
}

/**
 * Subconjunto: incoterms donde además del flete, el seguro internacional
 * viene incluido por el vendedor (cláusula C ICC mínima). Hoy: CIF y CIP.
 */
export function esIncotermConSeguroIncluido(
  incoterm: string | null | undefined
): boolean {
  return incoterm === "CIF" || incoterm === "CIP";
}
