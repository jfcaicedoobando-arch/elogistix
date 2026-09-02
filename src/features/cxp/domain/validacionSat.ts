/**
 * Predicado canónico: ¿esta factura de proveedor requiere validación en el SAT?
 *
 * Regla de negocio: sólo un CFDI mexicano se puede consultar en el SAT. Una
 * factura de proveedor **extranjero** (dato canónico `proveedor_origen`) o una
 * **captura manual sin CFDI** (sin UUID fiscal y sin XML adjunto) no depende
 * del SAT y por lo tanto no debe bloquear su aprobación.
 *
 * No se infiere el origen sólo por la ausencia del UUID: el origen del
 * proveedor es el dato canónico y el UUID/XML sólo distingue CFDI vs manual.
 */

export interface FacturaValidacionSat {
  proveedor_origen: "Nacional" | "Extranjero" | null;
  uuid_fiscal: string | null;
  archivo_xml_url?: string | null;
}

/** Motivo por el que la validación en el SAT no aplica (o `null` si sí aplica). */
export function motivoSatNoAplica(f: FacturaValidacionSat): string | null {
  if (f.proveedor_origen === "Extranjero") {
    return "Proveedor extranjero: no emite CFDI, no hay nada que validar en el SAT.";
  }
  const esCfdi = Boolean(f.uuid_fiscal) || Boolean(f.archivo_xml_url);
  if (!esCfdi) {
    return "Captura manual sin CFDI (sin UUID ni XML): no hay nada que validar en el SAT.";
  }
  return null;
}

/** ¿Aplica consultar el estatus del CFDI en el SAT para esta factura? */
export function requiereValidacionSat(f: FacturaValidacionSat): boolean {
  return motivoSatNoAplica(f) === null;
}

/**
 * ¿Se puede mandar a la consulta del SAT? Requiere que aplique **y** que exista
 * el UUID fiscal (el servicio consulta por UUID).
 */
export function esValidableEnSat(f: FacturaValidacionSat): boolean {
  return requiereValidacionSat(f) && Boolean(f.uuid_fiscal);
}
