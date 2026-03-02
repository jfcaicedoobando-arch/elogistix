export interface ConceptoVentaLocal {
  id: number;
  concepto: string;
  proveedor: string;
  monto: number;
  moneda: string;
  total: number;
}

export interface ConceptoCostoLocal {
  id: number;
  proveedor: string;
  concepto: string;
  monto: number;
  moneda: string;
  aplicaIva: boolean;
  total: number;
}
