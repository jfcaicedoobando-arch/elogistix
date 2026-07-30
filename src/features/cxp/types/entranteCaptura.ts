/**
 * Documento del buzón CxP que se está capturando como factura de proveedor.
 * v13.366.0
 */
export interface EntranteParaCaptura {
  id: string;
  embarqueId: string;
  expediente: string | null;
  archivoPath: string;
  nombreArchivo: string;
  xmlPath: string | null;
  xmlNombre: string | null;
  totalDetectado: number | null;
  monedaDetectada: string | null;
}
