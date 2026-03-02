export interface ConceptoVentaLocal {
  id: number;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
}

export interface ConceptoCostoLocal {
  id: number;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
  iva: boolean;
}
