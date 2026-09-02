/**
 * Tipo de resumen de rentabilidad por cliente (módulo Reportes).
 */

export interface RentabilidadCliente {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
  /** DEFECTO 8: embarques de este cliente con al menos un concepto sin TC. */
  embarques_sin_tc: number;
}
