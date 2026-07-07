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
}

export interface ConceptoCostoLocal {
  id: number;
  /** UUID persistido en `conceptos_costo.id`. Ver nota en `ConceptoVentaLocal.dbId`. */
  dbId?: string | null;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
  /** Contenedor del embarque al que aplica el costo (null = General). */
  contenedorId?: string | null;
}
