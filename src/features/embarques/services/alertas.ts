import { supabase } from "@/integrations/supabase/client";

export type AlertaEmbarqueTipo = "demora" | "garantia" | "cierre_operativo" | "admin_pendiente";
export type EmbarquesAlertasResumen = Record<AlertaEmbarqueTipo, number> & { total: number };

export async function fetchEmbarquesAlertasResumen(): Promise<EmbarquesAlertasResumen> {
  const { data, error } = await supabase.rpc("embarques_alertas_conteos");
  if (error) throw new Error(error.message);
  // Los totales por tipo vienen de la misma consulta que define la pertenencia.
  const conteos = data as Record<AlertaEmbarqueTipo, number>;
  return { ...conteos, total: Object.values(conteos).reduce((total, n) => total + n, 0) };
}
