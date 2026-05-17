/**
 * Servicio de reportes: alertas para sidebar, profit por embarque/cliente y
 * catálogo de operadores distintos. Todos los cálculos se hacen vía RPC en BD.
 *
 * v8.173.0 (Ola B.4): `fetchReportesResumen` consume el RPC `reportes_resumen`
 * que devuelve la rentabilidad por cliente + KPIs agregados (revenue, profit,
 * margenProm, totalClientes) en una sola llamada con cálculos hechos en DB.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SidebarAlertCounts {
  embarquesDemora: number;
  facturasVencidas: number;
}

export async function fetchSidebarAlertCounts(): Promise<SidebarAlertCounts> {
  const { data, error } = await supabase.rpc("sidebar_alert_counts");
  if (error) throw error;
  const row = data?.[0] ?? { embarques_demora: 0, facturas_vencidas: 0 };
  return {
    embarquesDemora: Number(row.embarques_demora),
    facturasVencidas: Number(row.facturas_vencidas),
  };
}


export interface RentabilidadFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

export interface ProfitPorClienteRow {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
}

export async function fetchProfitPorCliente(
  filtros: RentabilidadFiltros,
): Promise<ProfitPorClienteRow[]> {
  const { data, error } = await supabase.rpc("profit_por_cliente", {
    _fecha_desde: filtros.fechaDesde ?? undefined,
    _fecha_hasta: filtros.fechaHasta ?? undefined,
    _modo: filtros.modo ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as ProfitPorClienteRow[];
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

export async function fetchReportesResumen(filtros: RentabilidadFiltros): Promise<ReportesResumen> {
  const { data, error } = await supabase.rpc("reportes_resumen", {
    p_fecha_desde: filtros.fechaDesde ?? undefined,
    p_fecha_hasta: filtros.fechaHasta ?? undefined,
    p_modo: filtros.modo ?? undefined,
  });
  if (error) throw error;
  const raw = (data ?? { clientes: [], kpis: { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 } }) as {
    clientes?: Array<{
      cliente_id: string; cliente_nombre: string;
      total_embarques: number | string;
      venta_usd: number | string; costo_usd: number | string;
      profit_usd: number | string; margen: number | string;
    }>;
    kpis?: { totalClientes: number | string; revenue: number | string; profit: number | string; margenProm: number | string };
  };
  const clientes: ResumenClienteRow[] = (raw.clientes ?? []).map((c) => ({
    cliente_id: c.cliente_id,
    cliente_nombre: c.cliente_nombre,
    total_embarques: Number(c.total_embarques),
    venta_usd: Number(c.venta_usd),
    costo_usd: Number(c.costo_usd),
    profit_usd: Number(c.profit_usd),
    margen: Number(c.margen),
  }));
  const k = raw.kpis ?? { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 };
  return {
    clientes,
    kpis: {
      totalClientes: Number(k.totalClientes),
      revenue: Number(k.revenue),
      profit: Number(k.profit),
      margenProm: Number(k.margenProm),
    },
  };
}

export async function fetchOperadoresDistintos(): Promise<string[]> {
  const { data, error } = await supabase.rpc("operadores_distintos");
  if (error) throw error;
  return (data ?? []).map((r: { operador: string }) => r.operador);
}
