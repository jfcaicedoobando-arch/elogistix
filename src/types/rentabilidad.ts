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

/** Base del reporte, compartida por pantalla y PDF. */
export const METODOLOGIA_RENTABILIDAD = "Periodo por ETA; ventas facturadas netas de notas de crédito frente a costos operativos del embarque, sin impuestos. Las ventas pendientes de facturar no se reconocen aquí: una venta en cero no implica ausencia de venta ni una pérdida definitiva. Consulta Cierre mensual para la proyección y el pendiente de facturar.";
