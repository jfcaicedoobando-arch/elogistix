export interface ConceptoVentaLocal {
  id: number;
  /**
   * UUID persistido en `conceptos_venta.id` cuando el concepto proviene de
   * BD (edición). Se envía de regreso al RPC para hacer merge por id en vez
   * de delete+insert (v13.207.0). En conceptos nuevos capturados por el
   * usuario queda `null`/`undefined`.
   */
  dbId?: string | null;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  /** Contenedor del embarque al que aplica el concepto (null = General). */
  contenedorId?: string | null;
  /**
   * `conceptos_venta.estado_facturacion` tal como viene de BD. La RPC de
   * guardado ignora los renglones ya facturados, así que la UI lo usa para
   * bloquear la fila en vez de fingir un guardado exitoso.
   */
  estadoFacturacion?: string | null;
}


export interface ConceptoCostoLocal {
  id: number;
  /** UUID persistido en `conceptos_costo.id`. Ver nota en `ConceptoVentaLocal.dbId`. */
  dbId?: string | null;
  proveedorId: string;
  /**
   * Nombre del proveedor tal como viene de BD (`conceptos_costo.proveedor_nombre`).
   * Los costos replicados desde cotización sólo traen el nombre; lo conservamos
   * para no perderlo al guardar cuando no existe un id de catálogo (v13.509.0).
   */
  proveedorNombre?: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  /** Contenedor del embarque al que aplica el costo (null = General). */
  contenedorId?: string | null;
}
