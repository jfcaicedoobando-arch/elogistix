export interface ConceptoVentaLocal {
  id: number;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  /** Contenedor del embarque al que aplica el concepto (null = General). */
  contenedorId?: string | null;
}

export interface ConceptoCostoLocal {
  id: number;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
  /** Contenedor del embarque al que aplica el costo (null = General). */
  contenedorId?: string | null;
}
