/**
 * Tipo de costos almacenados en `cotizacion_costos`.
 * Movido desde src/hooks/cotizacion/useCotizacionCostos.ts para que services/ pueda importarlo
 * sin que `services/` dependa de `hooks/`.
 */
export interface CostoCotizacion {
  id: string;
  cotizacion_id: string;
  concepto: string;
  moneda: 'USD' | 'MXN';
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  precio_venta?: number;
  unidad_medida?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}
