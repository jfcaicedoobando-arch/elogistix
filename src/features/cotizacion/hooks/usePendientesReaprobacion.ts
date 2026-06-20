/**
 * Conteo de cotizaciones pendientes de re-aprobación de tarifa (Fase 1).
 *
 * - Global: todas las cotizaciones del tenant en `estado_revalidacion =
 *   'pendiente_reaprobacion'` (dashboard de operaciones).
 * - Mías: filtradas por `operador = <email actual>` (dashboard comercial).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCotizacionesPendientesReaprobacion() {
  return useQuery<number>({
    queryKey: ["cotizaciones", "pendientes-reaprobacion", "all"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado_revalidacion", "pendiente_reaprobacion");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMisCotizacionesPendientesReaprobacion() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<number>({
    queryKey: ["cotizaciones", "pendientes-reaprobacion", "mias", email],
    enabled: Boolean(email),
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado_revalidacion", "pendiente_reaprobacion")
        .eq("operador", email as string);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
