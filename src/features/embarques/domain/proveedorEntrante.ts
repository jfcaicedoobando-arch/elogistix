/**
 * Reglas del proveedor elegido al subir una factura al buzón CxP.
 * Puro: sin acceso a red ni a React.
 */

export interface AvisoProveedorArgs {
  /** Proveedor sugerido por el RFC del CFDI (si lo hubo). */
  detectadoId: string | null;
  detectadoNombre: string | null;
  /** Proveedor elegido por el operador. */
  seleccionadoId: string | null;
  /** RFC emisor leído del XML. */
  rfcEmisor: string | null;
  /** Si el documento trae XML CFDI. */
  tieneXml: boolean;
}

/**
 * Devuelve el aviso a mostrar (o `null` si todo está en orden).
 * Nunca bloquea la subida: sólo informa al operador.
 */
export function avisoProveedorEntrante(args: AvisoProveedorArgs): string | null {
  const { detectadoId, detectadoNombre, seleccionadoId, rfcEmisor, tieneXml } = args;

  if (!seleccionadoId) {
    return "Sin proveedor asignado: contabilidad tendrá que identificarlo al capturar la factura.";
  }
  if (detectadoId && detectadoId !== seleccionadoId) {
    const nombre = detectadoNombre ?? "otro proveedor";
    return `El RFC del CFDI (${rfcEmisor ?? "sin RFC"}) corresponde a ${nombre}. Verifica que el proveedor elegido sea el correcto.`;
  }
  if (tieneXml && !detectadoId && rfcEmisor) {
    return `Ningún proveedor dado de alta tiene el RFC ${rfcEmisor}. Confirma que el proveedor elegido sea el emisor de la factura.`;
  }
  return null;
}
