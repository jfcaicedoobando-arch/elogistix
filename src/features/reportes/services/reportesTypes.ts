/**
 * Tipos de los reportes globales (alertas de sidebar y resumen de rentabilidad).
 *
 * Ola 20 · paso 4: separados de los servicios para que importar un tipo no
 * arrastre el cliente de base de datos.
 */

export interface SidebarAlertCounts {
  embarquesDemora: number;
  facturasVencidas: number;
  garantiasAtoradas: number;
}

export interface RentabilidadFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

export interface ResumenClienteRow {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

export interface ReportesResumenKpis {
  totalClientes: number;
  revenue: number;
  profit: number;
  margenProm: number;
}

export interface ReportesResumen {
  clientes: ResumenClienteRow[];
  kpis: ReportesResumenKpis;
}
