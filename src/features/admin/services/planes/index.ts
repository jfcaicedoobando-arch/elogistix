/**
 * Servicio de planes: lectura y actualización de la tabla `planes` (catálogo
 * de planes de suscripción del sistema).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export interface Plan {
  id: string;
  nombre: string;
  max_usuarios: number;
  max_embarques_mes: number;
  almacenamiento_mb: number;
  precio_mensual: number;
  activo: boolean;
  created_at: string;
}

export async function fetchPlanes(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("planes")
    .select("*")
    .order("precio_mensual")
    .limit(100);
  if (error) throw error;
  return fromDb<Plan[]>(data ?? []);
}

export async function updatePlan(plan: Partial<Plan> & { id: string }): Promise<void> {
  const { id, ...rest } = plan;
  const { error } = await supabase
    .from("planes")
    // SAFE-CAST: Partial<Plan> proviene de un formulario validado; supabase-js 2.108 endurece RejectExcessProperties.
    .update(rest as never)
    .eq("id", id);
  if (error) throw error;
}
