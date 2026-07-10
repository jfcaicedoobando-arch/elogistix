/**
 * Servicio de reportes: alertas para sidebar, profit por embarque/cliente y
 * catálogo de operadores distintos. Todos los cálculos se hacen vía RPC en BD.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

export interface SidebarAlertCounts {
  embarquesDemora: number;
  facturasVencidas: number;
  garantiasAtoradas: number;
}

export async function fetchSidebarAlertCounts(): Promise<SidebarAlertCounts> {
  const data = await unwrap(supabase.rpc("sidebar_alert_counts"));
  const row = data?.[0] ?? { embarques_demora: 0, facturas_vencidas: 0, garantias_atoradas: 0 };
  return {
    embarquesDemora: Number(row.embarques_demora),
    facturasVencidas: Number(row.facturas_vencidas),
    garantiasAtoradas: Number((row as { garantias_atoradas?: number }).garantias_atoradas ?? 0),
  };
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

export async function fetchReportesResumen(filtros: RentabilidadFiltros): Promise<ReportesResumen> {
  const data = await unwrap(
    supabase.rpc("reportes_resumen", {
      p_fecha_desde: filtros.fechaDesde ?? undefined,
      p_fecha_hasta: filtros.fechaHasta ?? undefined,
      p_modo: filtros.modo ?? undefined,
    }),
  );
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
  const rows = await unwrapOr(supabase.rpc("operadores_distintos"), []);
  return (rows as Array<{ operador: string }>).map((r) => r.operador);
}
