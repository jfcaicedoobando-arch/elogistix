/**
 * Servicio de reportes: alertas para sidebar, profit por embarque/cliente y
 * catálogo de operadores distintos. Todos los cálculos se hacen vía RPC en BD.
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

export interface ProfitPorEmbarqueRow {
  embarque_id: string;
  venta_usd: number;
  costo_usd: number;
}

export async function fetchProfitPorEmbarque(): Promise<ProfitPorEmbarqueRow[]> {
  const { data, error } = await supabase.rpc("profit_por_embarque");
  if (error) throw error;
  return (data ?? []) as ProfitPorEmbarqueRow[];
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
    _fecha_desde: filtros.fechaDesde ?? null,
    _fecha_hasta: filtros.fechaHasta ?? null,
    _modo: filtros.modo ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ProfitPorClienteRow[];
}

export async function fetchOperadoresDistintos(): Promise<string[]> {
  const { data, error } = await supabase.rpc("operadores_distintos");
  if (error) throw error;
  return (data ?? []).map((r: { operador: string }) => r.operador);
}
