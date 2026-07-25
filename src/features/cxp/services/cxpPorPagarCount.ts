import { supabase } from "@/integrations/supabase/client";

/**
 * Conteo de facturas de proveedor aprobadas con saldo > 0 en la org del usuario.
 * Reutiliza la RPC `cxp_por_pagar` (mismo universo que la bandeja
 * `/compras/por-pagar`) para garantizar paridad con lo que ve el usuario.
 * Sidebar consume este count para pintar el badge sobre "Por pagar".
 */
export async function fetchPorPagarCount(): Promise<number> {
  const { data, error } = await supabase.rpc("cxp_por_pagar");
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}
