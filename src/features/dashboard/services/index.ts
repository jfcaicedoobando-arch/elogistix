/**
 * Servicio de dashboard: orquesta los RPC del lado del servidor que producen
 * los KPIs y listas usadas por el dashboard principal.
 *
 * - `dashboard_summary`: payload pequeño (KPIs, conteos) — eager.
 * - `dashboard_details`: listas largas — diferido tras summary.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchDashboardSummary(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("dashboard_summary" as never);
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function fetchDashboardDetails(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("dashboard_details" as never);
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}
